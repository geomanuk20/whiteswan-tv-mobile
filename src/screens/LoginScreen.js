import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const LoginScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDarkMode } = useTheme();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isTablet = width >= 768;

  const handleLogin = async () => {
    setErrorMessage('');
    if (!identifier.trim() || !password) {
      setErrorMessage('Please enter your WordPress username or email and password.');
      return;
    }

    try {
      setLoading(true);
      await login(identifier, password);
      navigation.goBack();
    } catch (err) {
      setErrorMessage(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header Bar */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Math.max(insets.top, 12) + 4,
            borderBottomColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.text }]}>Sign In</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            isTablet && styles.tabletContent,
          ]}
        >
          {/* Logo & Welcome */}
          <View style={styles.brandHeader}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.welcomeTitle, { color: colors.text }]}>
              Welcome Back
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
              Sign in with your Whiteswan TV website credentials or mobile account.
            </Text>
          </View>

          {/* Error Banner */}
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={20} color="#EF4444" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                {(errorMessage.toLowerCase().includes('not registered') ||
                  errorMessage.toLowerCase().includes('no account') ||
                  errorMessage.toLowerCase().includes('register') ||
                  errorMessage.toLowerCase().includes('unknown')) && (
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate('Register', {
                        initialEmail: identifier.includes('@') ? identifier.trim() : '',
                        initialUsername: !identifier.includes('@') ? identifier.trim() : '',
                      })
                    }
                    style={styles.errorActionBtn}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="person-add" size={14} color="#FFFFFF" />
                    <Text style={styles.errorActionBtnText}>Register New Account</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : null}

          {/* Form */}
          <View style={styles.form}>
            {/* Identifier Field (Username or Email) */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Username or Email Address <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="e.g. username or name@example.com"
                  placeholderTextColor={colors.textMuted}
                  value={identifier}
                  onChangeText={(val) => {
                    setIdentifier(val);
                    setErrorMessage('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Password <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    setErrorMessage('');
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((prev) => !prev)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            {/* Register Link */}
            <View style={styles.registerPromptBox}>
              <Text style={[styles.registerPromptTitle, { color: colors.text }]}>
                New to Whiteswan TV?
              </Text>
              <Text style={[styles.registerPromptSubtitle, { color: colors.textSecondary }]}>
                Create an account to save articles and unlock personalized feeds.
              </Text>
              <TouchableOpacity
                style={[styles.createAccountBtn, { borderColor: COLORS.primary }]}
                onPress={() =>
                  navigation.navigate('Register', {
                    initialEmail: identifier.includes('@') ? identifier.trim() : '',
                    initialUsername: !identifier.includes('@') ? identifier.trim() : '',
                  })
                }
                activeOpacity={0.8}
              >
                <Ionicons name="person-add-outline" size={16} color={COLORS.primary} />
                <Text style={[styles.createAccountBtnText, { color: COLORS.primary }]}>
                  Create New Account
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  scrollContent: {
    padding: SPACING.xl,
    paddingBottom: 40,
  },
  tabletContent: {
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  logo: {
    width: 160,
    height: 48,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    gap: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  errorActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.sm,
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  errorActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    height: 48,
    borderRadius: RADIUS.full,
    gap: 8,
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  registerPromptBox: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
    gap: 8,
  },
  registerPromptTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  registerPromptSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  createAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: 20,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    gap: 6,
    marginTop: 6,
  },
  createAccountBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
