import * as FileSystem from 'expo-file-system/legacy';

// Module-level caches. These survive screen navigation and are only cleared
// when the JS runtime restarts (app reload). Disk caches persist across restarts.
const MODEL_VIEWER_VERSION = '3.5.0';
const MODEL_VIEWER_CDN = `https://unpkg.com/@google/model-viewer@${MODEL_VIEWER_VERSION}/dist/model-viewer.min.js`;

const base64Cache = new Map(); // modelUrl -> base64 string
let scriptPromise = null; // Promise<string> for the model-viewer library source

const MODELS_DIR = `${FileSystem.documentDirectory}models/`;
const SCRIPT_URI = `${FileSystem.documentDirectory}model-viewer-${MODEL_VIEWER_VERSION}.js`;

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

async function ensureModelsDir() {
  const info = await FileSystem.getInfoAsync(MODELS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true });
  }
}

// Downloads the model-viewer library to disk once, reads it to a string, and
// memoizes it in memory so every WebView can inline it with zero network cost.
export function getModelViewerScript() {
  if (!scriptPromise) {
    scriptPromise = (async () => {
      try {
        const info = await FileSystem.getInfoAsync(SCRIPT_URI);
        if (!info.exists) {
          await FileSystem.downloadAsync(MODEL_VIEWER_CDN, SCRIPT_URI);
        }
        return await FileSystem.readAsStringAsync(SCRIPT_URI);
      } catch (e) {
        // Reset so a later attempt can retry the download.
        scriptPromise = null;
        throw e;
      }
    })();
  }
  return scriptPromise;
}

// Returns the base64-encoded bytes for a .glb, using an in-memory cache first,
// then a persistent on-disk cache, downloading only when neither exists.
export async function getModelBase64(modelUrl) {
  if (!modelUrl) throw new Error('Missing modelUrl');

  const cached = base64Cache.get(modelUrl);
  if (cached) return cached;

  await ensureModelsDir();
  const localUri = `${MODELS_DIR}mv_${Math.abs(hashString(modelUrl))}.glb`;

  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists) {
    await FileSystem.downloadAsync(modelUrl, localUri);
  }

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  base64Cache.set(modelUrl, base64);
  return base64;
}

// Fire-and-forget warming of the library and a list of model URLs so that the
// grid cards and detail screens render instantly when opened.
export function preloadModels(urls = []) {
  getModelViewerScript().catch(() => {});
  urls.forEach((url) => {
    if (url) getModelBase64(url).catch(() => {});
  });
}
