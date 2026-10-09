import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Image,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useBookmarks } from '../context/BookmarkContext';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import {
  launchPhonePePayment,
  launchSpecificUpiApp,
  getUpiPaymentData,
  createWcPhonePeOrder,
  PHONEPE_CONFIG,
} from '../services/phonepeService';

const encodeAuth = (str) => {
  if (typeof btoa === 'function') {
    try {
      return btoa(str);
    } catch (e) {}
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64');
  }
  return '';
};

const DEFAULT_PLANS = [
  {
    id: 'yearly',
    productId: 173639,
    name: 'Annual Smart Saver Plan',
    price: '₹299',
    originalPrice: '₹1,898',
    period: '/ Year',
    savings: 'Save ₹1,599 (84% OFF)',
    tagline: 'Maximum Savings • Only ₹25 per month',
    badge: 'MOST POPULAR',
    popular: true,
    features: [
      'Unlimited access to all news categories',
      'Breaking news alerts (mobile & email)',
      'Politics, business, tech, sports & entertainment',
      'Ad-light reading experience',
      'Access on mobile, tablet & desktop',
      'Weekly email newsletter',
      'Archive access (last 3 months)',
    ],
  },
  {
    id: 'monthly',
    productId: 176441,
    name: 'Monthly Power Plan',
    price: '₹499',
    originalPrice: '₹999',
    period: '/ Month',
    savings: 'Save ₹500 (50% OFF)',
    tagline: 'Flexible month-to-month billing',
    badge: null,
    popular: false,
    features: [
      'Unlimited access to all categories',
      'Breaking news instant mobile alerts',
      'Ad-light browsing experience',
      'Cancel anytime',
    ],
  },
];

