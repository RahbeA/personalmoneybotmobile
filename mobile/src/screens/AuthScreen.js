import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { BrandLogo } from '../components/brand';
import LegalFooter from '../components/LegalFooter';
import { BRAND_NAME } from '../constants/brandCopy';
import { isGoogleConfigured } from '../config/google';
import { buildGoogleAuthConfig, getGoogleSignInBlockedMessage } from '../utils/googleAuth';

// Lets the auth popup/redirect resolve correctly when returning to the app.
WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen({ route, navigation }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const initialMode = route?.params?.mode || 'login';
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const { login, register, googleSignIn } = useAuth();

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    buildGoogleAuthConfig(),
  );

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  // Handle the result of the Google auth flow once the user returns to the app.
  useEffect(() => {
    if (!response) return;

    if (response.type === 'success') {
      const idToken = response.params?.id_token;
      if (!idToken) {
        setError('Google did not return a valid token. Try again.');
        setGoogleLoading(false);
        shake();
        return;
      }
      (async () => {
        try {
          await googleSignIn(idToken);
          // Navigation handled by root navigator watching auth state
        } catch (err) {
          setError(err.message || 'Google sign-in failed. Try again.');
          shake();
        } finally {
          setGoogleLoading(false);
        }
      })();
    } else if (response.type === 'error') {
      setError('Google sign-in was cancelled or failed.');
      setGoogleLoading(false);
      shake();
    } else {
      // dismiss / cancel
      setGoogleLoading(false);
    }
  }, [response]);

  async function handleGoogle() {
    setError('');
    const blocked = getGoogleSignInBlockedMessage();
    if (blocked) {
      setError(blocked);
      shake();
      return;
    }
    if (!isGoogleConfigured) {
      setError('Google sign-in is not configured yet.');
      shake();
      return;
    }
    setGoogleLoading(true);
    try {
      await promptAsync();
    } catch (err) {
      setError('Could not open Google sign-in.');
      setGoogleLoading(false);
      shake();
    }
  }

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function switchMode(newMode) {
    setMode(newMode);
    setError('');
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    if (newMode === 'login') {
      setAcceptedTerms(false);
    }
  }

  function openLegal(document) {
    navigation.navigate('Legal', { document });
  }

  async function handleSubmit() {
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      shake();
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setError('Please enter your name.');
        shake();
        return;
      }
      if (!acceptedTerms) {
        setError('Please agree to the Terms of Service and Privacy Policy.');
        shake();
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        shake();
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        shake();
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email.trim().toLowerCase(), password);
      } else {
        await register(email.trim().toLowerCase(), password, name.trim());
      }
      // Navigation handled by root navigator watching auth state
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
      shake();
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === 'login';

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Back + Logo */}
            <Animated.View
              style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
            >
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.backArrow}>←</Text>
              </TouchableOpacity>
              <BrandLogo size="md" style={styles.logo} />
            </Animated.View>

            {/* Title */}
            <Animated.View
              style={[
                styles.titleContainer,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              ]}
            >
              <Text style={styles.title}>{isLogin ? 'Welcome back' : 'Create account'}</Text>
              <Text style={styles.subtitle}>
                {isLogin
                  ? `Sign in to your ${BRAND_NAME} account`
                  : 'Start automating your finances today'}
              </Text>
            </Animated.View>

            {/* Mode Toggle Tabs */}
            <Animated.View style={[styles.tabContainer, { opacity: fadeAnim }]}>
              <TouchableOpacity
                style={[styles.tab, isLogin && styles.tabActive]}
                onPress={() => switchMode('login')}
              >
                <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, !isLogin && styles.tabActive]}
                onPress={() => switchMode('register')}
              >
                <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>Sign Up</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Form */}
            <Animated.View
              style={[
                styles.form,
                { opacity: fadeAnim, transform: [{ translateX: shakeAnim }] },
              ]}
            >
              {/* Full name (register only) */}
              {!isLogin && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Full Name</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                      placeholder="Jordan Rivera"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="words"
                      autoCorrect={false}
                      autoComplete="name"
                      textContentType="name"
                    />
                  </View>
                </View>
              )}

              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[styles.input, styles.inputWithIcon]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password (register only) */}
              {!isLogin && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="••••••••"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
              )}

              {/* Terms acceptance (register only) */}
              {!isLogin && (
                <TouchableOpacity
                  style={styles.termsRow}
                  onPress={() => setAcceptedTerms(!acceptedTerms)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                    {acceptedTerms ? (
                      <Text style={styles.checkmark}>✓</Text>
                    ) : null}
                  </View>
                  <Text style={styles.termsText}>
                    I agree to the{' '}
                    <Text style={styles.termsLink} onPress={() => openLegal('terms')}>
                      Terms of Service
                    </Text>
                    {' '}and{' '}
                    <Text style={styles.termsLink} onPress={() => openLegal('privacy')}>
                      Privacy Policy
                    </Text>
                  </Text>
                </TouchableOpacity>
              )}

              {/* Error */}
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Submit */}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  style={styles.submitGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.background} />
                  ) : (
                    <Text style={styles.submitText}>
                      {isLogin ? 'Sign In' : 'Create Account'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Divider */}
              {isGoogleConfigured && (
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>
              )}

              {/* Continue with Google */}
              {isGoogleConfigured && (
                <TouchableOpacity
                  style={styles.googleButton}
                  onPress={handleGoogle}
                  disabled={googleLoading || loading || !request}
                  activeOpacity={0.85}
                >
                  {googleLoading ? (
                    <ActivityIndicator color="#1a1a1a" />
                  ) : (
                    <>
                      <Image
                        source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                        style={styles.googleIcon}
                      />
                      <Text style={styles.googleButtonText}>Continue with Google</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <LegalFooter style={styles.legalFooter} />
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backArrow: {
    color: colors.white,
    fontSize: 20,
    lineHeight: 24,
  },
  logo: {
    width: 52,
    height: 52,
  },
  titleContainer: {
    marginBottom: 28,
    marginTop: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    letterSpacing: 0.1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 4,
    marginBottom: 28,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.background,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.white,
    letterSpacing: 0.2,
  },
  inputWithIcon: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    padding: 4,
  },
  eyeIcon: {
    fontSize: 18,
  },
  errorBox: {
    backgroundColor: 'rgba(255, 77, 77, 0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 77, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  submitButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  submitText: {
    color: colors.background,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 13,
    marginHorizontal: 12,
    letterSpacing: 0.3,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DADCE0',
    paddingVertical: 15,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  legalFooter: {
    marginTop: 8,
  },
});
