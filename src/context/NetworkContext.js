import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';

const NetworkContext = createContext({
  isConnected: true,
  isOffline: false,
  checkConnection: async () => true,
  isChecking: false,
});

export const NetworkProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const verifyConnection = useCallback(async () => {
    try {
      const state = await NetInfo.fetch();
      // On real devices and emulators, isConnected and isInternetReachable give network status
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsConnected(!offline);
      setIsOffline(offline);
      return !offline;
    } catch (e) {
      console.warn('Network check error:', e);
      return true;
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    verifyConnection();

    // Subscribe to network changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsConnected(!offline);
      setIsOffline(offline);
    });

    return () => {
      unsubscribe();
    };
  }, [verifyConnection]);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (_) {}

      // Try NetInfo fetch first
      const state = await NetInfo.fetch();
      let reachable = state.isConnected !== false && state.isInternetReachable !== false;

      // Double check with a fast ping
      if (reachable) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          const res = await fetch('https://whiteswantvnews.com/wp-json', {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-store',
          });
          clearTimeout(timeoutId);
          reachable = res.ok || res.status > 0;
        } catch (_) {
          // fetch error
        }
      }

      setIsConnected(reachable);
      setIsOffline(!reachable);

      if (reachable) {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (_) {}
      }

      return reachable;
    } catch (e) {
      console.warn('Error during manual connection check:', e);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  return (
    <NetworkContext.Provider
      value={{
        isConnected,
        isOffline,
        checkConnection,
        isChecking,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => useContext(NetworkContext);
export default NetworkContext;
