import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import {
  subscribeToNewsletter,
  shouldShowNewsletterPopup,
  markPopupDismissed,
} from '../services/newsletterService';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const NewsletterPopup = ({
  visible: controlledVisible,
  onClose: controlledOnClose,
  autoTrigger = true,
  delayMs = 2500,
}) => {
  const { colors, isDarkMode } = useTheme();

  const [internalVisible, setInternalVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'warning' | 'error', message: string }
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.92));

  // Determine effective visibility
  const isVisible = controlledVisible !== undefined ? controlledVisible : internalVisible;

  useEffect(() => {
    let timer;
    if (autoTrigger && controlledVisible === undefined) {
      shouldShowNewsletterPopup(30).then((shouldShow) => {
        if (shouldShow) {
          timer = setTimeout(() => {
            setInternalVisible(true);
          }, delayMs);
        }
      });
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [autoTrigger, controlledVisible, delayMs]);

  useEffect(() => {
    if (isVisible) {
      setStatus(null);
      setEmail('');
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.92);
    }
  }, [isVisible]);

  const handleClose = async () => {
    await markPopupDismissed();
    if (controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalVisible(false);
    }
  };

  const handleSubmit = async () => {
    if (!email || !email.trim()) {
      setStatus({
        type: 'error',
        message: 'Please enter your email address.',
      });
      return;
    }

    setLoading(true);
    setStatus(null);
    Keyboard.dismiss();

    try {
      const res = await subscribeToNewsletter(email);

      if (res.success) {
        setStatus({
          type: 'success',
          message: res.message || 'Thank you! You have successfully subscribed.',
        });
        setTimeout(() => {
          handleClose();
        }, 1800);
      } else if (res.isAlreadySubscribed) {
        setStatus({
          type: 'warning',
          message: res.message || 'You are already subscribed to our newsletter!',
        });
        setTimeout(() => {
          handleClose();
        }, 2200);
      } else {
        setStatus({
          type: 'error',
          message: res.message || 'Subscription failed. Please try again.',
        });
      }
    } catch (err) {
      setStatus({
        type: 'error',
        message: 'Something went wrong. Please check your connection.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardWrap}
          >
            <Animated.View
              style={[
                styles.card,
                {
                  backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                  borderColor: isDarkMode ? '#334155' : '#f1f5f9',
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              {/* Top-Right Red/Pink Close Button */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                activeOpacity={0.8}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={18} color="#ffffff" />
              </TouchableOpacity>

              {/* Brand Logo */}
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              {/* Title in Malayalam */}
              <Text
                style={[
                  styles.title,
                  { color: isDarkMode ? '#f8fafc' : '#0f172a' },
                ]}
              >
                📢 വാർത്തകൾ ഇനി നിങ്ങളെ തേടിയെത്തും!
              </Text>

              {/* Subtitle description in Malayalam */}
              <Text
                style={[
                  styles.description,
                  { color: isDarkMode ? '#cbd5e1' : '#475569' },
                ]}
              >
                ഏറ്റവും പുതിയ വാർത്തകളും ബ്രേക്കിംഗ് ന്യൂസുകളും പ്രധാന അപ്ഡേറ്റുകളും ഉടൻ അറിയാൻ ഞങ്ങളോടൊപ്പം ചേരു.
              </Text>

              {/* Status Alert Banner */}
              {status && (
                <View
                  style={[
                    styles.statusBanner,
                    status.type === 'success' && styles.statusSuccess,
                    status.type === 'warning' && styles.statusWarning,
                    status.type === 'error' && styles.statusError,
                  ]}
                >
                  <Ionicons
                    name={
                      status.type === 'success'
                        ? 'checkmark-circle'
                        : status.type === 'warning'
                        ? 'alert-circle'
                        : 'close-circle'
                    }
                    size={16}
                    color={
                      status.type === 'success'
                        ? '#16a34a'
                        : status.type === 'warning'
                        ? '#d97706'
                        : '#dc2626'
                    }
                  />
                  <Text
                    style={[
                      styles.statusText,
                      status.type === 'success' && styles.statusTextSuccess,
                      status.type === 'warning' && styles.statusTextWarning,
                      status.type === 'error' && styles.statusTextError,
                    ]}
                  >
                    {status.message}
                  </Text>
                </View>
              )}

              {/* Input Form */}
              <View style={styles.form}>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                      borderColor: isDarkMode ? '#475569' : '#cbd5e1',
                    },
                  ]}
                >
                  <TextInput
                    style={[
                      styles.input,
                      { color: isDarkMode ? '#f8fafc' : '#0f172a' },
                    ]}
                    placeholder="Email"
                    placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      if (status) setStatus(null);
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                    editable={!loading}
                  />
                </View>

                {/* SUBSCRIBE Button */}
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    loading && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.submitButtonText}>SUBSCRIBE</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  keyboardWrap: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 20,
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#ff5b77',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#ff5b77',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  logoContainer: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 170,
    height: 48,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 27,
    letterSpacing: 0.2,
  },
  description: {
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  form: {
    width: '100%',
    gap: 12,
  },
  inputContainer: {
    width: '100%',
    height: 48,
    borderWidth: 1.2,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  input: {
    fontSize: 15,
    width: '100%',
    height: '100%',
  },
  submitButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#01a2e4',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#01a2e4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 14,
    gap: 8,
  },
  statusSuccess: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1,
  },
  statusWarning: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
  },
  statusError: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
  },
  statusText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
  },
  statusTextSuccess: {
    color: '#15803d',
  },
  statusTextWarning: {
    color: '#b45309',
  },
  statusTextError: {
    color: '#b91c1c',
  },
});
