import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { BookmarkProvider } from './src/context/BookmarkContext';
import { AuthProvider } from './src/context/AuthContext';
import { NetworkProvider } from './src/context/NetworkContext';
import { OfflineScreen } from './src/components/OfflineScreen';
import { AppNavigator } from './src/navigation/AppNavigator';

// Keep the splash screen visible while app initializes to avoid white flashes
SplashScreen.preventAutoHideAsync().catch(() => {});

function AppContent() {
  const { isDarkMode } = useTheme();

  useEffect(() => {
    // Hide splash screen smoothly once the root component mounts
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <AppNavigator />
      <OfflineScreen />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <AuthProvider>
          <ThemeProvider>
            <BookmarkProvider>
              <AppContent />
            </BookmarkProvider>
          </ThemeProvider>
        </AuthProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}