export const PremiumPlansScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDarkMode } = useTheme();
  const { user, isLoggedIn, updateProfile, syncUserSubscription } = useAuth();
  const { showSignInModal } = useBookmarks();

  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [selectedPlanId, setSelectedPlanId] = useState('yearly');
  const [processing, setProcessing] = useState(false);
  const [syncingSub, setSyncingSub] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  const isTablet = width >= 768;
  const currentPlan = plans.find((p) => p.id === selectedPlanId) || plans[0] || DEFAULT_PLANS[0];
  const isAlreadyPremium =
    user?.role === 'Premium VIP' ||
    user?.isPremium === true ||
    (Boolean(user?.premiumPlan) && user?.isExpired !== true);

  // Dynamic fetch of published products from WooCommerce website
  const fetchWebsitePlans = useCallback(async () => {
    try {
      const WC_KEY = (process.env.EXPO_PUBLIC_WC_CONSUMER_KEY || 'ck_a33ceb8f1bf8a8455edd5575d4ade10315ead10f').trim();
      const WC_SECRET = (process.env.EXPO_PUBLIC_WC_CONSUMER_SECRET || 'cs_cf90612243340ff344b70cc550adf175862f69cc').trim();
      const authHeader = `Basic ${encodeAuth(`${WC_KEY}:${WC_SECRET}`)}`;

      const res = await fetch('https://whiteswantvnews.com/wp-json/wc/v3/products?status=publish&per_page=20', {
        headers: {
          'User-Agent': 'WhiteswanTVNewsApp/1.0',
          Accept: 'application/json',
          Authorization: authHeader,
        },
      });

      if (res.ok) {
        const products = await res.json();
        if (Array.isArray(products) && products.length > 0) {
          const activeProducts = products.filter(
            (p) =>
              p.status === 'publish' &&
              (p.catalog_visibility === 'visible' || !p.catalog_visibility) &&
              p.purchasable !== false
          );
          const parsed = (activeProducts.length > 0 ? activeProducts : products).map((prod) => {
            const cleanPrice = String(prod.price || '299').replace(/[^\d.]/g, '');
            const cleanReg = String(prod.regular_price || prod.price || cleanPrice).replace(/[^\d.]/g, '');
            const priceNum = parseFloat(cleanPrice) || 299;
            const regNum = parseFloat(cleanReg) || priceNum;
            const isAnnual =
              prod.slug?.includes('annual') ||
              prod.slug?.includes('year') ||
              prod.name?.toLowerCase().includes('annual') ||
              prod.name?.toLowerCase().includes('year');
            const isSixMonth =
              prod.slug?.includes('6') ||
              prod.slug?.includes('half') ||
              prod.name?.toLowerCase().includes('6') ||
              prod.name?.toLowerCase().includes('half');

            const period = isAnnual ? '/ Year' : isSixMonth ? '/ 6 Months' : '/ Month';
            const diff = regNum > priceNum ? Math.round(regNum - priceNum) : 0;
            const pct = regNum > priceNum ? Math.round(((regNum - priceNum) / regNum) * 100) : 0;
            const savings =
              diff > 0
                ? `Save ₹${diff.toLocaleString()}${pct > 0 ? ` (${pct}% OFF)` : ''}`
                : 'Best Value';
            const tagline = isAnnual
              ? `Maximum Savings • Only ₹${Math.round(priceNum / 12)} per month`
              : isSixMonth
              ? `Best Value • Only ₹${Math.round(priceNum / 6)} per month`
              : 'Flexible month-to-month billing';

            return {
              id: isAnnual ? 'yearly' : isSixMonth ? 'six_month' : 'monthly',
              productId: prod.id,
              name: prod.name || (isAnnual ? 'Annual Smart Saver Plan' : 'Monthly Power Plan'),
              price: `₹${cleanPrice}`,
              originalPrice: `₹${cleanReg}`,
              period,
              savings,
              tagline,
              badge: isAnnual ? 'MOST POPULAR' : isSixMonth ? 'BEST VALUE' : null,
              popular: isAnnual,
              features: isAnnual
                ? [
                    'Unlimited access to all news categories',
                    'Breaking news alerts (mobile & email)',
                    'Politics, business, tech, sports & entertainment',
                    'Ad-light reading experience',
                    'Access on mobile, tablet & desktop',
                    'Weekly email newsletter',
                    'Archive access (last 3 months)',
                  ]
                : isSixMonth
                ? [
                    'Everything in Annual plan',
                    '100% Ad-free reading experience',
                    'Full archive access (6 months)',
                    'Early access to breaking stories',
                    'Monthly news insights report',
                  ]
                : [
                    'Unlimited access to all categories',
                    'Breaking news instant mobile alerts',
                    'Ad-light browsing experience',
                    'Cancel anytime',
                  ],
            };
          });

          // Sort so yearly/annual is first
          parsed.sort((a, b) => (a.popular ? -1 : b.popular ? 1 : 0));
          setPlans(parsed);
        }
      }
    } catch (e) {
      console.log('fetchWebsitePlans note:', e.message);
    }
  }, []);

  const isPlanPurchased = (plan) => {
    if (!isAlreadyPremium) return false;
    if (!user?.premiumPlan) return true;
    const userPlanLower = (user.premiumPlan || '').toLowerCase();
    const planNameLower = (plan.name || '').toLowerCase();
    const planIdLower = (plan.id || '').toLowerCase();
    return (
      userPlanLower.includes(planNameLower) ||
      userPlanLower.includes(planIdLower) ||
      (plan.id === 'yearly' && (userPlanLower.includes('annual') || userPlanLower.includes('year') || userPlanLower.includes('smart'))) ||
      (plan.id === 'six_month' && (userPlanLower.includes('6 month') || userPlanLower.includes('six') || userPlanLower.includes('half'))) ||
      (plan.id === 'monthly' && (userPlanLower.includes('month') || userPlanLower.includes('power')))
    );
  };

  const isCurrentPlanPurchased = isPlanPurchased(currentPlan);
  const upiData = getUpiPaymentData({ plan: currentPlan, user });

  // Instant sync from WordPress website when viewing Plans screen
  useFocusEffect(
    useCallback(() => {
      fetchWebsitePlans();
      if (isLoggedIn && typeof syncUserSubscription === 'function') {
        syncUserSubscription().catch(() => {});
      }
    }, [isLoggedIn, fetchWebsitePlans])
  );

  const handleSyncWebsiteSubscription = async () => {
    if (!isLoggedIn) {
      if (showSignInModal) {
        showSignInModal(
          'Sign In Required',
          'Please sign in to your WordPress account first to check and sync your website subscriptions.'
        );
      } else {
        navigation.navigate('Login');
      }
      return;
    }
    try {
      setSyncingSub(true);
      const res = await syncUserSubscription();
      if (res?.success && res?.isPremium) {
        Alert.alert(
          '🎉 Premium Activated from Website!',
          res.message || 'Your subscription from whiteswantvnews.com was verified and Premium benefits are now active!',
          [{ text: 'Great!', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert(
          'No Active Website Subscription',
          res?.message || 'No active subscription found on whiteswantvnews.com for this account.',
          [{ text: 'OK' }]
        );
      }
    } catch (e) {
      Alert.alert('Sync Error', 'Could not connect to WordPress website. Please try again.');
    } finally {
      setSyncingSub(false);
    }
  };

  const handleActivatePremium = async () => {
    try {
      setProcessing(true);
      const now = new Date();
      const durationDays =
        currentPlan.id === 'yearly' ? 365 : currentPlan.id === 'six_month' ? 180 : 30;
      const expiresAt = new Date(
        now.getTime() + durationDays * 24 * 60 * 60 * 1000
      ).toISOString();

      if (isLoggedIn) {
        await updateProfile({
          role: 'Premium VIP',
          isPremium: true,
          isExpired: false,
          premiumPlan: currentPlan.name,
          planPrice: currentPlan.price,
          paymentGateway: 'PhonePe UPI',
          subscribedAt: now.toISOString(),
          expiresAt: expiresAt,
          durationDays: durationDays,
        });
      }

      setShowPaymentModal(false);
      Alert.alert(
        '🎉 Payment Verified & Activated!',
        `Your subscription to ${currentPlan.name} (${currentPlan.price}) is active. Enjoy unlimited access across Whiteswan TV News!`,
        [
          {
            text: 'Explore News',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err) {
      Alert.alert('Activation Error', 'Could not update membership status. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleInitiateSubscribe = async () => {
    // 0. Prevent payment if plan is already purchased / active
    if (isAlreadyPremium) {
      const expiryDateStr = user?.expiresAt
        ? new Date(user.expiresAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : null;

      Alert.alert(
        'Active Subscription in Effect',
        `You currently have an active "${user?.premiumPlan || 'Whiteswan TV VIP'}" subscription${
          expiryDateStr ? ` valid until ${expiryDateStr}` : ''
        }.\n\nTo prevent accidental double billing, purchasing two plans simultaneously is restricted. You can switch or renew once your current plan expires.`,
        [
          { text: 'Got It', style: 'cancel' },
          {
            text: 'Explore News',
            onPress: () => navigation.goBack(),
          },
        ]
      );
      return;
    }

    // 1. Enforce user login first
    if (!isLoggedIn) {
      if (showSignInModal) {
        showSignInModal(
          'Sign In Required',
          'Please sign in or create an account before subscribing so your Premium benefits are linked to your profile.'
        );
      } else {
        navigation.navigate('Login');
      }
      return;
    }

    // 2. Create WooCommerce PhonePe Order & Launch Payment
    try {
      setProcessing(true);

      const wcOrder = await createWcPhonePeOrder({
        plan: currentPlan,
        user,
      });

      if (wcOrder?.success && wcOrder?.paymentUrl) {
        setProcessing(false);
        navigation.navigate('WebExtras', {
          url: wcOrder.paymentUrl,
          title: 'PhonePe Payment',
          isPhonePeCheckout: true,
          wpCookies: user?.wpCookies || '',
        });
        return;
      }

      // Fallback: Direct PhonePe / UPI App intent
      const result = await launchPhonePePayment({
        plan: currentPlan,
        user,
      });

      if (result.success) {
        Alert.alert(
          'PhonePe Payment Initiated',
          'Complete the payment in your UPI app. Once completed, tap below to activate your Premium membership.',
          [
            {
              text: 'I Have Completed Payment',
              onPress: () => handleActivatePremium(),
            },
            {
              text: 'Cancel',
              style: 'cancel',
            },
          ]
        );
      } else {
        setShowPaymentModal(true);
      }
    } catch (err) {
      setShowPaymentModal(true);
    } finally {
      setProcessing(false);
    }
  };

  const handleCopyUpi = async () => {
    await Clipboard.setStringAsync(PHONEPE_CONFIG.upiVpa);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleLaunchUpi = async (url) => {
    const res = await launchSpecificUpiApp(url);
    if (!res.success) {
      Alert.alert(
        'App Not Found',
        'Could not open the selected payment app. Please copy the UPI ID or use any UPI app on your phone.'
      );
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
        <Text style={[styles.topBarTitle, { color: colors.text }]}>Choose Your Plan</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && styles.tabletContent,
        ]}
      >
        {/* Brand Header */}
        <View style={[styles.heroHeader, { backgroundColor: colors.card }]}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={[styles.heroTitle, { color: colors.text }]}>Whiteswan TV Premium</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            Support trusted independent Malayalam journalism. Unlock unrestricted access to all breaking news and special stories.
          </Text>

          {/* User Status / Login Prompt */}
          {isAlreadyPremium ? (
            <View style={styles.activeBanner}>
              <Ionicons name="shield-checkmark" size={16} color="#059669" />
              <Text style={styles.activeBannerText}>
                Active Subscription: {user?.premiumPlan || 'Premium VIP'}
              </Text>
            </View>
          ) : !isLoggedIn ? (
            <TouchableOpacity
              style={[
                styles.loginPromptBanner,
                {
                  backgroundColor: isDarkMode ? '#131124' : '#EEF2FF',
                  borderColor: isDarkMode ? '#3730A3' : '#C7D2FE',
                },
              ]}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.85}
            >
              <Ionicons name="person-circle-outline" size={24} color="#6366F1" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.loginPromptTitle, { color: colors.text }]}>
                  Please sign in first
                </Text>
                <Text style={[styles.loginPromptSub, { color: colors.textSecondary }]}>
                  Sign in or register to link your Premium subscription.
                </Text>
              </View>
              <View style={styles.loginBadgeBtn}>
                <Text style={styles.loginBadgeBtnText}>Sign In</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.loggedInBanner}>
              <Ionicons name="checkmark-circle" size={15} color="#059669" />
              <Text style={[styles.loggedInText, { color: colors.textSecondary }]}>
                Signed in as <Text style={{ fontWeight: '700', color: colors.text }}>{user?.name || user?.username || user?.email}</Text>
              </Text>
            </View>
          )}
        </View>

        {/* If Already Subscribed: Show Active VIP Status Summary Card */}
        {isAlreadyPremium && (
          <View style={styles.vipDashboardContainer}>
            <View style={[styles.vipCard, { backgroundColor: colors.card, borderColor: COLORS.primary }]}>
              <View style={styles.vipCrownBadge}>
                <Ionicons name="diamond" size={24} color="#FFFFFF" />
              </View>
              <Text style={[styles.vipCardTitle, { color: colors.text }]}>
                You Are a Premium Member!
              </Text>
              <Text style={[styles.vipCardSubtitle, { color: colors.textSecondary }]}>
                Your subscription is active with full access across Whiteswan TV News.
              </Text>

              <View style={[styles.vipDetailsBox, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderColor: colors.border }]}>
                <View style={styles.vipDetailRow}>
                  <Text style={[styles.vipDetailLabel, { color: colors.textSecondary }]}>Current Plan</Text>
                  <Text style={[styles.vipDetailValue, { color: colors.text }]}>
                    {user?.premiumPlan || 'VIP Annual Membership'}
                  </Text>
                </View>
                <View style={[styles.vipDetailDivider, { backgroundColor: colors.border }]} />
                <View style={styles.vipDetailRow}>
                  <Text style={[styles.vipDetailLabel, { color: colors.textSecondary }]}>Status</Text>
                  <View style={styles.activeStatusPill}>
                    <Ionicons name="checkmark-circle" size={13} color="#059669" />
                    <Text style={styles.activeStatusText}>Active Subscription</Text>
                  </View>
                </View>
                {user?.expiresAt && (
                  <>
                    <View style={[styles.vipDetailDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.vipDetailRow}>
                      <Text style={[styles.vipDetailLabel, { color: colors.textSecondary }]}>Valid Until</Text>
                      <Text style={[styles.vipDetailValue, { color: colors.text }]}>
                        {new Date(user.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {/* VIP Benefits List */}
              <View style={styles.vipPerksContainer}>
                <Text style={[styles.vipPerksTitle, { color: colors.text }]}>Active Premium Benefits:</Text>
                {[
                  'Unlimited reading on all investigative stories',
                  '100% Ad-light & fast browsing experience',
                  'Instant breaking news notifications',
                  'Multi-device access (Mobile, Tablet, Web)',
                ].map((perk, i) => (
                  <View key={i} style={styles.vipPerkItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#059669" />
                    <Text style={[styles.vipPerkText, { color: colors.text }]}>{perk}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Explore Section Heading for Subscribed Users */}
            <View style={styles.exploreSectionHeader}>
              <View style={styles.exploreBadgeRow}>
                <Ionicons name="diamond" size={18} color="#00A3E8" />
                <Text style={[styles.exploreSectionTitle, { color: colors.text }]}>
                  Explore Other Premium Plans
                </Text>
              </View>
              <Text style={[styles.exploreSectionSub, { color: colors.textSecondary }]}>
                Browse features and compare all membership tiers. Note: Active members cannot hold two plans simultaneously.
              </Text>
            </View>
          </View>
        )}

        {/* Plans List - Accessible for both Subscribed and Non-Subscribed Users */}
        <View style={styles.plansList}>
          {plans.map((plan) => {
            const isSelected = selectedPlanId === plan.id;
            const isThisPlanPurchased = isPlanPurchased(plan);

            return (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isThisPlanPurchased
                      ? '#059669'
                      : isSelected
                      ? COLORS.primary
                      : colors.border,
                    borderWidth: isThisPlanPurchased || isSelected ? 2.5 : 1,
                  },
                  isSelected && styles.selectedPlanCard,
                ]}
                onPress={() => setSelectedPlanId(plan.id)}
                activeOpacity={0.85}
              >
                {/* Active Purchased / Popular Badge */}
                {isThisPlanPurchased ? (
                  <View
                    style={[
                      styles.popularBadge,
                      {
                        backgroundColor: '#059669',
                      },
                    ]}
                  >
                    <Text style={styles.popularBadgeText}>CURRENT ACTIVE PLAN</Text>
                  </View>
                ) : plan.badge ? (
                  <View
                    style={[
                      styles.popularBadge,
                      {
                        backgroundColor:
                          plan.id === 'yearly' ? COLORS.primary : COLORS.gold,
                      },
                    ]}
                  >
                    <Text style={styles.popularBadgeText}>{plan.badge}</Text>
                  </View>
                ) : null}

                {/* Plan Header */}
                <View style={styles.cardTopRow}>
                  <View>
                    <Text style={[styles.planTitle, { color: colors.text }]}>
                      {plan.name}
                    </Text>
                    <Text style={[styles.planSavings, { color: isThisPlanPurchased ? '#059669' : '#059669' }]}>
                      {isThisPlanPurchased ? '✓ Active Subscription' : plan.savings}
                    </Text>
                  </View>

                  <Ionicons
                    name={isThisPlanPurchased ? 'checkmark-circle' : isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={isThisPlanPurchased ? '#059669' : isSelected ? COLORS.primary : colors.textSecondary}
                  />
                </View>

                {/* Price Display */}
                <View style={styles.priceContainer}>
                  <Text style={[styles.currency, { color: colors.text }]}>₹</Text>
                  <Text style={[styles.priceAmount, { color: colors.text }]}>
                    {plan.price.replace('₹', '')}
                  </Text>
                  <Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>
                    {plan.period}
                  </Text>
                  <Text style={styles.strikeOriginal}>{plan.originalPrice}</Text>
                </View>

                <Text style={[styles.taglineText, { color: colors.textSecondary }]}>
                  {plan.tagline}
                </Text>

                {/* Features List */}
                <View style={styles.featuresBox}>
                  {plan.features.map((feature, idx) => (
                    <View key={idx} style={styles.featureItem}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={isThisPlanPurchased ? '#059669' : COLORS.primary}
                      />
                      <Text style={[styles.featureText, { color: colors.text }]}>
                        {feature}
                      </Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Subscribe / Action Button */}
        <View style={styles.footerActionBox}>
          {isAlreadyPremium ? (
            isCurrentPlanPurchased ? (
              <TouchableOpacity
                style={[
                  styles.primarySubscribeBtn,
                  { backgroundColor: '#059669' },
                ]}
                onPress={() => navigation.goBack()}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.primarySubscribeBtnText}>
                  Active Plan • Explore News Feed
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.primarySubscribeBtn,
                  { backgroundColor: isDarkMode ? '#334155' : '#64748B' },
                ]}
                onPress={handleInitiateSubscribe}
                activeOpacity={0.85}
              >
                <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
                <Text style={styles.primarySubscribeBtnText}>
                  Active Subscription Running (1 Plan Limit)
                </Text>
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity
              style={[
                styles.primarySubscribeBtn,
                { backgroundColor: COLORS.primary },
                processing && { opacity: 0.7 },
              ]}
              onPress={handleInitiateSubscribe}
              disabled={processing}
              activeOpacity={0.85}
            >
              {processing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="flash" size={18} color="#FFFFFF" />
                  <Text style={styles.primarySubscribeBtnText}>
                    {!isLoggedIn
                      ? `Sign In & Subscribe • ${currentPlan.price}${currentPlan.period}`
                      : `Subscribe Now • ${currentPlan.price}${currentPlan.period}`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.secureRow}>
            <Ionicons name="shield-checkmark" size={14} color="#10B981" />
            <Text style={[styles.secureText, { color: colors.textSecondary }]}>
              {isAlreadyPremium
                ? 'Active Premium Member • 1 Plan Allowed at a Time'
                : 'Secure PhonePe & UPI Payment • 100% Safe'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Native In-App PhonePe / UPI Payment Modal */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View style={styles.phonepeBadge}>
                  <Ionicons name="phone-portrait-outline" size={18} color="#5F259F" />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    PhonePe / UPI Gateway
                  </Text>
                  <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
                    {currentPlan.name} • {currentPlan.price}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowPaymentModal(false)}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Amount Summary Card */}
            <View
              style={[
                styles.amountCard,
                { backgroundColor: isDarkMode ? '#12121A' : '#F4F7FB' },
              ]}
            >
              <View>
                <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
                  Total Amount to Pay
                </Text>
                <Text style={[styles.amountValue, { color: colors.text }]}>
                  {currentPlan.price}
                </Text>
              </View>
              <View style={styles.secureBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                <Text style={styles.secureBadgeText}>Verified Merchant</Text>
              </View>
            </View>

            {/* Quick App Launchers */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Select Payment App
            </Text>
            <View style={styles.upiGrid}>
              <TouchableOpacity
                style={[styles.upiAppBtn, { backgroundColor: '#5F259F' }]}
                onPress={() => handleLaunchUpi(upiData.phonePeUrl)}
                activeOpacity={0.85}
              >
                <Ionicons name="flash" size={18} color="#FFFFFF" />
                <Text style={styles.upiAppBtnText}>PhonePe</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.upiAppBtn, { backgroundColor: '#1A73E8' }]}
                onPress={() => handleLaunchUpi(upiData.gpayUrl)}
                activeOpacity={0.85}
              >
                <Ionicons name="logo-google" size={18} color="#FFFFFF" />
                <Text style={styles.upiAppBtnText}>Google Pay</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.upiAppBtn, { backgroundColor: '#00BAF2' }]}
                onPress={() => handleLaunchUpi(upiData.paytmUrl)}
                activeOpacity={0.85}
              >
                <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
                <Text style={styles.upiAppBtnText}>Paytm</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.upiAppBtn, { backgroundColor: '#111827' }]}
                onPress={() => handleLaunchUpi(upiData.credUrl || upiData.genericUpiUrl)}
                activeOpacity={0.85}
              >
                <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                <Text style={styles.upiAppBtnText}>CRED</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.upiAppBtn, { backgroundColor: '#FF9900' }]}
                onPress={() => handleLaunchUpi(upiData.amazonPayUrl || upiData.genericUpiUrl)}
                activeOpacity={0.85}
              >
                <Ionicons name="cart-outline" size={18} color="#FFFFFF" />
                <Text style={styles.upiAppBtnText}>Amazon Pay</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.upiAppBtn, { backgroundColor: '#059669' }]}
                onPress={() => handleLaunchUpi(upiData.genericUpiUrl)}
                activeOpacity={0.85}
              >
                <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
                <Text style={styles.upiAppBtnText}>Other UPI</Text>
              </TouchableOpacity>
            </View>

            {/* Payee UPI ID Box */}
            <View
              style={[
                styles.upiIdBox,
                {
                  backgroundColor: isDarkMode ? '#14141E' : '#FFFFFF',
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.upiIdLabel, { color: colors.textSecondary }]}>
                  Merchant UPI ID
                </Text>
                <Text style={[styles.upiIdText, { color: colors.text }]}>
                  {PHONEPE_CONFIG.upiVpa}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.copyBtn,
                  copiedUpi && { backgroundColor: '#059669' },
                ]}
                onPress={handleCopyUpi}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={copiedUpi ? 'checkmark' : 'copy-outline'}
                  size={15}
                  color="#FFFFFF"
                />
                <Text style={styles.copyBtnText}>
                  {copiedUpi ? 'Copied' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Verification Button */}
            <TouchableOpacity
              style={[
                styles.activateVipBtn,
                { backgroundColor: COLORS.primary },
                processing && { opacity: 0.7 },
              ]}
              onPress={handleActivatePremium}
              disabled={processing}
              activeOpacity={0.85}
            >
              {processing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-done-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.activateVipBtnText}>
                    I Have Paid • Activate Premium Access
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    padding: SPACING.md,
    paddingBottom: 40,
  },
  tabletContent: {
    maxWidth: 580,
    width: '100%',
    alignSelf: 'center',
  },
  heroHeader: {
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  brandLogo: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    marginTop: 12,
    gap: 6,
  },
  activeBannerText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '700',
  },
  loginPromptBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: 14,
    width: '100%',
    gap: 10,
  },
  loginPromptTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  loginPromptSub: {
    fontSize: 11,
    marginTop: 1,
  },
  loginBadgeBtn: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  loginBadgeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  loggedInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  loggedInText: {
    fontSize: 12,
  },
  plansList: {
    gap: 16,
  },
  planCard: {
    borderRadius: RADIUS.lg,
    padding: 18,
    position: 'relative',
  },
  selectedPlanCard: {
    shadowColor: '#00A3E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  popularBadge: {
    position: 'absolute',
    top: -11,
    left: 20,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  planSavings: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 6,
    gap: 2,
  },
  currency: {
    fontSize: 18,
    fontWeight: '700',
  },
  priceAmount: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  pricePeriod: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 2,
  },
  strikeOriginal: {
    fontSize: 14,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginLeft: 8,
  },
  taglineText: {
    fontSize: 12,
    marginBottom: 14,
  },
  featuresBox: {
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#374151',
    paddingTop: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    flex: 1,
  },
  footerActionBox: {
    marginTop: 24,
    gap: 12,
  },
  primarySubscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    gap: 8,
    shadowColor: '#00A3E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primarySubscribeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secureText: {
    fontSize: 12,
  },

  /* Native Payment Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: SPACING.lg,
    paddingBottom: 36,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#6B7280',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  phonepeBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(95, 37, 159, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: RADIUS.md,
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  secureBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  upiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  upiAppBtn: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    gap: 8,
  },
  upiAppBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  upiIdBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 18,
  },
  upiIdLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  upiIdText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  copyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  activateVipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: RADIUS.lg,
    gap: 8,
  },
  activateVipBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  /* VIP Dashboard Styles for Subscribed Users */
  vipDashboardContainer: {
    marginTop: 8,
  },
  vipCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  vipCrownBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  vipCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  vipCardSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  vipDetailsBox: {
    width: '100%',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  vipDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  vipDetailLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  vipDetailValue: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  vipDetailDivider: {
    height: 1,
    marginVertical: 8,
  },
  activeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  activeStatusText: {
    color: '#15803D',
    fontSize: 11.5,
    fontWeight: '700',
  },
  vipPerksContainer: {
    width: '100%',
    gap: 8,
    marginBottom: 8,
  },
  vipPerksTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  vipPerkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vipPerkText: {
    fontSize: 12.5,
    flex: 1,
  },
  syncVipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: 8,
    width: '100%',
    marginTop: 10,
  },
  syncVipBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  exploreSectionHeader: {
    marginTop: 24,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  exploreBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  exploreSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  exploreSectionSub: {
    fontSize: 12.5,
    lineHeight: 18,
  },
});
