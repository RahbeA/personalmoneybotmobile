import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  getViewerAssets,
  peekGeneratedPosterUri,
  saveGeneratedPoster,
  getPendingPosterJob,
  setPendingPosterJob,
  acquireViewerModel,
  releaseViewerModel,
  logCharacterViewerEvent,
} from '../utils/modelCache';

/**
 * One off-screen WebView that captures still frames from GLBs (concurrency 1).
 * Mount once under Moneyverse. CharacterPoster enqueues via ensureModelPoster().
 */

const queue = [];
const waiters = new Map(); // modelUrl -> [{ resolve, reject }]
let kick = null;

function enqueue(modelUrl) {
  const existing = getPendingPosterJob(modelUrl);
  if (existing) return existing;

  const job = new Promise((resolve, reject) => {
    const list = waiters.get(modelUrl) || [];
    list.push({ resolve, reject });
    waiters.set(modelUrl, list);
    if (!queue.includes(modelUrl)) queue.push(modelUrl);
    kick?.();
  });
  setPendingPosterJob(modelUrl, job);
  return job;
}

export async function ensureModelPoster(modelUrl) {
  if (!modelUrl) return null;
  const cached = await peekGeneratedPosterUri(modelUrl);
  if (cached) return cached;
  return enqueue(modelUrl);
}

function settleWaiters(modelUrl, uri, err) {
  const list = waiters.get(modelUrl) || [];
  waiters.delete(modelUrl);
  list.forEach(({ resolve, reject }) => {
    if (err || !uri) reject(err || new Error('Poster capture failed'));
    else resolve(uri);
  });
}

function buildCaptureHtml({ script, base64 }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script type="module">${script}</script>
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: transparent; overflow: hidden; }
    model-viewer { width: 100%; height: 100%; background-color: transparent; --poster-color: transparent; }
  </style>
</head>
<body>
  <model-viewer
    id="mv"
    interaction-prompt="none"
    shadow-intensity="0.6"
    exposure="1"
    environment-image="neutral"
    camera-orbit="0deg 75deg 105%"
    disable-tap
    style="width:100%;height:100%;">
  </model-viewer>
  <script>
    function send(msg) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
    }
    try {
      var b64 = "${base64}";
      var bin = atob(b64);
      var len = bin.length;
      var bytes = new Uint8Array(len);
      for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
      var blob = new Blob([bytes], { type: 'model/gltf-binary' });
      var url = URL.createObjectURL(blob);
      var mv = document.getElementById('mv');
      var done = false;
      function finish(msg) {
        if (done) return;
        done = true;
        send(msg);
      }
      mv.addEventListener('load', function () {
        setTimeout(function () {
          if (!mv.toDataURL) {
            finish('error');
            return;
          }
          mv.toDataURL('image/png').then(function (dataUrl) {
            finish('poster:' + dataUrl);
          }).catch(function () { finish('error'); });
        }, 500);
      });
      mv.addEventListener('error', function () { finish('error'); });
      mv.setAttribute('src', url);
      setTimeout(function () { finish('timeout'); }, 25000);
    } catch (e) {
      send('error');
    }
  </script>
</body>
</html>`;
}

export default function PosterCaptureHost() {
  const [job, setJob] = useState(null); // { modelUrl, html }
  const busyRef = useRef(false);
  const activeUrlRef = useRef(null);
  const doneRef = useRef(false);

  const startNext = useCallback(async () => {
    if (busyRef.current) return;
    while (queue.length) {
      const modelUrl = queue.shift();
      const cached = await peekGeneratedPosterUri(modelUrl);
      if (cached) {
        settleWaiters(modelUrl, cached, null);
        continue;
      }

      busyRef.current = true;
      activeUrlRef.current = modelUrl;
      doneRef.current = false;
      // getViewerAssets aborts if the model isn't "retained", so hold it for the
      // duration of the capture and release it when the job settles.
      acquireViewerModel(modelUrl);
      try {
        const assets = await getViewerAssets(modelUrl);
        setJob({ modelUrl, html: buildCaptureHtml(assets) });
        return; // wait for onMessage
      } catch (e) {
        releaseViewerModel(modelUrl);
        settleWaiters(modelUrl, null, e);
        busyRef.current = false;
        activeUrlRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    kick = () => { startNext(); };
    startNext();
    return () => { kick = null; };
  }, [startNext]);

  async function finishJob(uri, err) {
    const modelUrl = activeUrlRef.current;
    if (!modelUrl || doneRef.current) return;
    doneRef.current = true;
    releaseViewerModel(modelUrl);
    settleWaiters(modelUrl, uri, err);
    setJob(null);
    busyRef.current = false;
    activeUrlRef.current = null;
    // Drain the rest of the queue
    setTimeout(() => startNext(), 0);
  }

  async function onMessage(event) {
    const data = event?.nativeEvent?.data || '';
    const modelUrl = activeUrlRef.current;
    if (!modelUrl) return;

    if (data.startsWith('poster:')) {
      try {
        const uri = await saveGeneratedPoster(modelUrl, data.slice(7));
        logCharacterViewerEvent('poster-saved', { model: modelUrl });
        await finishJob(uri, null);
      } catch (e) {
        await finishJob(null, e);
      }
      return;
    }
    if (data === 'error' || data === 'timeout') {
      logCharacterViewerEvent('poster-fail', { model: modelUrl, data });
      await finishJob(null, new Error(data));
    }
  }

  if (!job?.html) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      <WebView
        key={job.modelUrl}
        originWhitelist={['*']}
        source={{ html: job.html }}
        style={styles.webview}
        containerStyle={styles.webview}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        opaque={false}
        onMessage={onMessage}
        androidLayerType="hardware"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // iOS/WebKit refuses to give a GPU drawable to a near-invisible (opacity ~0)
  // or fully off-screen WebView, so WebGL never renders and model-viewer never
  // fires `load` (captures time out). We keep it fully opaque and render at full
  // 220x220 so the captured canvas is sharp, but push almost all of it past the
  // top-left corner (behind the status bar) — the few visible pixels are enough
  // for the compositor to keep rendering, while staying imperceptible.
  host: {
    position: 'absolute',
    width: 220,
    height: 220,
    left: -206,
    top: -206,
    opacity: 1,
  },
  webview: {
    width: 220,
    height: 220,
    backgroundColor: 'transparent',
  },
});
