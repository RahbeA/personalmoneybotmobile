import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { socialApi } from '../../api/social';
import { invalidateCache } from '../../utils/apiCache';
import { BrandLoader } from '../../components/brand';
import PuckButton from '../../components/PuckButton';
import { requireAccount } from '../../utils/requireAccount';
import { File } from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { FEED_CACHE_KEYS, normalizeLink, isPlausibleLink } from './feedHelpers';
import { getImagePicker } from './imagePicker';

const CAPTION_MAX = 280;
const LINK_MAX = 2000;

// Wizard steps.
const STEP_VISIBILITY = 1;
const STEP_PHOTO = 2;
const STEP_DETAILS = 3;
const TOTAL_STEPS = 3;

// In-memory draft so the wizard survives the round-trip to the custom camera
// screen (which can remount this screen). Only restored when we come back with
// a captured photo — a fresh open from the Feed always starts clean.
let composeDraft = null;

function imageFileName(asset) {
  const mime = asset.mimeType || 'image/jpeg';
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const base = (asset.fileName || 'feed').replace(/\.[^.]+$/, '');
  return `${base}.${ext}`;
}

/**
 * Expo 56 fetch only accepts string / Blob / File parts.
 * The old RN `{ uri, name, type }` object throws Unsupported FormDataPart.
 */
function imageFormValue(asset) {
  return new File(asset.uri);
}

