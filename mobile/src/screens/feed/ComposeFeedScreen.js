import React, { useCallback, useMemo, useState } from 'react';
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
import { BrandHeader, BrandLoader } from '../../components/brand';
import PuckButton from '../../components/PuckButton';
import { requireAccount } from '../../utils/requireAccount';
import { File } from 'expo-file-system';
import { FEED_CACHE_KEYS, normalizeLink, isPlausibleLink } from './feedHelpers';
import { getImagePicker } from './imagePicker';

const CAPTION_MAX = 280;
const LINK_MAX = 2000;

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

export default function ComposeFeedScreen({ navigation }) {
  const { token, user, isGuest } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [asset, setAsset] = useState(null);
  const [caption, setCaption] = useState('');
  const [link, setLink] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (isGuest) {
        requireAccount({ isGuest: true, navigation, feature: 'share a money tip' });
        navigation.goBack();
      }
    }, [isGuest, navigation]),
  );

  const pickPhoto = async () => {
    const ImagePicker = getImagePicker();
    if (!ImagePicker) {
      Alert.alert(
        'Need a fresh build',
        'This dev client was built before the camera-roll picker was added. Rebuild with npx expo run:ios to post photos. Everything else still works.',
      );
      return;
    }

    try {
      // PHPicker on iOS 14+ does not need Photo Library permission.
      // requestMediaLibraryPermissionsAsync() talks to PHPhotoLibrary and will
      // crash the process if Info.plist is missing NSPhotoLibraryUsageDescription.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? ['images'],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.[0]) return;
      setAsset(result.assets[0]);
    } catch (e) {
      Alert.alert('Could not open photos', e.message || 'Try again in a bit.');
    }
  };

  const handleSubmit = async () => {
    if (!requireAccount({ isGuest, navigation, feature: 'share a money tip' })) return;
    if (!asset?.uri) {
      Alert.alert('Photo needed', 'Pick a camera-roll photo for your tip.');
      return;
    }
    const trimmedCaption = caption.trim();
    if (!trimmedCaption) {
      Alert.alert('Caption needed', 'Add a short money-education caption.');
      return;
    }

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

      await socialApi.createFeedPost(token, formData);
      await invalidateCache(FEED_CACHE_KEYS.mine(user?.id));
      navigation.navigate('Feed', { posted: true });
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

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            accessibilityLabel="Back"
          >
            <Ionicons name="close" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
        <BrandHeader
          title="New post"
          subtitle="Photo + caption. We review money-education posts before they go live."
          style={styles.brandHeader}
        />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity style={styles.photoCard} onPress={pickPhoto} activeOpacity={0.88}>
              {asset?.uri ? (
                <>
                  <Image source={{ uri: asset.uri }} style={styles.preview} resizeMode="cover" />
                  <View style={styles.changeBadge}>
                    <Ionicons name="camera" size={14} color="#FFFFFF" />
                    <Text style={styles.changeText}>Change photo</Text>
                  </View>
                </>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <View style={styles.photoIcon}>
                    <Ionicons name="images-outline" size={28} color={colors.primary} />
                  </View>
                  <Text style={styles.photoTitle}>Pick from camera roll</Text>
                  <Text style={styles.photoBody}>Money tips only — keep it safe and useful.</Text>
                </View>
              )}
            </TouchableOpacity>

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
              accessibilityLabel="Post for review"
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
              <Text style={styles.submitText}>
                {submitting ? 'Sending…' : 'Post for review'}
              </Text>
            </PuckButton>
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
    paddingHorizontal: 20,
    paddingTop: 4,
    marginBottom: -8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  photoCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 20,
  },
  preview: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: colors.surface,
  },
  changeBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.overlay,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  changeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  photoPlaceholder: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  photoIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  photoTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.3,
  },
  photoBody: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
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
