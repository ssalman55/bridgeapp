import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

export const colors = {
  // Primary branding colors matching web interface
  primary: '#0B4176', // Deep blue from splash screen, matching header theme
  primaryDark: '#052E50',
  primaryLight: '#1976D2',
  secondary: '#FF6B35', // Orange for primary actions (Check Out button)
  accent: '#4CAF50', // Green for success/positive metrics
  
  // Background colors
  background: '#FFFFFF',
  surface: '#F8F9FA', // Slightly warmer white for cards
  sidebar: '#282C34', // Dark sidebar from web interface
  
  // Status colors matching web metrics cards
  error: '#E53E3E', // Red for "Absent Today"
  warning: '#FFB020', // Yellow/Orange for "On Leave" 
  success: '#10B981', // Green for "Present Today" (vibrant)
  info: '#3182CE', // Blue for "Total Staff"
  
  // Text colors
  text: '#1A202C', // Dark grey, almost black
  textSecondary: '#718096', // Medium grey for secondary text
  textTertiary: '#A0AEC0', // Light grey for placeholder text
  
  // UI element colors
  border: '#E2E8F0', // Light border
  divider: '#CBD5E0',
  disabled: '#CBD5E0',
  placeholder: '#A0AEC0',
  backdrop: 'rgba(26, 32, 44, 0.6)', // Darker backdrop
  card: '#FFFFFF',
  notification: '#E53E3E',
  
  // Gradient colors (purple/pink to orange from logo)
  gradientStart: '#9333EA', // Purple/pink
  gradientEnd: '#FF6B35', // Orange
  
  // Additional accent colors from web interface
  purple: '#9333EA', // For icons and accents
  orange: '#FF6B35', // Primary action color
};

export const darkColors = {
  primary: '#90CAF9',
  primaryDark: '#64B5F6',
  secondary: '#FF8A65',
  accent: '#81C784',
  background: '#121212',
  surface: '#1E1E1E',
  error: '#EF5350',
  warning: '#FFB74D',
  success: '#81C784',
  info: '#64B5F6',
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  border: '#333333',
  divider: '#424242',
  disabled: '#666666',
  placeholder: '#888888',
  backdrop: 'rgba(0, 0, 0, 0.7)',
  card: '#1E1E1E',
  notification: '#FF5252',
};

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...colors,
    primary: colors.primary,
    secondary: colors.secondary,
    error: colors.error,
    warning: colors.warning,
    success: colors.success,
    info: colors.info,
    background: colors.background,
    surface: colors.surface,
    text: colors.text,
    onSurface: colors.text,
    onBackground: colors.text,
  },
  roundness: 12, // More rounded corners for modern, elegant look
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...darkColors,
  },
  roundness: 8,
};

export const theme = lightTheme;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  // Additional spacing for elegant layouts
  cardPadding: 20,
  screenPadding: 16,
  sectionSpacing: 32,
};

// Shadow presets for elegant depth
export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  card: {
    shadowColor: '#1A202C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  h2: {
    fontSize: 26,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    lineHeight: 28,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600' as const,
    letterSpacing: 0,
    lineHeight: 24,
  },
  body1: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  body2: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  button: {
    fontSize: 15,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
    lineHeight: 20,
  },
  // Additional styles for elegant UI
  subtitle: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  label: {
    fontSize: 13,
    fontWeight: '500' as const,
    letterSpacing: 0.1,
    lineHeight: 18,
  },
}; 