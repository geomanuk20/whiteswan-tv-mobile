import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const SignInPromptModal = ({
  visible = false,
  onClose,
  onSignIn,
  title = 'Sign In Required',
  subtitle = 'Please sign in or create an account to save news articles to your personal reading list.',
}) => {
  const { colors, isDarkMode } = useTheme();
  const { width } = useWindowDimensions();

  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.92));

  useEffect(() => {
    if (visible) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (_) {}

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.92);
    }
  }, [visible]);

  if (!visible) return null;

  const handleSignInPress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}
    if (onSignIn) {
      onSignIn();
    }
  };

  const handleCancelPress = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleCancelPress}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={handleCancelPress}>
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity: fadeAnim,
              backgroundColor: isDarkMode
                ? 'rgba(0, 0, 0, 0.78)'
                : 'rgba(2, 42, 98, 0.52)',
            },
          ]}
        >
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modalCard,
                {
                  backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                  borderColor: isDarkMode
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'rgba(0, 163, 232, 0.18)',
                  transform: [{ scale: scaleAnim }],
                  maxWidth: Math.min(width - 44, 380),
                },
              ]}
            >
              {/* Close 'X' button in top right */}
              <TouchableOpacity
                style={[
                  styles.closeButton,
                  {
                    backgroundColor: isDarkMode
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(0, 0, 0, 0.05)',
                  },
                ]}
                onPress={handleCancelPress}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={isDarkMode ? '#94A3B8' : '#64748B'}
                />
              </TouchableOpacity>

              {/* Title & Subtitle */}
              <Text
                style={[
                  styles.title,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                {title}
              </Text>

              <Text
                style={[
                  styles.subtitle,
                  { color: isDarkMode ? '#94A3B8' : '#475569' },
                ]}
              >
                {subtitle}
              </Text>

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                {/* Primary: Sign In / Register */}
                <TouchableOpacity
                  style={styles.signInButton}
                  onPress={handleSignInPress}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={['#00A3E8', '#0284C7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.signInGradient}
                  >
                    <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.signInButtonText}>
                      Sign In / Register
                    </Text>
                    <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>

                {/* Secondary: Cancel / Later */}
                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    {
                      borderColor: isDarkMode
                        ? 'rgba(255, 255, 255, 0.12)'
                        : 'rgba(0, 0, 0, 0.12)',
                    },
                  ]}
                  onPress={handleCancelPress}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.cancelButtonText,
                      { color: isDarkMode ? '#94A3B8' : '#64748B' },
                    ]}
                  >
                    Maybe Later
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1.5,
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#00A3E8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  signInButton: {
    width: '100%',
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    shadowColor: '#00A3E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  signInGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 8,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cancelButton: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
