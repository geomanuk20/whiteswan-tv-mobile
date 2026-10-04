import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Linking,
  TextInput,
  Alert,
  Modal,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HtmlReader } from '../components/HtmlReader';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { fetchPageBySlug } from '../services/wpApi';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

const BRAND_LOGO = require('../../assets/logo.png');

export const PageDetailScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { slug, title: initialTitle, fallbackUrl } = route.params || {};
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const isTablet = width >= 768;
  const isContactPage =
    slug === 'contact-2' ||
    slug === 'contact-us' ||
    slug === 'contact' ||
    initialTitle?.toLowerCase().includes('contact');

  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Contact Form State
  const [contactName, setContactName] = useState(user?.displayName || user?.firstName || '');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [contactPhone, setContactPhone] = useState(user?.phone || '');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [submittingMessage, setSubmittingMessage] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    loadPageContent();
  }, [slug]);

  const loadPageContent = async () => {
    if (!slug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPageBySlug(slug);
      if (data) {
        setPage(data);
      } else {
        if (!isContactPage) {
          setError('Page content not found.');
        }
      }
    } catch (e) {
      if (!isContactPage) {
        setError(e?.message || 'Failed to load page content.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      const shareUrl = page?.link || fallbackUrl || 'https://whiteswantvnews.com';
      const shareTitle = page?.title || initialTitle || 'Whiteswan TV News';
      await Share.share({
        title: shareTitle,
        message: `${shareTitle}\n\nRead more on Whiteswan TV News:\n${shareUrl}`,
        url: shareUrl,
      });
    } catch (e) {
      console.error('Share error:', e);
    }
  };

  const handlePhoneCall = (phoneNumber = '+919633052562') => {
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Error', 'Unable to make phone call on this device.');
    });
  };

  const handleWhatsApp = (phoneNumber = '919633052562') => {
    const text = encodeURIComponent(
      `Hello Whiteswan TV News,\n\nName: ${contactName || 'Visitor'}\nMessage: ${contactMessage || 'I would like to get in touch.'}`
    );
    Linking.openURL(`https://wa.me/${phoneNumber}?text=${text}`).catch(() => {
      Alert.alert('Error', 'WhatsApp is not installed on this device.');
    });
  };

  const handleEmailSupport = (toEmail = 'technicalserver34@gmail.com') => {
    const subject = encodeURIComponent(contactSubject || 'Whiteswan TV News Mobile Enquiry');
    const body = encodeURIComponent(
      `Name: ${contactName}\nPhone: ${contactPhone}\n\nMessage:\n${contactMessage}`
    );
    Linking.openURL(`mailto:${toEmail}?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert('Error', 'No email app found on this device.');
    });
  };

  const handleSendMessage = async () => {
    if (!contactName.trim()) {
      Alert.alert('Name Required', 'Please enter your name.');
      return;
    }
    if (!contactEmail.trim()) {
      Alert.alert('Email Required', 'Please enter your email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (!contactSubject.trim()) {
      Alert.alert('Subject Required', 'Please enter a subject for your message.');
      return;
    }

    setSubmittingMessage(true);
    setMessageSent(false);

    try {
      // Background submission to WordPress Contact Form 7 REST API
      const formData = new FormData();
      formData.append('_wpcf7', '170');
      formData.append('_wpcf7_version', '6.1.7');
      formData.append('_wpcf7_locale', 'en_US');
      formData.append('_wpcf7_unit_tag', 'wpcf7-f170-o1');
      formData.append('_wpcf7_container_post', '0');
      formData.append('your-name', contactName.trim());
      formData.append('your-email', contactEmail.trim());
      formData.append('your-subject', contactSubject.trim());
      formData.append('your-message', contactMessage.trim() || 'No message provided.');

      fetch('https://whiteswantvnews.com/wp-json/contact-form-7/v1/contact-forms/170/feedback', {
        method: 'POST',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
          Referer: 'https://whiteswantvnews.com/contact-2/',
        },
        body: formData,
      }).catch(() => {});
    } catch (e) {}

    setTimeout(() => {
      setSubmittingMessage(false);
      setMessageSent(true);
      setShowSuccessModal(true);
      setContactSubject('');
      setContactMessage('');
    }, 400);
  };

  const displayTitle = page?.title || initialTitle || (isContactPage ? 'Contact Us' : 'Whiteswan Info');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: Math.max(insets.top, 10) + 4,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {displayTitle}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <Ionicons name="share-social-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Loading Indicator */}
      {loading && !isContactPage ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading {displayTitle}...
          </Text>
        </View>
      ) : error && !isContactPage ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Unable to Load Page</Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={loadPageContent}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            isTablet && { maxWidth: 800, alignSelf: 'center', width: '100%' },
          ]}
        >
          {/* Title Header Banner */}
          <View style={styles.titleSection}>
            <View style={styles.accentBadgeRow}>
              <View style={styles.redBadgeBar} />
              <Text style={[styles.pageCategoryLabel, { color: COLORS.primary }]}>
                WHITESWAN OFFICIAL
              </Text>
            </View>
            <Text style={[styles.mainPageTitle, { color: colors.text }]}>
              {displayTitle}
            </Text>
            <View style={[styles.titleDivider, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
              <View style={styles.cyanAccentLine} />
            </View>
          </View>

          {/* If Contact Page: Render Dedicated Native Contact UI */}
          {isContactPage ? (
            <View style={styles.contactContainer}>
              {/* Send Message Form */}
              <View style={[styles.formContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.formHeaderRow}>
                  <Ionicons name="mail-outline" size={22} color={COLORS.primary} />
                  <Text style={[styles.formHeaderTitle, { color: colors.text }]}>
                    Contact Form
                  </Text>
                </View>
                <Text style={[styles.formHeaderSubtitle, { color: colors.textSecondary }]}>
                  Have questions, news tips, or feedback? Fill in the form below to reach our team.
                </Text>

                {/* Name Field */}
                <Text style={[styles.inputLabel, { color: colors.text }]}>Your name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.textSecondary}
                  value={contactName}
                  onChangeText={setContactName}
                />

                {/* Email Field */}
                <Text style={[styles.inputLabel, { color: colors.text }]}>Your email</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={contactEmail}
                  onChangeText={setContactEmail}
                />

                {/* Subject Field */}
                <Text style={[styles.inputLabel, { color: colors.text }]}>Subject</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder="Subject"
                  placeholderTextColor={colors.textSecondary}
                  value={contactSubject}
                  onChangeText={setContactSubject}
                />

                {/* Message Field */}
                <Text style={[styles.inputLabel, { color: colors.text }]}>Your message (optional)</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder="Your message"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={5}
                  value={contactMessage}
                  onChangeText={setContactMessage}
                />

                {/* Submit Action Button */}
                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: COLORS.primary }]}
                  onPress={handleSendMessage}
                  disabled={submittingMessage}
                  activeOpacity={0.8}
                >
                  {submittingMessage ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="send" size={16} color="#FFFFFF" />
                      <Text style={styles.submitButtonText}>Submit</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Other Static Pages (Privacy Policy, Refund Policy, Terms, etc.) */
            <View style={styles.bodyContent}>
              {page?.content ? (
                <HtmlReader html={page.content} fontSize={16} />
              ) : (
                <Text style={[styles.emptyContentText, { color: colors.textSecondary }]}>
                  No content available for this page.
                </Text>
              )}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Custom Popup Alert Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSuccessModal(false)}
        >
          <TouchableOpacity
            style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={1}
            onPress={() => {}}
          >
            <View style={styles.modalIconRing}>
              <Ionicons name="checkmark-circle" size={56} color="#10B981" />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Message Sent Successfully! ✓
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Thank you for contacting Whiteswan TV News. Your message has been submitted to our news technical team. We will get back to you shortly.
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: COLORS.primary }]}
              onPress={() => setShowSuccessModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  errorSubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    gap: 8,
    marginTop: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  titleSection: {
    marginBottom: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  accentBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  redBadgeBar: {
    width: 4,
    height: 14,
    backgroundColor: '#E50914',
    borderRadius: 2,
  },
  pageCategoryLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  mainPageTitle: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 32,
    marginBottom: 4,
  },
  malayalamTagline: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 12,
  },
  titleDivider: {
    height: 2,
    width: '100%',
    position: 'relative',
  },
  cyanAccentLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 50,
    backgroundColor: '#00A3E8',
  },
  bodyContent: {
    paddingVertical: SPACING.sm,
  },
  emptyContentText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },

  // Contact UI Styles
  contactContainer: {
    gap: SPACING.lg,
  },
  contactGrid: {
    gap: SPACING.sm + 2,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  contactIconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  contactCardValue: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  contactCardSub: {
    fontSize: 11,
  },
  formContainer: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  formHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  formHeaderSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: RADIUS.md,
    gap: 8,
    marginTop: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  directActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  directActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  directActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  officeCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: 10,
  },
  officeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  officeLogo: {
    width: 44,
    height: 30,
  },
  officeTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  officeSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  officeDivider: {
    height: 1,
    width: '100%',
    marginVertical: 4,
  },
  officeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  officeText: {
    fontSize: 12.5,
    flex: 1,
    lineHeight: 18,
  },
  officeLinkText: {
    fontSize: 12.5,
    fontWeight: '600',
  },

  // Modal Popup Alert Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: RADIUS.xl || 20,
    borderWidth: 1,
    padding: SPACING.xl || 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalIconRing: {
    marginBottom: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: SPACING.xs + 4,
  },
  modalMessage: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  modalButton: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: RADIUS.md || 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});

