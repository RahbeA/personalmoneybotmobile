import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Only load expo-image-picker if this native binary already has it.
 * Requiring the JS package on an older dev client throws ExponentImagePicker
 * and Expo still paints a redbox even when that throw is caught.
 */
export function getImagePicker() {
  if (!requireOptionalNativeModule('ExponentImagePicker')) {
    return null;
  }
  // eslint-disable-next-line global-require
  return require('expo-image-picker');
}
