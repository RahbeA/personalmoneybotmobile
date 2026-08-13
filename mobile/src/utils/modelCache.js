import { Image } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const MODEL_VIEWER_VERSION = '3.5.0';
const MODEL_VIEWER_CDN = `https://unpkg.com/@google/model-viewer@${MODEL_VIEWER_VERSION}/dist/model-viewer.min.js`;

const MODELS_DIR = `${FileSystem.documentDirectory}models/`;
const PREVIEWS_DIR = `${MODELS_DIR}previews/`;
const SCRIPT_URI = `${FileSystem.documentDirectory}model-viewer-${MODEL_VIEWER_VERSION}.js`;
const MANIFEST_URI = `${MODELS_DIR}manifest.json`;

const DOWNLOAD_CONCURRENCY = 2;
const MIN_MODEL_BYTES = 100;
/**
 * Equipped hero + featured carousel + an open detail viewer. Unmounted viewers
 * evict eagerly, so RAM stays bounded regardless.
 */
const BASE64_CACHE_MAX = 3;
const LOG_RING_MAX = 120;

export const isModelCacheDebugEnabled =
  __DEV__ || process.env.EXPO_PUBLIC_MODEL_CACHE_DEBUG === '1';

const fileUriCache = new Map();
const base64Cache = new Map();
const base64CacheOrder = [];
const previewUriCache = new Map();
const pendingDownloads = new Map();
const pendingBase64 = new Map();
const viewerAssetsCache = new Map();
/** Resolved script+base64 pairs — instant reuse without re-awaiting the promise. */
const resolvedViewerAssets = new Map();
/** Active CharacterViewer mounts per model URL — free RAM when the last one unmounts. */
const viewerRetainCount = new Map();
const memoryLogOnce = new Set();
let scriptPromise = null;
let scriptSource = null;
let syncInFlight = null;
let lastSyncSignature = '';

const stats = {
  model: { memory: 0, disk: 0, network: 0, error: 0 },
  preview: { memory: 0, disk: 0, network: 0, remote: 0 },
  script: { memory: 0, disk: 0, network: 0 },
  sync: {
    lastRunAt: null,
    lastDurationMs: null,
    total: 0,
    ok: 0,
    failed: 0,
    forceRefresh: false,
  },
};

const recentLogs = [];

function shortUrl(url) {
  if (!url) return 'none';
  try {
    const name = new URL(url).pathname.split('/').filter(Boolean).pop();
    return name || url.slice(-28);
  } catch {
    return String(url).slice(-28);
  }
}

