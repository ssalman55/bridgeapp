import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

export const colors = {
  primary: '#1976D2',
  primaryDark: '#1565C0',
  secondary: '#FF6B35',
  accent: '#4CAF50',
  background: '#FFFFFF',
  surface: '#F5F5F5',
  error: '#D32F2F',
  warning: '#FF9800',
  success: '#4CAF50',
  info: '#2196F3',
  text: '#212121',
  textSecondary: '#757575',
  border: '#E0E0E0',
  divider: '#BDBDBD',
  disabled: '#BDBDBD',
  placeholder: '#9E9E9E',
  backdrop: 'rgba(0, 0, 0, 0.5)',
  card: '#FFFFFF',
  notification: '#FF5252',
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
  },
  roundness: 8,
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
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold' as const,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold' as const,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  body1: {
    fontSize: 16,
  },
  body2: {
    fontSize: 14,
  },
  caption: {
    fontSize: 12,
  },
  button: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
}; 