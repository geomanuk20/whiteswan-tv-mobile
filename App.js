import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { BookmarkProvider } from './src/context/BookmarkContext';
import { AuthProvider } from './src/context/AuthContext';
import { NetworkProvider } from './src/context/NetworkContext';
import { OfflineScreen } from './src/components/OfflineScreen';
import { AppNavigator } from './src/navigation/AppNavigator';

function AppContent() {
  const { isDarkMode } = useTheme();

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