function formatBytes(n) {
  if (!n || n < 1024) return `${n || 0} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function logCache(category, source, message, meta = {}) {
  const entry = {
    ts: Date.now(),
    category,
    source,
    message,
    ...meta,
  };
  recentLogs.push(entry);
  if (recentLogs.length > LOG_RING_MAX) recentLogs.shift();

  if (!isModelCacheDebugEnabled) return;

  const suffix = Object.keys(meta).length
    ? ` ${JSON.stringify(meta)}`
    : '';
  // eslint-disable-next-line no-console
  console.log(`[ModelCache] ${category} ← ${source} | ${message}${suffix}`);
}

function logMemoryOnce(category, message, meta = {}) {
  const key = `${category}:${message}`;
  if (memoryLogOnce.has(key)) return;
  memoryLogOnce.add(key);
  logCache(category, 'memory', message, meta);
}

function invalidateViewerAssets(modelUrl) {
  if (modelUrl) {
    viewerAssetsCache.delete(modelUrl);
    resolvedViewerAssets.delete(modelUrl);
  } else {
    viewerAssetsCache.clear();
    resolvedViewerAssets.clear();
  }
}

function evictBase64FromMemory(modelUrl) {
  if (!modelUrl) return;
  base64Cache.delete(modelUrl);
  const idx = base64CacheOrder.indexOf(modelUrl);
  if (idx >= 0) base64CacheOrder.splice(idx, 1);
}

/**
 * Track a mounted CharacterViewer. Paired with releaseViewerModel on unmount so
 * unequipped detail models drop out of RAM the moment the user goes back.
 */
export function acquireViewerModel(modelUrl) {
  if (!modelUrl) return;
  viewerRetainCount.set(modelUrl, (viewerRetainCount.get(modelUrl) || 0) + 1);
}

export function releaseViewerModel(modelUrl) {
  if (!modelUrl) return;
  const next = (viewerRetainCount.get(modelUrl) || 0) - 1;
  if (next > 0) {
    viewerRetainCount.set(modelUrl, next);
    return;
  }
  viewerRetainCount.delete(modelUrl);
  invalidateViewerAssets(modelUrl);
  evictBase64FromMemory(modelUrl);
  logCache('VIEWER', 'release', shortUrl(modelUrl));
}

/** Synchronous peek when this model was loaded before in-session. */
export function peekViewerAssets(modelUrl) {
  return resolvedViewerAssets.get(modelUrl) ?? null;
}

/** Shared script + base64 load for all CharacterViewer instances on the same model. */
export function getViewerAssets(modelUrl) {
  if (!modelUrl) return Promise.reject(new Error('Missing modelUrl'));
  const resolved = resolvedViewerAssets.get(modelUrl);
  if (resolved) {
    logMemoryOnce('VIEWER', 'reuse-resolved', { model: shortUrl(modelUrl) });
    return Promise.resolve(resolved);
  }
  if (!viewerAssetsCache.has(modelUrl)) {
    viewerAssetsCache.set(
      modelUrl,
      Promise.all([getModelViewerScript(), getModelBase64(modelUrl)])
        .then(([script, base64]) => {
          // Dropped while the download was in flight (user left detail quickly).
          if ((viewerRetainCount.get(modelUrl) || 0) <= 0) {
            viewerAssetsCache.delete(modelUrl);
            evictBase64FromMemory(modelUrl);
            throw new Error('Viewer released before load finished');
          }
          const assets = { script, base64 };
          resolvedViewerAssets.set(modelUrl, assets);
          return assets;
        })
        .catch((e) => {
          viewerAssetsCache.delete(modelUrl);
          throw e;
        }),
    );
  }
  return viewerAssetsCache.get(modelUrl);
}

function bumpStat(group, key) {
  if (stats[group]?.[key] !== undefined) stats[group][key] += 1;
}

function touchBase64(modelUrl) {
  const idx = base64CacheOrder.indexOf(modelUrl);
  if (idx >= 0) base64CacheOrder.splice(idx, 1);
  base64CacheOrder.push(modelUrl);
  while (base64CacheOrder.length > BASE64_CACHE_MAX) {
    const evict = base64CacheOrder.shift();
    if (evict) {
      base64Cache.delete(evict);
      logCache('MODEL', 'memory-evict', shortUrl(evict));
    }
  }
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

function localModelPath(modelUrl) {
  return `${MODELS_DIR}mv_${Math.abs(hashString(modelUrl))}.glb`;
}

function localPreviewPath(previewUrl) {
  const ext = previewUrl.match(/\.(png|jpe?g|webp|gif)(\?|$)/i)?.[1] || 'jpg';
  return `${PREVIEWS_DIR}pv_${Math.abs(hashString(previewUrl))}.${ext}`;
}

function localGeneratedPosterPath(modelUrl) {
  return `${PREVIEWS_DIR}gen_${Math.abs(hashString(modelUrl))}.png`;
}

const generatedPosterCache = new Map();
const pendingGeneratedPosters = new Map();

/** Disk path for a still frame captured from the GLB (no server preview needed). */
export function getGeneratedPosterPath(modelUrl) {
  if (!modelUrl) return null;
  return localGeneratedPosterPath(modelUrl);
}

export async function peekGeneratedPosterUri(modelUrl) {
  if (!modelUrl) return null;
  const cached = generatedPosterCache.get(modelUrl);
  if (cached) return cached;
  await ensureModelsDir();
  const localUri = localGeneratedPosterPath(modelUrl);
  const info = await FileSystem.getInfoAsync(localUri);
  if (info.exists && info.size > 200) {
    generatedPosterCache.set(modelUrl, localUri);
    return localUri;
  }
  return null;
}

export async function saveGeneratedPoster(modelUrl, dataUrlOrBase64) {
  if (!modelUrl) throw new Error('modelUrl required');
  await ensureModelsDir();
  const localUri = localGeneratedPosterPath(modelUrl);
  const base64 = String(dataUrlOrBase64).replace(/^data:image\/\w+;base64,/, '');
  if (!base64 || base64.length < 100) {
    throw new Error('Poster capture returned empty image');
  }
  await FileSystem.writeAsStringAsync(localUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  generatedPosterCache.set(modelUrl, localUri);
  bumpStat('preview', 'disk');
  logCache('POSTER', 'saved', shortUrl(modelUrl), { bytes: base64.length });
  return localUri;
}

/**
 * Resolve a static character image URI from the server cover PNG only.
 * Grid cards must never pull a GLB just to paint a thumbnail.
 */
export async function resolveCharacterPosterUri({ previewUrl } = {}) {
  if (!previewUrl) return null;
  try {
    const uri = await getPreviewFileUri(previewUrl);
    if (uri) return uri;
  } catch {
    return previewUrl;
  }
  return previewUrl;
}

/** Deduped promise map so grid cards share one capture job per model. */
export function getPendingPosterJob(modelUrl) {
  return pendingGeneratedPosters.get(modelUrl) || null;
}

export function setPendingPosterJob(modelUrl, promise) {
  if (!modelUrl || !promise) return;
  pendingGeneratedPosters.set(modelUrl, promise);
  const clear = () => {
    if (pendingGeneratedPosters.get(modelUrl) === promise) {
      pendingGeneratedPosters.delete(modelUrl);
    }
  };
  promise.then(clear, clear);
}

async function ensureModelsDir() {
  const info = await FileSystem.getInfoAsync(MODELS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true });
  }
  const previewInfo = await FileSystem.getInfoAsync(PREVIEWS_DIR);
  if (!previewInfo.exists) {
    await FileSystem.makeDirectoryAsync(PREVIEWS_DIR, { intermediates: true });
  }
}

async function readManifest() {
  try {
    const info = await FileSystem.getInfoAsync(MANIFEST_URI);
    if (!info.exists) return {};
    const raw = await FileSystem.readAsStringAsync(MANIFEST_URI);
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeManifestEntry(modelUrl, localUri, size) {
  const manifest = await readManifest();
  manifest[modelUrl] = { localUri, size, cachedAt: Date.now() };
  await FileSystem.writeAsStringAsync(MANIFEST_URI, JSON.stringify(manifest));
}

async function validateLocalFile(localUri) {
  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists || !info.size || info.size < MIN_MODEL_BYTES) {
    throw new Error('Cached model file is missing or invalid');
  }
  return info;
}

async function runPool(items, worker, concurrency = DOWNLOAD_CONCURRENCY) {
  const queue = [...items];
  async function drain() {
    while (queue.length) {
      const item = queue.shift();
      if (item !== undefined) await worker(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, drain));
}

export function warmModelViewerOnBoot() {
  logCache('BOOT', 'app', 'warming model-viewer script');
  getModelViewerScript().catch((e) => {
    bumpStat('script', 'error');
    logCache('SCRIPT', 'error', e.message);
  });
}

export function getModelViewerScript() {
  if (scriptPromise) return scriptPromise;

  scriptPromise = (async () => {
    const started = Date.now();
    const info = await FileSystem.getInfoAsync(SCRIPT_URI);
    if (info.exists) {
      scriptSource = 'disk';
      bumpStat('script', 'disk');
      logCache('SCRIPT', 'disk', 'model-viewer script', {
        ms: Date.now() - started,
        path: SCRIPT_URI,
      });
      return FileSystem.readAsStringAsync(SCRIPT_URI);
    }

    logCache('SCRIPT', 'network', 'downloading model-viewer', { url: MODEL_VIEWER_CDN });
    const result = await FileSystem.downloadAsync(MODEL_VIEWER_CDN, SCRIPT_URI);
    if (result.status !== 200) {
      throw new Error(`model-viewer download failed (${result.status})`);
    }
    scriptSource = 'network';
    bumpStat('script', 'network');
    logCache('SCRIPT', 'network', 'model-viewer script saved', {
      ms: Date.now() - started,
      path: SCRIPT_URI,
    });
    return FileSystem.readAsStringAsync(SCRIPT_URI);
  })();

  scriptPromise.then(() => {
    logMemoryOnce('SCRIPT', 'model-viewer ready');
  });

  return scriptPromise.catch((e) => {
    scriptPromise = null;
    throw e;
  });
}

/** Download .glb to persistent disk cache. */
export async function getModelFileUri(modelUrl) {
  if (!modelUrl) throw new Error('Missing modelUrl');

  const mem = fileUriCache.get(modelUrl);
  if (mem) {
    logMemoryOnce('MODEL', `file ${shortUrl(modelUrl)}`);
    return mem;
  }

  if (pendingDownloads.has(modelUrl)) {
    logCache('MODEL', 'pending', shortUrl(modelUrl));
    return pendingDownloads.get(modelUrl);
  }

  const promise = (async () => {
    const started = Date.now();
    await ensureModelsDir();
    const localUri = localModelPath(modelUrl);
    const info = await FileSystem.getInfoAsync(localUri);

    if (info.exists) {
      await validateLocalFile(localUri);
      bumpStat('model', 'disk');
      logCache('MODEL', 'disk', shortUrl(modelUrl), {
        ms: Date.now() - started,
        size: formatBytes(info.size),
        path: localUri,
      });
    } else {
      logCache('MODEL', 'network', `downloading ${shortUrl(modelUrl)}`, { url: modelUrl });
      const result = await FileSystem.downloadAsync(modelUrl, localUri);
      if (result.status !== 200) {
        await FileSystem.deleteAsync(localUri, { idempotent: true });
        throw new Error(`Model download failed (${result.status})`);
      }
      const saved = await validateLocalFile(localUri);
      bumpStat('model', 'network');
      await writeManifestEntry(modelUrl, localUri, saved.size);
      logCache('MODEL', 'network', shortUrl(modelUrl), {
        ms: Date.now() - started,
        size: formatBytes(saved.size),
        path: localUri,
      });
    }

    fileUriCache.set(modelUrl, localUri);
    return localUri;
  })();

  pendingDownloads.set(modelUrl, promise);
  try {
    return await promise;
  } catch (e) {
    bumpStat('model', 'error');
    logCache('MODEL', 'error', shortUrl(modelUrl), { error: e.message });
    throw e;
  } finally {
    pendingDownloads.delete(modelUrl);
  }
}

/**
 * Base64 for WebView blob URLs. Disk is source of truth; RAM holds a small LRU.
 */
export async function getModelBase64(modelUrl) {
  if (!modelUrl) throw new Error('Missing modelUrl');

  const cached = base64Cache.get(modelUrl);
  if (cached) {
    bumpStat('model', 'memory');
    touchBase64(modelUrl);
    logMemoryOnce('MODEL', `base64 ${shortUrl(modelUrl)}`);
    return cached;
  }

  if (pendingBase64.has(modelUrl)) {
    return pendingBase64.get(modelUrl);
  }

  const promise = (async () => {
    const started = Date.now();
    const localUri = await getModelFileUri(modelUrl);
    const info = await FileSystem.getInfoAsync(localUri);
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64 || base64.length < MIN_MODEL_BYTES) {
      throw new Error('Model base64 read failed');
    }
    base64Cache.set(modelUrl, base64);
    touchBase64(modelUrl);
    logCache('MODEL', 'disk→memory', shortUrl(modelUrl), {
      ms: Date.now() - started,
      fileSize: formatBytes(info.size),
      base64Chars: base64.length,
    });
    return base64;
  })();

  pendingBase64.set(modelUrl, promise);
  try {
    return await promise;
  } catch (e) {
    bumpStat('model', 'error');
    logCache('MODEL', 'error', `base64 ${shortUrl(modelUrl)}`, { error: e.message });
    throw e;
  } finally {
    pendingBase64.delete(modelUrl);
  }
}

export async function getPreviewFileUri(previewUrl) {
  if (!previewUrl) return null;

  const cached = previewUriCache.get(previewUrl);
  if (cached) {
    bumpStat('preview', 'memory');
    logMemoryOnce('PREVIEW', shortUrl(previewUrl));
    return cached;
  }

  await ensureModelsDir();
  const localUri = localPreviewPath(previewUrl);
  const info = await FileSystem.getInfoAsync(localUri);
  if (info.exists) {
    previewUriCache.set(previewUrl, localUri);
    bumpStat('preview', 'disk');
    logCache('PREVIEW', 'disk', shortUrl(previewUrl), { path: localUri });
    return localUri;
  }

  logCache('PREVIEW', 'network', shortUrl(previewUrl));
  const result = await FileSystem.downloadAsync(previewUrl, localUri);
  if (result.status !== 200) {
    bumpStat('preview', 'remote');
    logCache('PREVIEW', 'remote', `fallback to CDN ${shortUrl(previewUrl)}`);
    return previewUrl;
  }
  previewUriCache.set(previewUrl, localUri);
  bumpStat('preview', 'network');
  logCache('PREVIEW', 'network', shortUrl(previewUrl), { path: localUri });
  return localUri;
}

export async function ensureModelCached(modelUrl) {
  if (!modelUrl) return null;
  logCache('BOOT', 'priority', shortUrl(modelUrl));
  await Promise.all([
    getModelBase64(modelUrl),
    getModelViewerScript(),
  ]);
  return modelUrl;
}

export async function refreshModel(modelUrl) {
  if (!modelUrl) return null;
  logCache('MODEL', 'refresh', shortUrl(modelUrl));
  invalidateViewerAssets(modelUrl);
  fileUriCache.delete(modelUrl);
  base64Cache.delete(modelUrl);
  const idx = base64CacheOrder.indexOf(modelUrl);
  if (idx >= 0) base64CacheOrder.splice(idx, 1);
  const localUri = localModelPath(modelUrl);
  await FileSystem.deleteAsync(localUri, { idempotent: true });
  return getModelBase64(modelUrl);
}

export function prefetchPreviewImages(characters = []) {
  characters.forEach((c) => {
    if (c?.preview_url) {
      getPreviewFileUri(c.preview_url).catch(() => {
        Image.prefetch(c.preview_url).catch(() => {});
      });
    }
  });
}

export async function syncCharacterModels(characters = [], { forceRefresh = false, priorityUrls = [] } = {}) {
  // Moneyverse grid is PNG-only. Warm at most the equipped hero GLB; every other
  // model downloads only when CharacterDetail mounts a CharacterViewer.
  const allUrls = [...new Set(characters.map((c) => c.model_url).filter(Boolean))];
  const priority = [...new Set(
    (priorityUrls || []).filter((u) => u && (allUrls.length === 0 || allUrls.includes(u))),
  )];
  const previewCount = characters.filter((c) => c?.preview_url).length;
  const signature = `previews:${previewCount}|glb:${priority.join('\0')}${forceRefresh ? ':force' : ''}`;

  if (!forceRefresh && syncInFlight) {
    logCache('SYNC', 'skip', 'sync already running');
    return syncInFlight;
  }
  if (!forceRefresh && signature === lastSyncSignature) {
    logCache('SYNC', 'skip', 'character set unchanged');
    return {
      total: priority.length,
      ok: priority.length,
      failed: 0,
      errors: [],
      skipped: true,
      deferredModels: Math.max(0, allUrls.length - priority.length),
    };
  }

  const started = Date.now();
  if (priority.length) warmModelViewerOnBoot();
  prefetchPreviewImages(characters);

  syncInFlight = (async () => {
    logCache('SYNC', 'start', `${priority.length} equipped GLB + ${previewCount} PNGs`, {
      forceRefresh,
      deferredModels: Math.max(0, allUrls.length - priority.length),
      priority: priority.map(shortUrl),
    });

    const errors = [];
    let ok = 0;

    await runPool(priority, async (url) => {
      try {
        if (forceRefresh) await refreshModel(url);
        else await getModelBase64(url);
        ok += 1;
      } catch (e) {
        errors.push({ url: shortUrl(url), error: e.message });
      }
    });

    stats.sync = {
      lastRunAt: Date.now(),
      lastDurationMs: Date.now() - started,
      total: priority.length,
      ok,
      failed: errors.length,
      forceRefresh,
    };

    logCache('SYNC', 'done', `${ok}/${priority.length} equipped ready`, {
      ms: Date.now() - started,
      failed: errors.length,
      deferredModels: Math.max(0, allUrls.length - priority.length),
      errors: errors.slice(0, 5),
    });

    if (errors.length) {
      errors.forEach(({ url, error }) => logCache('SYNC', 'fail', url, { error }));
    }

    lastSyncSignature = signature;
    return {
      total: priority.length,
      ok,
      failed: errors.length,
      errors,
      deferredModels: Math.max(0, allUrls.length - priority.length),
    };
  })();

  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}

export function preloadModels(urls = []) {
  return syncCharacterModels(urls.map((model_url) => ({ model_url })));
}

export async function getDiskCacheSummary() {
  await ensureModelsDir();
  const manifest = await readManifest();
  let totalBytes = 0;
  const models = [];
  for (const [url, meta] of Object.entries(manifest)) {
    totalBytes += meta.size || 0;
    models.push({
      name: shortUrl(url),
      size: formatBytes(meta.size),
      cachedAt: meta.cachedAt,
      path: meta.localUri,
    });
  }
  return {
    modelsDir: MODELS_DIR,
    scriptPath: SCRIPT_URI,
    scriptSource,
    modelCount: models.length,
    totalBytes: formatBytes(totalBytes),
    models,
  };
}

/** Snapshot for Profile debug panel + Safari remote debugging. */
export async function getModelCacheReport() {
  const disk = await getDiskCacheSummary().catch(() => ({
    modelsDir: MODELS_DIR,
    modelCount: 0,
    totalBytes: '0 B',
    models: [],
  }));

  const report = {
    debugEnabled: isModelCacheDebugEnabled,
    stats: { ...stats, model: { ...stats.model }, preview: { ...stats.preview }, script: { ...stats.script } },
    memory: {
      base64Models: base64CacheOrder.length,
      base64Max: BASE64_CACHE_MAX,
      fileUriEntries: fileUriCache.size,
      previewEntries: previewUriCache.size,
    },
    disk,
    recentLogs: recentLogs.slice(-40),
  };

  if (isModelCacheDebugEnabled) {
    globalThis.__MODEL_CACHE_REPORT__ = report;
  }

  return report;
}

export async function clearModelCache() {
  logCache('CACHE', 'clear', 'wiping disk + memory — next load will use network');
  fileUriCache.clear();
  base64Cache.clear();
  base64CacheOrder.length = 0;
  previewUriCache.clear();
  generatedPosterCache.clear();
  pendingGeneratedPosters.clear();
  viewerRetainCount.clear();
  invalidateViewerAssets();
  memoryLogOnce.clear();
  lastSyncSignature = '';
  syncInFlight = null;
  scriptPromise = null;
  scriptSource = null;

  await FileSystem.deleteAsync(MODELS_DIR, { idempotent: true });
  await FileSystem.deleteAsync(SCRIPT_URI, { idempotent: true });
  await ensureModelsDir();
}

export function getModelsDirectory() {
  return FileSystem.documentDirectory;
}

export function logCharacterViewerEvent(event, meta = {}) {
  const modelKey = meta.model ? shortUrl(meta.model) : '';
  const onceEvents = new Set(['3d-ready', 'timeout', 'error', 'assets-failed']);
  if (onceEvents.has(event)) {
    logMemoryOnce('VIEWER', `${event} ${modelKey}`, meta);
    return;
  }
  logCache('VIEWER', event, modelKey, meta);
}
