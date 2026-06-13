import React, { useState, useMemo, useEffect } from 'react';
import { View, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import { getModelBase64, getModelViewerScript } from '../utils/modelCache';

// model-viewer reliably renders .glb (textures, lighting, animation) inside a
// WebView. We feed it the model as an in-page blob URL built from base64 bytes
// downloaded by RN, so the WebView never makes an http request (avoids iOS ATS
// blocking of http://localhost media) and it works offline once cached. The
// model-viewer library itself is also cached and inlined, so no CDN round-trip.
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
      setTimeout(function () { if (!mv.loaded) send('timeout'); }, 15000);
    } catch (e) {
      send('error');
    }
  </script>
</body>
</html>`;
}

export default function CharacterViewer({
  modelUrl,
  previewUrl,
  style,
  autoRotate = true,
  allowDrag = false,
  iconColor,
}) {
  const { colors } = useTheme();
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [assets, setAssets] = useState(null); // { script, base64 }

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setAssets(null);

    if (!modelUrl) {
      setStatus('error');
      return;
    }

    (async () => {
      try {
        const [script, base64] = await Promise.all([
          getModelViewerScript(),
          getModelBase64(modelUrl),
        ]);
        if (!cancelled) setAssets({ script, base64 });
      } catch (e) {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [modelUrl]);

  const html = useMemo(() => {
    if (!assets) return null;
    return buildHtml({ ...assets, autoRotate, allowDrag });
  }, [assets, autoRotate, allowDrag]);

  function onMessage(event) {
    const data = event?.nativeEvent?.data;
    if (data === 'loaded') setStatus('ready');
    else if (data === 'error' || data === 'timeout') setStatus('error');
  }

  if (!modelUrl || status === 'error') {
    if (previewUrl) {
      return <Image source={{ uri: previewUrl }} style={[styles.fill, style]} resizeMode="contain" />;
    }
    return (
      <View style={[styles.fill, styles.center, style]}>
        <Ionicons name="cube-outline" size={48} color={iconColor || colors.textMuted} />
      </View>
    );
  }

  return (
    <View style={[styles.fill, style]}>
      {html && (
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          style={styles.webview}
          containerStyle={styles.webview}
          scrollEnabled={false}
          bounces={false}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="always"
          androidLayerType="hardware"
          onMessage={onMessage}
          onError={() => setStatus('error')}
        />
      )}
      {status === 'loading' && (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
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
});
