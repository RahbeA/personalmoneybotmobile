import { requireOptionalNativeModule } from 'expo-modules-core';
import { File, Paths } from 'expo-file-system';

/**
 * Only load expo-media-library if this native binary already has it.
 * Requiring the JS package on an older dev client throws at the native module
 * boundary, so we guard the same way imagePicker.js does.
 */
export function getMediaLibrary() {
  if (!requireOptionalNativeModule('ExpoMediaLibrary')) {
    return null;
  }
  // The legacy entrypoint keeps the simple saveToLibraryAsync(localUri) API.
  // eslint-disable-next-line global-require
  return require('expo-media-library/legacy');
}

function guessExtension(url) {
  const match = /\.(jpg|jpeg|png|webp|gif)(?:\?|#|$)/i.exec(url || '');
  return match ? match[1].toLowerCase() : 'jpg';
}

/**
 * Download a remote feed image and save it into the device photo library.
 * Returns { ok } or { ok:false, reason } where reason is:
 *   'unavailable' (module missing – needs rebuild) | 'denied' (permission) | 'error'
 */
export async function saveRemoteImageToCameraRoll(remoteUrl) {
  if (!remoteUrl) return { ok: false, reason: 'error' };

  const MediaLibrary = getMediaLibrary();
  if (!MediaLibrary) {
    return { ok: false, reason: 'unavailable' };
  }

  try {
    // Write-only (add) permission is enough to save.
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (!perm?.granted) {
      return { ok: false, reason: 'denied' };
    }

    const filename = `moneybot-${Date.now()}.${guessExtension(remoteUrl)}`;
    const destination = new File(Paths.cache, filename);
    // If a stale file exists at this path, clear it so the download can write.
    try { destination.delete(); } catch { /* nothing to delete */ }

    const downloaded = await File.downloadFileAsync(remoteUrl, destination);
    const localUri = downloaded?.uri || destination.uri;

    await MediaLibrary.saveToLibraryAsync(localUri);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'error', message: e?.message };
  }
}
