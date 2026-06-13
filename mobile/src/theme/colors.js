export const darkColors = {
  primary: '#3DDC5F',       // Bright moneybot green
  primaryDark: '#2AB84A',   // Deeper green for pressed states
  primaryLight: '#6FE88A',  // Lighter green for accents
  botBucks: '#F5B72B',
  streak: '#FF6B35',
  primaryTint: 'rgba(61,220,95,0.12)',
  primaryTintStrong: 'rgba(61,220,95,0.22)',
  background: '#0A0A0A',    // Near-black background
  surface: '#141414',       // Slightly lighter card surface
  surfaceElevated: '#1E1E1E', // Elevated card surface
  white: '#FFFFFF',         // Primary text (high contrast on dark)
  offWhite: '#F0F0F0',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#606060',
  border: '#2A2A2A',
  inputBg: '#1A1A1A',
  error: '#FF4D4D',
  success: '#3DDC5F',
  overlay: 'rgba(0,0,0,0.6)',
  bgGradient: ['#0A0A0A', '#0D160F', '#0A0A0A'],
  statusBar: 'light',
};

export const lightColors = {
  primary: '#16A34A',       // Deeper green so white text stays readable
  primaryDark: '#15803D',
  primaryLight: '#22C55E',
  botBucks: '#D97706',
  streak: '#EA580C',
  primaryTint: 'rgba(22,163,74,0.12)',
  primaryTintStrong: 'rgba(22,163,74,0.22)',
  background: '#F4F6F8',    // Soft off-white background
  surface: '#FFFFFF',       // Card surface
  surfaceElevated: '#FFFFFF', // Elevated card surface
  white: '#0B0B0B',         // Primary text (high contrast on light)
  offWhite: '#1A1A1A',
  textPrimary: '#0B0B0B',
  textSecondary: '#5A5F66',
  textMuted: '#8B9099',
  border: '#E3E6EA',
  inputBg: '#FFFFFF',
  error: '#DC2626',
  success: '#16A34A',
  overlay: 'rgba(0,0,0,0.4)',
  bgGradient: ['#F4F6F8', '#EAF4ED', '#F4F6F8'],
  statusBar: 'dark',
};

export const themes = { dark: darkColors, light: lightColors };

// Default export kept as dark for any module-scope usage before the
// ThemeProvider mounts (e.g. the initial loading screen).
export const colors = darkColors;
