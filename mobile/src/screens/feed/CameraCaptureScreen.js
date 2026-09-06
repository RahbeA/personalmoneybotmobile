import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../../context/ThemeContext';
import PuckButton from '../../components/PuckButton';

/**
 * Full-screen, Snapchat-style capture screen. Live preview fills the screen;
 * a big shutter sits at the bottom with flip + flash controls. On capture we
 * hand the photo back to ComposeFeed via the `capturedPhoto` route param.
 */
export default function CameraCaptureScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const cameraRef = useRef(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || !ready || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) return;
      // merge:true returns to the EXISTING ComposeFeed instance and only adds
      // the photo param — it does not wipe visibility or reset the wizard.
      navigation.navigate({
        name: 'ComposeFeed',
        params: {
          capturedPhoto: {
            uri: photo.uri,
            width: photo.width,
            height: photo.height,
            mimeType: 'image/jpeg',
            fileName: `moneybot-${Date.now()}.jpg`,
          },
        },
        merge: true,
      });
    } catch {
      setCapturing(false);
    }
  }, [ready, capturing, navigation]);

  const flipCamera = () => setFacing((f) => (f === 'back' ? 'front' : 'back'));
  const toggleFlash = () => setFlash((f) => (f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off'));
  const flashIcon = flash === 'off' ? 'flash-off' : flash === 'auto' ? 'flash-outline' : 'flash';

  // Permission still loading.
  if (!permission) {
    return (
      <View style={styles.blackFill}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  // Permission not granted yet — ask.
  if (!permission.granted) {
    return (
      <View style={styles.blackFill}>
        <StatusBar style="light" />
        <View style={[styles.permWrap, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={styles.topBtn}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Close camera"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.permBody}>
            <Ionicons name="camera-outline" size={48} color={colors.primary} />
            <Text style={styles.permTitle}>Camera access</Text>
            <Text style={styles.permText}>
              MoneyBot needs your camera to snap a photo for your post.
            </Text>
            <View style={styles.permCta}>
              <PuckButton
                color={colors.primary}
                height={52}
                borderRadius={16}
                lip={5}
                onPress={() => {
                  if (permission.canAskAgain) requestPermission();
                  else navigation.goBack();
                }}
                contentStyle={styles.permBtnInner}
              >
                <Text style={styles.permBtnText}>
                  {permission.canAskAgain ? 'Allow camera' : 'Close'}
                </Text>
              </PuckButton>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.blackFill}>
      <StatusBar style="light" />
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash}
        onCameraReady={() => setReady(true)}
      />

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={[styles.topRow, { top: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.topBtn}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Close camera"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topBtn}
            onPress={toggleFlash}
            accessibilityLabel={`Flash ${flash}`}
          >
            <Ionicons name={flashIcon} size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={[styles.bottomRow, { bottom: insets.bottom + 24 }]}>
          <View style={styles.sideSlot} />

          <TouchableOpacity
            style={styles.shutterOuter}
            onPress={takePhoto}
            disabled={!ready || capturing}
            activeOpacity={0.8}
            accessibilityLabel="Take photo"
          >
            {capturing ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <View style={styles.shutterInner}>
                <Image
                  source={require('../../../assets/logo.png')}
                  style={styles.shutterLogo}
                  resizeMode="contain"
                />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.sideSlot}>
            <TouchableOpacity
              style={styles.flipBtn}
              onPress={flipCamera}
              accessibilityLabel="Flip camera"
            >
              <Ionicons name="camera-reverse-outline" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const CONTROL_BG = 'rgba(0,0,0,0.4)';

const makeStyles = (colors) => StyleSheet.create({
  blackFill: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  topRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  topBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CONTROL_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  sideSlot: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  shutterLogo: {
    width: 58,
    height: 58,
  },
  flipBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: CONTROL_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },

  permWrap: { flex: 1, paddingHorizontal: 24 },
  permBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  permTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginTop: 8 },
  permText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 21,
  },
  permCta: { alignSelf: 'stretch', marginTop: 20 },
  permBtnInner: { alignItems: 'center', justifyContent: 'center' },
  permBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
