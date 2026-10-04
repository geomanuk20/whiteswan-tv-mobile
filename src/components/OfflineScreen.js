import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNetwork } from '../context/NetworkContext';
import { COLORS } from '../constants/theme';

export const OfflineScreen = () => {
  const { isOffline, checkConnection, isChecking } = useNetwork();
  const spinValue = useRef(new Animated.Value(0)).current;

  const handleTryAgain = async () => {
    if (isChecking) return;

    // Trigger spinning animation
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    try {
      await checkConnection();
    } finally {
      spinValue.stopAnimation();
      spinValue.setValue(0);
    }
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!isOffline) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Ambient / Decorative Phone Illustration Area */}
          <View style={styles.illustrationWrapper}>
            {/* Sparkle top left (Sky Blue) */}
            <View style={styles.sparkleTopLeft}>
              <Ionicons name="sparkles" size={16} color={COLORS.primaryLight || '#38BDF8'} />
            </View>

            {/* Sparkle top right (Primary Blue dot) */}
            <View style={styles.sparkleTopRight} />

            {/* Sparkle bottom right (Cyan/Blue star) */}
            <View style={styles.sparkleBottomRight}>
              <Ionicons name="sparkles" size={14} color={COLORS.primary || '#00A3E8'} />
            </View>

            {/* Ambient subtle circular blue glow */}
            <View style={styles.ambientGlow} />

            {/* Phone Body */}
            <View style={styles.phoneBody}>
              {/* Phone Speaker Notch */}
              <View style={styles.phoneSpeaker} />

              {/* Phone Inner Screen */}
              <View style={styles.phoneScreen}>
                {/* Deep Blue Circular Backdrop */}
                <View style={styles.wifiCircle}>
                  <MaterialCommunityIcons
                    name="wifi-off"
                    size={34}
                    color={COLORS.primaryLight || '#38BDF8'}
                  />
                  {/* Badged Red/Blue 'X' Circle */}
                  <View style={styles.badgeClose}>
                    <Ionicons name="close" size={12} color="#FFFFFF" />
                  </View>
                </View>
              </View>

              {/* Phone Home Button */}
              <View style={styles.phoneHomeBtn} />
            </View>
          </View>

          {/* Heading */}
          <Text style={styles.title}>You're offline</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            Please connect to the internet and try again.
          </Text>

          {/* Try Again Button (Whiteswan Blue Design) */}
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleTryAgain}
            activeOpacity={0.85}
            disabled={isChecking}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons name="sync" size={18} color="#FFFFFF" />
              </Animated.View>
            )}
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 999999,
    elevation: 999999,
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationWrapper: {
    position: 'relative',
    width: 200,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  ambientGlow: {
    position: 'absolute',
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: 'rgba(0, 163, 232, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.16)',
  },
  sparkleTopLeft: {
    position: 'absolute',
    top: 24,
    left: 20,
  },
  sparkleTopRight: {
    position: 'absolute',
    top: 28,
    right: 28,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
  },
  sparkleBottomRight: {
    position: 'absolute',
    bottom: 24,
    right: 18,
  },
  phoneBody: {
    width: 126,
    height: 202,
    borderRadius: 26,
    backgroundColor: '#0E131F',
    borderWidth: 2.5,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    shadowColor: '#00A3E8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 10,
  },
  phoneSpeaker: {
    width: 28,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#334155',
  },
  phoneScreen: {
    flex: 1,
    width: '88%',
    backgroundColor: '#080C14',
    borderRadius: 16,
    marginVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wifiCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0, 163, 232, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeClose: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#080C14',
  },
  phoneHomeBtn: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
    maxWidth: 290,
  },
  retryButton: {
    backgroundColor: '#00A3E8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 8,
    shadowColor: '#00A3E8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});

export default OfflineScreen;
