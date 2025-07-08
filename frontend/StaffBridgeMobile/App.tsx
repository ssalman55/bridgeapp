import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
// @ts-ignore
import { ThemeProvider } from './src/context/ThemeContext';
// @ts-ignore
import { AuthProvider } from './src/context/AuthContext';
// @ts-ignore
import { NotificationProvider } from './src/context/NotificationContext';
// @ts-ignore
import RootNavigator from './src/navigation/RootNavigator';
// @ts-ignore
import { useTheme } from './src/context/ThemeContext';

function MainApp() {
  const { theme } = useTheme();
  return (
    <PaperProvider theme={theme as any}>
      <NotificationProvider>
        <AuthProvider>
          <NavigationContainer theme={theme as any}>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </NotificationProvider>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}