export default function ComposeFeedScreen({ navigation, route }) {
  const { token, user, isGuest } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const presetVisibility = route.params?.visibility === 'private' ? 'private' : null;

  // Restore the draft only when returning from the camera (a photo is present).
  const draft = route.params?.capturedPhoto && composeDraft ? composeDraft : null;

  const [asset, setAsset] = useState(draft?.asset ?? null);
  const [caption, setCaption] = useState(draft?.caption ?? '');
  const [link, setLink] = useState(draft?.link ?? '');
  const [visibility, setVisibility] = useState(draft?.visibility ?? (presetVisibility || 'public'));
  // If a visibility was passed in (e.g. "Add a private post"), skip step 1.
  const [step, setStep] = useState(draft?.step ?? (presetVisibility ? STEP_PHOTO : STEP_VISIBILITY));
  const [submitting, setSubmitting] = useState(false);

  // Keep the in-memory draft in sync so a remount can restore the wizard.
  useEffect(() => {
    composeDraft = { asset, caption, link, visibility, step };
  }, [asset, caption, link, visibility, step]);

  const isPrivate = visibility === 'private';

  useFocusEffect(
    useCallback(() => {
      if (isGuest) {
        requireAccount({ isGuest: true, navigation, feature: 'share a money tip' });
        navigation.goBack();
      }
    }, [isGuest, navigation]),
  );

  const chooseVisibility = (value) => {
    setVisibility(value);
    setStep(STEP_PHOTO);
  };

  const toggleVisibility = () => setVisibility((v) => (v === 'private' ? 'public' : 'private'));

  const goBack = () => {
    if (step === STEP_DETAILS) { setStep(STEP_PHOTO); return; }
    if (step === STEP_PHOTO && !presetVisibility) { setStep(STEP_VISIBILITY); return; }
    composeDraft = null; // closing the composer — discard the draft
    navigation.goBack();
  };

  const launchLibrary = async (ImagePicker) => {
    // PHPicker on iOS 14+ does not need Photo Library permission.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setAsset(result.assets[0]);
  };

  const launchCamera = async (ImagePicker) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync?.();
    if (perm && perm.granted === false) {
      Alert.alert('Camera access needed', 'Enable camera access in Settings to snap a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setAsset(result.assets[0]);
  };

  const withPicker = (fn) => {
    const ImagePicker = getImagePicker();
    if (!ImagePicker) {
      Alert.alert(
        'Need a fresh build',
        'This dev client was built before the photo picker was added. Rebuild with npx expo run:ios to add photos.',
      );
      return;
    }
    fn(ImagePicker).catch((e) => Alert.alert('Camera error', e.message || 'Try again.'));
  };

  // Prefer the custom in-app camera when the native module is present in this
  // build. Otherwise fall back to the OS camera via expo-image-picker.
  const takePhoto = () => {
    if (requireOptionalNativeModule('ExpoCamera')) {
      navigation.navigate('CameraCapture');
      return;
    }
    withPicker(launchCamera);
  };
  const chooseFromLibrary = () => withPicker(launchLibrary);

  // Photo handed back from the custom CameraCapture screen.
  useEffect(() => {
    const shot = route.params?.capturedPhoto;
    if (shot) {
      setAsset(shot);
      navigation.setParams({ capturedPhoto: undefined });
    }
  }, [route.params?.capturedPhoto, navigation]);

  const handleSubmit = async () => {
    if (!requireAccount({ isGuest, navigation, feature: 'share a money tip' })) return;
    // Posts must have a photo.
    if (!asset?.uri) {
      Alert.alert('Add a photo', 'Every post needs a photo. Take one or choose from your library.');
      setStep(STEP_PHOTO);
      return;
    }

    const trimmedCaption = caption.trim();
    const trimmedLink = normalizeLink(link);
    if (trimmedLink && !isPlausibleLink(trimmedLink)) {
      Alert.alert('Link looks off', 'Use a full https link, or leave it blank.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('image', imageFormValue(asset), imageFileName(asset));
      formData.append('caption', trimmedCaption.slice(0, CAPTION_MAX));
      if (trimmedLink) formData.append('link', trimmedLink.slice(0, LINK_MAX));
      formData.append('visibility', visibility);

      await socialApi.createFeedPost(token, formData);
      await invalidateCache(FEED_CACHE_KEYS.mine(user?.id));
      await invalidateCache(FEED_CACHE_KEYS.vault(user?.id));
      composeDraft = null; // posted successfully — clear the draft
      navigation.navigate('Feed', { posted: true, toVault: isPrivate });
    } catch (e) {
      Alert.alert('Could not post', e.message || 'Try again in a bit.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isGuest) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <BrandLoader message="Need an account…" />
      </LinearGradient>
    );
  }

  const stepTitle = step === STEP_VISIBILITY
    ? 'Who can see this?'
    : step === STEP_PHOTO
      ? 'Add a photo'
      : 'Caption & post';

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={goBack}
            activeOpacity={0.8}
            accessibilityLabel={step === STEP_VISIBILITY ? 'Close' : 'Back'}
          >
            <Ionicons name={step === STEP_VISIBILITY ? 'close' : 'chevron-back'} size={22} color={colors.white} />
          </TouchableOpacity>

          <View style={styles.progress}>
            {[STEP_VISIBILITY, STEP_PHOTO, STEP_DETAILS].map((s) => (
              <View
                key={s}
                style={[styles.progressDot, s <= step && styles.progressDotActive]}
              />
            ))}
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.stepEyebrow}>STEP {step} OF {TOTAL_STEPS}</Text>
          <Text style={styles.stepTitle}>{stepTitle}</Text>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === STEP_VISIBILITY ? (
              <View style={styles.choiceWrap}>
                <TouchableOpacity
                  style={styles.choiceCard}
                  activeOpacity={0.9}
                  onPress={() => chooseVisibility('public')}
                >
                  <View style={styles.choiceIcon}>
                    <Ionicons name="earth" size={26} color={colors.primary} />
                  </View>
                  <View style={styles.choiceBody}>
                    <Text style={styles.choiceTitle}>Public</Text>
                    <Text style={styles.choiceDesc}>
                      Shared to the Feed for everyone. Reviewed before it goes live.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.choiceCard}
                  activeOpacity={0.9}
                  onPress={() => chooseVisibility('private')}
                >
                  <View style={styles.choiceIcon}>
                    <Ionicons name="lock-closed" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.choiceBody}>
                    <Text style={styles.choiceTitle}>Private — MoneyVault</Text>
                    <Text style={styles.choiceDesc}>
                      Only you can see it. Saved to your MoneyVault instantly.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ) : null}

            {step === STEP_PHOTO ? (
              <View>
                {asset?.uri ? (
                  <>
                    <View style={styles.photoCard}>
                      <Image source={{ uri: asset.uri }} style={styles.preview} resizeMode="cover" />
                    </View>
                    <View style={styles.photoActionsRow}>
                      <TouchableOpacity style={styles.smallBtn} onPress={takePhoto} activeOpacity={0.85}>
                        <Ionicons name="camera-outline" size={18} color={colors.primary} />
                        <Text style={styles.smallBtnText}>Retake</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.smallBtn} onPress={chooseFromLibrary} activeOpacity={0.85}>
                        <Ionicons name="images-outline" size={18} color={colors.primary} />
                        <Text style={styles.smallBtnText}>Choose another</Text>
                      </TouchableOpacity>
                    </View>

                    <PuckButton
                      color={colors.primary}
                      height={56}
                      borderRadius={18}
                      lip={5}
                      onPress={() => setStep(STEP_DETAILS)}
                      contentStyle={styles.submitInner}
                      accessibilityLabel="Continue"
                    >
                      <Text style={styles.submitText}>Continue</Text>
                      <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                    </PuckButton>
                  </>
                ) : (
                  <View style={styles.bigChoices}>
                    <TouchableOpacity style={styles.bigChoice} activeOpacity={0.9} onPress={takePhoto}>
                      <View style={styles.bigChoiceIcon}>
                        <Ionicons name="camera" size={30} color={colors.primary} />
                      </View>
                      <Text style={styles.bigChoiceTitle}>Take a photo</Text>
                      <Text style={styles.bigChoiceDesc}>Snap one right now</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.bigChoice} activeOpacity={0.9} onPress={chooseFromLibrary}>
                      <View style={styles.bigChoiceIcon}>
                        <Ionicons name="images" size={28} color={colors.primary} />
                      </View>
                      <Text style={styles.bigChoiceTitle}>Choose from library</Text>
                      <Text style={styles.bigChoiceDesc}>Pick an existing photo</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : null}

            {step === STEP_DETAILS ? (
              <View>
                {asset?.uri ? (
                  <View style={styles.detailsPhotoRow}>
                    <Image source={{ uri: asset.uri }} style={styles.detailsThumb} resizeMode="cover" />
                    <View style={styles.detailsPhotoMeta}>
                      <TouchableOpacity
                        style={[styles.visToggle, isPrivate && styles.visTogglePrivate]}
                        onPress={toggleVisibility}
                        activeOpacity={0.8}
                        accessibilityLabel={isPrivate ? 'Change to Public' : 'Change to MoneyVault (private)'}
                      >
                        <Ionicons
                          name={isPrivate ? 'lock-closed' : 'earth'}
                          size={13}
                          color={isPrivate ? colors.textSecondary : colors.primary}
                        />
                        <Text style={[styles.visToggleText, isPrivate && styles.visToggleTextPrivate]}>
                          {isPrivate ? 'MoneyVault' : 'Public'}
                        </Text>
                        <Ionicons
                          name="swap-horizontal"
                          size={15}
                          color={isPrivate ? colors.textSecondary : colors.primary}
                        />
                      </TouchableOpacity>
                      <Text style={styles.visHint}>
                        {isPrivate ? 'Only you can see it — tap to make Public' : 'Everyone can see it — tap for MoneyVault'}
                      </Text>
                      <TouchableOpacity
                        style={styles.changePhotoBtn}
                        onPress={() => setStep(STEP_PHOTO)}
                        activeOpacity={0.8}
                        accessibilityLabel="Change photo"
                      >
                        <Ionicons name="image-outline" size={15} color="#FFFFFF" />
                        <Text style={styles.changePhotoBtnText}>Change photo</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                <Text style={styles.label}>CAPTION</Text>
                <View style={styles.field}>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Pay yourself first — even $10 counts."
                    placeholderTextColor={colors.textMuted}
                    value={caption}
                    onChangeText={setCaption}
                    maxLength={CAPTION_MAX}
                    multiline
                  />
                  <Text style={styles.counter}>{caption.length}/{CAPTION_MAX}</Text>
                </View>

                <Text style={styles.label}>LINK (OPTIONAL)</Text>
                <View style={styles.field}>
                  <TextInput
                    style={styles.linkInput}
                    placeholder="https://"
                    placeholderTextColor={colors.textMuted}
                    value={link}
                    onChangeText={setLink}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    maxLength={LINK_MAX}
                  />
                </View>

                <PuckButton
                  color={colors.primary}
                  height={56}
                  borderRadius={18}
                  lip={5}
                  disabled={submitting}
                  onPress={submitting ? undefined : handleSubmit}
                  contentStyle={styles.submitInner}
                  accessibilityLabel={isPrivate ? 'Save to MoneyVault' : 'Post for review'}
                >
                  <Ionicons name={isPrivate ? 'lock-closed' : 'send'} size={18} color="#FFFFFF" />
                  <Text style={styles.submitText}>
                    {submitting
                      ? 'Sending…'
                      : isPrivate ? 'Save to MoneyVault' : 'Post for review'}
                  </Text>
                </PuckButton>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Transparent spacer that keeps the progress bar centered without drawing a
  // visible circle on the right.
  headerSpacer: {
    width: 40,
    height: 40,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressDot: {
    width: 22,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.surface,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
  },
  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  stepEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Step 1 — visibility
  choiceWrap: { gap: 14 },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  choiceIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceBody: { flex: 1, minWidth: 0 },
  choiceTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  choiceDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Step 2 — photo
  bigChoices: { gap: 14 },
  bigChoice: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 6,
  },
  bigChoiceIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  bigChoiceTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.3,
  },
  bigChoiceDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  photoCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 14,
  },
  preview: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: colors.surface,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  smallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },

  // Step 3 — details
  detailsPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  detailsThumb: {
    width: 64,
    height: 80,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  detailsPhotoMeta: {
    flex: 1,
    minWidth: 0,
    gap: 8,
    alignItems: 'flex-start',
  },
  visToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  visTogglePrivate: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  visToggleText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  visToggleTextPrivate: {
    color: colors.textSecondary,
  },
  visHint: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  changePhotoBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  field: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
  },
  input: {
    minHeight: 88,
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  linkInput: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
    paddingVertical: 4,
  },
  counter: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'right',
  },
  submitInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
