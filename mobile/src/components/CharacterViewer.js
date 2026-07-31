import React, { useState, useMemo, useEffect } from 'react';
import { View, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import { getViewerAssets, getPreviewFileUri, refreshModel, logCharacterViewerEvent, peekViewerAssets, acquireViewerModel, releaseViewerModel } from '../utils/modelCache';
import BrandLogo from './brand/BrandLogo';

// model-viewer renders .glb inside a WebView. iOS inline HTML cannot load file://
// URLs from the app sandbox, so we inject the model as a blob URL from base64
// bytes that RN downloaded to disk first.
function buildHtml({ script, base64, autoRotate, allowDrag }) {
  const cameraControls = allowDrag ? 'camera-controls touch-action="pan-y"' : '';
  const autoRotateAttr = autoRotate
    ? 'auto-rotate auto-rotate-delay="0" rotation-per-second="32deg"'
    : '';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <script type="module">${script}</script>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; width: 100%; background: transparent; overflow: hidden; }
    model-viewer { width: 100%; height: 100%; background-color: transparent; --poster-color: transparent; }
  </style>
</head>
<body>
  <model-viewer
    id="mv"
    ${autoRotateAttr}
    ${cameraControls}
    interaction-prompt="none"
    shadow-intensity="1"
    exposure="1"
    environment-image="neutral"
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
      mv.addEventListener('load', function () { send('loaded'); });
      mv.addEventListener('error', function () { send('error'); });
      mv.setAttribute('src', url);
      setTimeout(function () { if (!mv.loaded) send('timeout'); }, 30000);
    } catch (e) {
      send('error');
    }
  </script>
</body>
</html>`;
}

function PosterFallback({ previewUri, style, logoSize = 'lg' }) {
  if (previewUri) {
    return (
      <Image
        source={{ uri: previewUri }}
        style={[styles.fill, style]}
        resizeMode="contain"
      />
    );
  }
  return (
    <View style={[styles.fill, styles.posterFallback, style]}>
      <BrandLogo size={logoSize} />
    </View>
  );
}

export default function CharacterViewer({
  modelUrl,
  previewUrl,
  style,
  autoRotate = true,
  allowDrag = false,
  logoSize = 'lg',
}) {
  const { colors } = useTheme();
  const initialAssets = useMemo(() => (modelUrl ? peekViewerAssets(modelUrl) : null), [modelUrl]);
  const [status, setStatus] = useState(initialAssets ? 'webview' : 'loading');
  const [assets, setAssets] = useState(initialAssets);
  const [previewUri, setPreviewUri] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!previewUrl) {
      setPreviewUri(null);
      return undefined;
    }
    let cancelled = false;
    getPreviewFileUri(previewUrl)
      .then((uri) => { if (!cancelled) setPreviewUri(uri || previewUrl); })
      .catch(() => { if (!cancelled) setPreviewUri(previewUrl); });
    return () => { cancelled = true; };
  }, [previewUrl]);

  // Retain while mounted (Moneyverse hero + open detail). Last unmount frees RAM.
  useEffect(() => {
    if (!modelUrl) return undefined;
    acquireViewerModel(modelUrl);
    return () => releaseViewerModel(modelUrl);
  }, [modelUrl]);

  useEffect(() => {
    let cancelled = false;

    if (!modelUrl) {
      setStatus('error');
      setAssets(null);
      return undefined;
    }

    const cached = peekViewerAssets(modelUrl);
    if (cached) {
      setAssets(cached);
      setStatus('webview');
    } else {
      setStatus('loading');
      setAssets(null);
    }

    (async () => {
      try {
        const next = await getViewerAssets(modelUrl);
        if (!cancelled) {
          setAssets(next);
          setStatus((prev) => (prev === 'ready' ? 'ready' : 'webview'));
        }
      } catch (e) {
        if (cancelled) return;
        // User left before load finished — not a real viewer failure.
        if (String(e?.message || '').includes('released before load')) return;
        logCharacterViewerEvent('assets-failed', { model: modelUrl, error: e.message });
        setStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, [modelUrl, attempt]);

  const html = useMemo(() => {
    if (!assets) return null;
    return buildHtml({ ...assets, autoRotate, allowDrag });
  }, [assets, autoRotate, allowDrag]);

  function onMessage(event) {
    const data = event?.nativeEvent?.data;
    if (data === 'loaded') {
      logCharacterViewerEvent('3d-ready', { model: modelUrl });
      setStatus('ready');
      return;
    }
    if (data === 'error' || data === 'timeout') {
      logCharacterViewerEvent(data, { model: modelUrl, attempt });
      if (attempt < 1) {
        refreshModel(modelUrl).finally(() => setAttempt((n) => n + 1));
        return;
      }
      setStatus('error');
    }
  }

  const poster = previewUri || previewUrl;

  if (!modelUrl || status === 'error') {
    return <PosterFallback previewUri={poster} style={style} logoSize={logoSize} />;
  }

  return (
    <View style={[styles.fill, style]}>
      {/* Placeholder only. The webview renders on a transparent background, so
          leaving this mounted would show the cover image behind the model. */}
      {poster && status !== 'ready' ? (
        <Image
          source={{ uri: poster }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
        />
      ) : null}
      {html ? (
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          style={[styles.webview, status !== 'ready' && styles.webviewHidden]}
          containerStyle={styles.webview}
          scrollEnabled={false}
          bounces={false}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="always"
          androidLayerType="hardware"
          onMessage={onMessage}
          onError={() => {
            if (attempt < 1) {
              refreshModel(modelUrl).finally(() => setAttempt((n) => n + 1));
            } else {
              setStatus('error');
            }
          }}
        />
      ) : null}
      {status === 'loading' && !poster && (
        <View style={[StyleSheet.absoluteFill, styles.center, styles.loadingOverlay]} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', height: '100%' },
  center: { alignItems: 'center', justifyContent: 'center' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  webviewHidden: { opacity: 0 },
  loadingOverlay: { backgroundColor: 'rgba(255,255,255,0.35)' },
  posterFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
