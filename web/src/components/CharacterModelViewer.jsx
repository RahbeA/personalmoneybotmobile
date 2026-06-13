import { useEffect, useRef, useState } from 'react';
import { Spin } from 'antd';
import { CodeSandboxOutlined } from '@ant-design/icons';
import { resolveMediaUrl } from '../utils/media';
import { brand } from '../theme/tokens';

import '@google/model-viewer';

function Placeholder({ accentColor, iconSize = 40 }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(circle at 50% 35%, ${accentColor || brand.primary}22 0%, ${brand.surfaceElevated} 70%)`,
      }}
    >
      <CodeSandboxOutlined style={{ fontSize: iconSize, color: brand.textMuted, opacity: 0.5 }} />
    </div>
  );
}

/**
 * Renders a .glb via @google/model-viewer (same library as the mobile app).
 * Uses native DOM events — React synthetic onLoad does not fire on web components.
 */
export default function CharacterModelViewer({
  modelUrl,
  posterUrl,
  accentColor = brand.primary,
  autoRotate = true,
  interactive = false,
  lazy = true,
  style,
}) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [mounted, setMounted] = useState(!lazy);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const src = resolveMediaUrl(modelUrl);
  const poster = resolveMediaUrl(posterUrl);

  useEffect(() => {
    setReady(false);
    setFailed(false);
  }, [src]);

  // Lazy-mount when scrolled into view.
  useEffect(() => {
    if (!lazy) return undefined;
    const el = containerRef.current;
    if (!el) return undefined;

    // Already visible on first paint — don't wait for observer callback.
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.top < window.innerHeight + 120 && rect.bottom > -120) {
      setMounted(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lazy]);

  // Bind load/error on the web component directly (React onLoad is unreliable here).
  useEffect(() => {
    if (!mounted || !src) return undefined;

    const el = viewerRef.current;
    if (!el) return undefined;

    let cancelled = false;

    function markReady() {
      if (!cancelled) setReady(true);
    }

    function markFailed() {
      if (!cancelled) setFailed(true);
    }

    el.addEventListener('load', markReady);
    el.addEventListener('error', markFailed);

    // Already cached / instant load.
    if (el.loaded) markReady();

    // Safety net so we never spin forever.
    const timeout = setTimeout(() => {
      if (!cancelled && !el.loaded) markFailed();
    }, 20000);

    return () => {
      cancelled = true;
      el.removeEventListener('load', markReady);
      el.removeEventListener('error', markFailed);
      clearTimeout(timeout);
    };
  }, [mounted, src]);

  if (!src) {
    if (poster) {
      return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', ...style }}>
          <img src={poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      );
    }
    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', ...style }}>
        <Placeholder accentColor={accentColor} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: `radial-gradient(circle at 50% 30%, ${accentColor}18 0%, ${brand.surfaceElevated} 65%)`,
        ...style,
      }}
    >
      {!mounted ? (
        poster ? (
          <img src={poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.85 }} />
        ) : (
          <Placeholder accentColor={accentColor} />
        )
      ) : failed ? (
        poster ? (
          <img src={poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <Placeholder accentColor={accentColor} />
        )
      ) : (
        <>
          <model-viewer
            ref={viewerRef}
            src={src}
            poster={poster || undefined}
            alt="Character 3D model"
            {...(autoRotate ? { 'auto-rotate': '' } : {})}
            {...(interactive ? { 'camera-controls': '' } : {})}
            interaction-prompt="none"
            shadow-intensity="0.8"
            exposure="1"
            {...(!interactive ? { 'disable-tap': '' } : {})}
            style={{
              width: '100%',
              height: '100%',
              background: 'transparent',
            }}
          />
          {!ready && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                background: 'rgba(20,20,20,0.35)',
              }}
            >
              <Spin />
            </div>
          )}
        </>
      )}
    </div>
  );
}
