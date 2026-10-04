import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Switch,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Linking,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useBookmarks } from '../context/BookmarkContext';
import { NewsletterPopup } from '../components/NewsletterPopup';
import { MarketingPackagesSection } from '../components/MarketingPackagesSection';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import {
  INDIAN_STATES,
  getStateName,
  getStateCode,
  COUNTRIES_LIST,
  getCountryCode,
  getCountryName,
} from '../constants/indianStates';

const ABOUT_PAGES = [
  {
    id: 'privacy-policy',
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    url: 'https://whiteswantvnews.com/privacy-policy/',
  },
  {
    id: 'refund-policy',
    slug: 'refund-policy',
    title: 'Refund Policy',
    url: 'https://whiteswantvnews.com/refund-policy/',
  },
  {
    id: 'terms-condition',
    slug: 'terms-of-service',
    title: 'Terms & condition',
    url: 'https://whiteswantvnews.com/terms-of-service/',
  },
  {
    id: 'advertise-with-us',
    slug: 'advertise-with-us',
    title: 'Advertise With Us',
    url: 'https://whiteswantvnews.com/advertise-with-us/',
  },
  {
    id: 'careers',
    slug: 'career',
    title: 'Careers',
    url: 'https://whiteswantvnews.com/career/',
  },
  {
    id: 'contact-us',
    slug: 'contact-2',
    title: 'Contact Us',
    url: 'https://whiteswantvnews.com/contact-2/',
  },
];

export const ProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const {
    user,
    isLoggedIn,
    logout,
    updateProfile,
    refreshUserData,
    fetchUserOrders,
    syncBillingAddress,
    syncShippingAddress,
    deleteBillingAddress,
    deleteShippingAddress,
    updateAccountDetails,
    syncUserSubscription,
  } = useAuth();
  const { bookmarks } = useBookmarks();

  const isTablet = width >= 768;

  const [refreshing, setRefreshing] = useState(false);
  const [syncingSub, setSyncingSub] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'orders' | 'addresses' | 'account' | 'subscriptions' | 'settings'

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (message, type = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Orders State
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Modals
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showShippingStatePicker, setShowShippingStatePicker] = useState(false);
  const [showShippingCountryPicker, setShowShippingCountryPicker] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Billing Address form fields
  const [firstName, setFirstName] = useState(user?.firstName || user?.address?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || user?.address?.lastName || '');
  const [country, setCountry] = useState(user?.country || user?.address?.country || 'India');
  const [street, setStreet] = useState(user?.street || user?.address?.street || '');
  const [street2, setStreet2] = useState(user?.street2 || user?.address?.street2 || '');
  const [city, setCity] = useState(user?.city || user?.address?.city || '');
  const [state, setState] = useState(user?.state || user?.address?.state || 'Kerala');
  const [pincode, setPincode] = useState(user?.pincode || user?.address?.pincode || '');
  const [phone, setPhone] = useState(user?.phone || user?.address?.phone || '');
  const [billingEmail, setBillingEmail] = useState(user?.billingEmail || user?.address?.email || user?.email || '');
  const [savingAddress, setSavingAddress] = useState(false);

  // Shipping Address form fields
  const [shippingFirst, setShippingFirst] = useState(user?.shippingAddress?.firstName || user?.firstName || '');
  const [shippingLast, setShippingLast] = useState(user?.shippingAddress?.lastName || user?.lastName || '');
  const [shippingCountry, setShippingCountry] = useState(user?.shippingAddress?.country || 'India');
  const [shippingStreet, setShippingStreet] = useState(user?.shippingAddress?.street || '');
  const [shippingStreet2, setShippingStreet2] = useState(user?.shippingAddress?.street2 || '');
  const [shippingCity, setShippingCity] = useState(user?.shippingAddress?.city || '');
  const [shippingState, setShippingState] = useState(user?.shippingAddress?.state || 'Kerala');
  const [shippingPincode, setShippingPincode] = useState(user?.shippingAddress?.pincode || '');
  const [savingShipping, setSavingShipping] = useState(false);

  // Account Details form fields
  const [accFirst, setAccFirst] = useState(user?.firstName || '');
  const [accLast, setAccLast] = useState(user?.lastName || '');
  const [accDisplayName, setAccDisplayName] = useState(user?.name || '');
  const [accEmail, setAccEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  // Auto-refresh address & profile details from WordPress when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn) {
        if (refreshUserData) refreshUserData();
        loadOrders();
      }
    }, [isLoggedIn])
  );

  const loadOrders = async () => {
    if (!isLoggedIn || !fetchUserOrders) return;
    setLoadingOrders(true);
    try {
      const data = await fetchUserOrders(user);
      setOrders(data || []);
    } catch (e) {
      console.log('Orders load error:', e.message);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleSyncSubscription = async () => {
    try {
      setSyncingSub(true);
      const res = await syncUserSubscription();
      if (res?.success && res?.isPremium) {
        Alert.alert(
          '🎉 VIP Subscription Synced!',
          res.message || 'Your VIP subscription from whiteswantvnews.com is active and synced with this device.',
          [{ text: 'Awesome!' }]
        );
      } else if (res?.success && !res?.isPremium) {
        Alert.alert(
          'No Active Website Subscription',
          'We checked whiteswantvnews.com for your account, but no active subscription order was found.\n\nIf you recently subscribed, please ensure payment is complete or that you signed in with the same email.',
          [
            {
              text: 'View VIP Plans',
              onPress: () => navigation.navigate('PremiumPlans'),
            },
            {
              text: 'Manage on Website',
              onPress: () => Linking.openURL('https://whiteswantvnews.com/my-account/subscriptions/'),
            },
            { text: 'Close', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert('Notice', res?.message || 'Could not sync subscription at this time.');
      }
    } catch (e) {
      Alert.alert('Sync Error', 'An error occurred while connecting to the WordPress website.');
    } finally {
      setSyncingSub(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (refreshUserData) {
        await refreshUserData();
      }
      if (syncUserSubscription) {
        await syncUserSubscription();
      }
      await loadOrders();
    } catch (e) {
      console.log('Refresh error:', e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const hasBillingAddress = !!(user?.address?.street || user?.street || user?.address?.city || user?.city || user?.address?.pincode || user?.pincode);
  const hasShippingAddress = !!(user?.shippingAddress?.street || user?.shippingAddress?.city || user?.shippingAddress?.pincode);

  // Reset avatar error when user avatar updates
  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatar]);

  // Synchronize form fields whenever user object updates (only if modals are closed)
  useEffect(() => {
    if (user && !showAddressModal && !showShippingModal && !showAccountModal) {
      const addr = user.address || {};
      const nameParts = (addr.name || user.name || '').trim().split(' ').filter(Boolean);
      const cleanFirst = addr.firstName || user.firstName || nameParts[0] || '';
      const cleanLast = addr.lastName || user.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
      const rawState = addr.state || user.state || 'Kerala';
      const cleanState = getStateName(rawState);

      setFirstName(cleanFirst);
      setLastName(cleanLast);
      setCountry(addr.country || user.country || 'India');
      setStreet(addr.street || user.street || '');
      setStreet2(addr.street2 || user.street2 || '');
      setCity(addr.city || user.city || '');
      setState(cleanState);
      setPincode(addr.pincode || user.pincode || '');
      setPhone(addr.phone || user.phone || '');
      setBillingEmail(addr.email || user.billingEmail || user.email || '');

      // Shipping
      const ship = user.shippingAddress || {};
      setShippingFirst(ship.firstName || cleanFirst);
      setShippingLast(ship.lastName || cleanLast);
      setShippingCountry(ship.country || user.country || 'India');
      setShippingStreet(ship.street || '');
      setShippingStreet2(ship.street2 || '');
      setShippingCity(ship.city || '');
      setShippingState(getStateName(ship.state || 'Kerala'));
      setShippingPincode(ship.pincode || '');

      // Account
      setAccFirst(user.firstName || cleanFirst);
      setAccLast(user.lastName || cleanLast);
      setAccDisplayName(user.name || (cleanFirst ? `${cleanFirst} ${cleanLast}`.trim() : 'Member'));
      setAccEmail(user.email || '');
    } else if (!user) {
      // Clean guest state wipeout
      setFirstName('');
      setLastName('');
      setCountry('India');
      setStreet('');
      setStreet2('');
      setCity('');
      setState('Kerala');
      setPincode('');
      setPhone('');
      setBillingEmail('');
      setShippingFirst('');
      setShippingLast('');
      setShippingCountry('India');
      setShippingStreet('');
      setShippingStreet2('');
      setShippingCity('');
      setShippingState('Kerala');
      setShippingPincode('');
      setAccFirst('');
      setAccLast('');
      setAccDisplayName('');
      setAccEmail('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOrders([]);
      setSelectedOrder(null);
      setShowAddressModal(false);
      setShowShippingModal(false);
      setShowAccountModal(false);
      setShowStatePicker(false);
      setShowCountryPicker(false);
      setShowShippingStatePicker(false);
      setShowShippingCountryPicker(false);
      setShowLogoutModal(false);
    }
  }, [user, showAddressModal, showShippingModal, showAccountModal]);

  // Subscription Details calculation
  const getSubscriptionDetails = () => {
    if (!user?.isPremium) return null;

    const startDate = user?.subscribedAt ? new Date(user.subscribedAt) : new Date();
    let expiryDate;

    if (user?.expiresAt) {
      expiryDate = new Date(user.expiresAt);
    } else {
      const durationDays = user?.premiumPlan?.includes('6')
        ? 180
        : user?.premiumPlan?.includes('Month')
        ? 30
        : 365;
      expiryDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    }

    const now = new Date();
    const diffMs = expiryDate - now;
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const isExpired = daysRemaining <= 0;

    const formatDate = (d) =>
      d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

    return {
      planName: user?.premiumPlan || 'Yearly VIP Access',
      planPrice: user?.planPrice || '₹299/Year',
      startDate: formatDate(startDate),
      expiryDate: formatDate(expiryDate),
      daysRemaining,
      isExpired,
    };
  };

  const subDetails = getSubscriptionDetails();

  // Billing Address Save Handler
  const handleSaveAddress = async () => {
    if (!firstName.trim()) {
      Alert.alert('Required', 'Please enter your first name.');
      return;
    }

    try {
      setSavingAddress(true);
      const cleanFirst = firstName.trim();
      const cleanLast = lastName.trim();
      const cleanFull = `${cleanFirst} ${cleanLast}`.trim();
      const cleanCountry = (country || 'India').trim();
      const cleanStreet = street.trim();
      const cleanStreet2 = (street2 || '').trim();
      const cleanCity = city.trim();
      const cleanState = (state || 'Kerala').trim();
      const cleanPincode = pincode.trim();
      const cleanPhone = phone.trim();
      const cleanBillingEmail = (billingEmail || user?.email || '').trim();

      const addressData = {
        firstName: cleanFirst,
        lastName: cleanLast,
        name: cleanFull,
        country: cleanCountry,
        street: cleanStreet,
        street2: cleanStreet2,
        city: cleanCity,
        district: cleanCity,
        state: cleanState,
        pincode: cleanPincode,
        phone: cleanPhone,
        email: cleanBillingEmail,
        billingEmail: cleanBillingEmail,
      };

      await syncBillingAddress(addressData);

      setShowAddressModal(false);
      showToast('Billing address saved successfully!');
    } catch (e) {
      showToast('Failed to save address: ' + e.message, 'error');
    } finally {
      setSavingAddress(false);
    }
  };

  // Clear / Reset Billing Address
  const handleClearBillingAddress = () => {
    Alert.alert(
      'Clear Billing Address',
      'Are you sure you want to clear your billing address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setSavingAddress(true);
              setStreet('');
              setStreet2('');
              setCity('');
              setPincode('');
              setPhone('');
              await deleteBillingAddress();
              setShowAddressModal(false);
              showToast('Billing address cleared successfully.');
            } catch (e) {
              showToast('Failed to clear address: ' + e.message, 'error');
            } finally {
              setSavingAddress(false);
            }
          },
        },
      ]
    );
  };

  // Shipping Address Save Handler
  const handleSaveShipping = async () => {
    if (!shippingFirst.trim()) {
      showToast('Please enter your first name.', 'error');
      return;
    }

    try {
      setSavingShipping(true);
      await syncShippingAddress({
        firstName: shippingFirst.trim(),
        lastName: shippingLast.trim(),
        country: shippingCountry.trim(),
        street: shippingStreet.trim(),
        street2: shippingStreet2.trim(),
        city: shippingCity.trim(),
        state: shippingState.trim(),
        pincode: shippingPincode.trim(),
      });

      setShowShippingModal(false);
      showToast('Shipping address saved successfully!');
    } catch (e) {
      showToast('Failed to save shipping address: ' + e.message, 'error');
    } finally {
      setSavingShipping(false);
    }
  };

  // Clear / Reset Shipping Address
  const handleClearShippingAddress = () => {
    Alert.alert(
      'Clear Shipping Address',
      'Are you sure you want to clear your shipping address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setSavingShipping(true);
              setShippingStreet('');
              setShippingStreet2('');
              setShippingCity('');
              setShippingPincode('');
              await deleteShippingAddress();
              setShowShippingModal(false);
              showToast('Shipping address cleared successfully.');
            } catch (e) {
              showToast('Failed to clear shipping address: ' + e.message, 'error');
            } finally {
              setSavingShipping(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenAccountModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    const cleanFirst = user?.firstName || (user?.name ? user.name.split(' ')[0] : '');
    const cleanLast = user?.lastName || (user?.name ? user.name.split(' ').slice(1).join(' ') : '');
    setAccFirst(user?.firstName || cleanFirst);
    setAccLast(user?.lastName || cleanLast);
    setAccDisplayName(user?.name || `${cleanFirst} ${cleanLast}`.trim() || 'Member');
    setAccEmail(user?.email || '');
    setShowAccountModal(true);
  };

  // Account Details & Password Save Handler
  const handleSaveAccountDetails = async () => {
    const cleanFirst = accFirst.trim();
    const cleanLast = accLast.trim();
    const cleanDisplay = accDisplayName.trim() || `${cleanFirst} ${cleanLast}`.trim() || user?.name || 'Member';
    const cleanEmail = accEmail.trim();
    const cleanCurrentPwd = currentPassword.trim();
    const cleanNewPwd = newPassword.trim();
    const cleanConfirmPwd = confirmPassword.trim();

    if (!cleanFirst) {
      showToast('Please enter your first name.', 'error');
      return;
    }
    if (!cleanLast) {
      showToast('Please enter your last name.', 'error');
      return;
    }
    if (!cleanDisplay) {
      showToast('Please enter your display name.', 'error');
      return;
    }

    if (cleanNewPwd || cleanConfirmPwd) {
      if (!cleanCurrentPwd) {
        showToast('Please enter your current password.', 'error');
        return;
      }
      if (cleanNewPwd !== cleanConfirmPwd) {
        showToast('New passwords do not match.', 'error');
        return;
      }
      if (cleanNewPwd.length < 6) {
        showToast('New password must be at least 6 characters long.', 'error');
        return;
      }
    } else if (cleanCurrentPwd) {
      showToast('Please enter your new password.', 'error');
      return;
    }

    try {
      setSavingAccount(true);
      await updateAccountDetails({
        firstName: cleanFirst,
        lastName: cleanLast,
        displayName: cleanDisplay,
        email: cleanEmail,
        currentPassword: cleanCurrentPwd,
        newPassword: cleanNewPwd,
        confirmPassword: cleanConfirmPwd,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowAccountModal(false);
      showToast('Account details saved successfully!');
    } catch (e) {
      showToast(e.message || 'Failed to update account details', 'error');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleOpenPage = (page) => {
    if (!page) return;
    navigation.navigate('PageDetail', {
      slug: page.slug,
      title: page.title,
      fallbackUrl: page.url,
    });
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    try {
      setLoggingOut(true);
      setShowLogoutModal(false);
      setShowAddressModal(false);
      setShowShippingModal(false);
      setShowAccountModal(false);
      setShowNewsletterModal(false);
      setShowStatePicker(false);
      setShowCountryPicker(false);
      setShowShippingStatePicker(false);
      setShowShippingCountryPicker(false);
      setActiveTab('dashboard');
      setOrders([]);
      setSelectedOrder(null);
      setFirstName('');
      setLastName('');
      setCountry('India');
      setStreet('');
      setStreet2('');
      setCity('');
      setState('Kerala');
      setPincode('');
      setPhone('');
      setBillingEmail('');
      setShippingFirst('');
      setShippingLast('');
      setShippingCountry('India');
      setShippingStreet('');
      setShippingStreet2('');
      setShippingCity('');
      setShippingState('Kerala');
      setShippingPincode('');
      setAccFirst('');
      setAccLast('');
      setAccDisplayName('');
      setAccEmail('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      await logout();
      showToast('Signed out successfully.');
    } catch (e) {
      console.log('Logout error:', e.message);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
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
        {navigation.canGoBack() ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
        <Text style={[styles.topBarTitle, { color: colors.text }]}>My Account</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Success / Alert Toast Notification */}
      {toastMessage && (
        <View
          style={[
            styles.toastContainer,
            {
              backgroundColor: toastMessage.type === 'error' ? '#EF4444' : '#059669',
              top: Math.max(insets.top, 12) + 54,
            },
          ]}
        >
          <Ionicons
            name={toastMessage.type === 'error' ? 'alert-circle' : 'checkmark-circle'}
            size={18}
            color="#FFFFFF"
          />
          <Text style={styles.toastText}>{toastMessage.message}</Text>
          <TouchableOpacity onPress={() => setToastMessage(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && styles.tabletContent,
        ]}
      >
        {/* User Profile Header Card */}
        {isLoggedIn ? (
          <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.avatarContainer}>
              <Image
                key={`avatar_${user?.avatar || 'default'}_${user?.avatarUpdatedAt || ''}_${user?.email || ''}`}
                source={{
                  uri:
                    !avatarError && user?.avatar
                      ? user.avatar
                      : `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=00A3E8&color=fff&bold=true`,
                  ...(user?.avatar && user.avatar.startsWith('http') ? { cache: 'reload' } : {}),
                }}
                style={styles.avatar}
                onError={() => setAvatarError(true)}
              />
              {avatarLoading && (
                <View style={[styles.avatar, styles.avatarLoadingOverlay]}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              )}
            </View>

            <View style={styles.profileInfo}>
              <Text style={[styles.userName, { color: colors.text }]}>{user.name}</Text>
              <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user.email}</Text>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: user.isPremium
                        ? (isDarkMode ? '#082F49' : '#E0F2FE')
                        : (isDarkMode ? '#1E293B' : '#F1F5F9'),
                    },
                  ]}
                >
                  <Ionicons
                    name={user.isPremium ? 'diamond' : 'person'}
                    size={12}
                    color={user.isPremium ? COLORS.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: user.isPremium ? COLORS.primary : colors.textSecondary },
                    ]}
                  >
                    {user.isPremium ? 'VIP Member' : 'Member'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.guestCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.guestAvatar}>
              <Ionicons name="person-outline" size={32} color={colors.textSecondary} />
            </View>
            <View style={styles.guestTextContainer}>
              <Text style={[styles.guestTitle, { color: colors.text }]}>
                Welcome, Reader
              </Text>
              <Text style={[styles.guestSubtitle, { color: colors.textSecondary }]}>
                Sign in to manage orders, subscriptions, addresses, and account details.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.8}
            >
              <Text style={styles.loginBtnText}>Sign In / Register</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Navigation Tab Bar (Dashboard & Settings) */}
        {isLoggedIn && (
          <View style={styles.wcTabBar}>
            <View style={styles.wcTabBarContent}>
              <TouchableOpacity
                style={[
                  styles.wcTabItem,
                  (activeTab === 'dashboard' || activeTab === 'orders' || activeTab === 'addresses' || activeTab === 'account') && [
                    styles.wcTabItemActive,
                    { backgroundColor: isDarkMode ? '#1E293B' : '#E0F2FE', borderColor: COLORS.primary },
                  ],
                ]}
                onPress={() => setActiveTab('dashboard')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={activeTab !== 'settings' ? 'grid' : 'grid-outline'}
                  size={16}
                  color={activeTab !== 'settings' ? COLORS.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.wcTabItemText,
                    { color: activeTab !== 'settings' ? COLORS.primary : colors.textSecondary },
                    activeTab !== 'settings' && { fontWeight: '800' },
                  ]}
                >
                  Dashboard
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.wcTabItem,
                  activeTab === 'settings' && [
                    styles.wcTabItemActive,
                    { backgroundColor: isDarkMode ? '#1E293B' : '#E0F2FE', borderColor: COLORS.primary },
                  ],
                ]}
                onPress={() => setActiveTab('settings')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={activeTab === 'settings' ? 'settings' : 'settings-outline'}
                  size={16}
                  color={activeTab === 'settings' ? COLORS.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.wcTabItemText,
                    { color: activeTab === 'settings' ? COLORS.primary : colors.textSecondary },
                    activeTab === 'settings' && { fontWeight: '800' },
                  ]}
                >
                  Settings
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* TAB 0: WOOCOMMERCE DASHBOARD ([woocommerce_my_account] default) */}
        {isLoggedIn && activeTab === 'dashboard' && (
          <View style={styles.section}>
            {/* Official WooCommerce Greeting Banner */}
            <View style={[styles.dashboardGreetingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.dashboardGreetingTitle, { color: colors.text }]}>
                Hello <Text style={{ color: COLORS.primary, fontWeight: '800' }}>{user.name || user.firstName || 'Member'}</Text>
              </Text>
              <Text style={[styles.dashboardGreetingText, { color: colors.textSecondary }]}>
                From your account dashboard you can view your recent orders, manage your shipping and billing addresses, and edit your password and account details.
              </Text>
            </View>

            {/* Interactive Quick Action Tiles */}
            <View style={styles.dashboardGrid}>
              {/* Tile 1: Orders & Subscriptions */}
              <TouchableOpacity
                style={[styles.dashboardTile, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => {
                  setActiveTab('orders');
                  loadOrders();
                }}
                activeOpacity={0.75}
              >
                <View style={[styles.tileIconBox, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="receipt" size={24} color={COLORS.primary} />
                </View>
                <Text style={[styles.tileTitle, { color: colors.text }]}>Orders & Subscriptions</Text>
                <Text style={[styles.tileSubtitle, { color: colors.textSecondary }]}>
                  {user.isPremium ? (subDetails?.planName || 'Active VIP Member') : (orders.length > 0 ? `${orders.length} orders recorded` : 'View order history')}
                </Text>
                <View style={styles.tileFooterRow}>
                  <Text style={styles.tileActionLink}>View Orders & VIP →</Text>
                </View>
              </TouchableOpacity>

              {/* Tile 2: Addresses */}
              <TouchableOpacity
                style={[styles.dashboardTile, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setActiveTab('addresses')}
                activeOpacity={0.75}
              >
                <View style={[styles.tileIconBox, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="location" size={24} color="#16A34A" />
                </View>
                <Text style={[styles.tileTitle, { color: colors.text }]}>Addresses</Text>
                <Text style={[styles.tileSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                  {hasBillingAddress ? `${user?.address?.street || user?.street || ''} ${user?.address?.city || user?.city || ''}`.trim() : 'Manage billing & shipping'}
                </Text>
                <View style={styles.tileFooterRow}>
                  <Text style={[styles.tileActionLink, { color: '#16A34A' }]}>Edit Addresses →</Text>
                </View>
              </TouchableOpacity>

              {/* Tile 3: Account Details */}
              <TouchableOpacity
                style={[styles.dashboardTile, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setActiveTab('account')}
                activeOpacity={0.75}
              >
                <View style={[styles.tileIconBox, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="person" size={24} color="#7C3AED" />
                </View>
                <Text style={[styles.tileTitle, { color: colors.text }]}>Account Details</Text>
                <Text style={[styles.tileSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                  {user.email || 'Password & name'}
                </Text>
                <View style={styles.tileFooterRow}>
                  <Text style={[styles.tileActionLink, { color: '#7C3AED' }]}>Edit Details →</Text>
                </View>
              </TouchableOpacity>

              {/* Tile 4: Settings */}
              <TouchableOpacity
                style={[styles.dashboardTile, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setActiveTab('settings')}
                activeOpacity={0.75}
              >
                <View style={[styles.tileIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="settings" size={24} color="#D97706" />
                </View>
                <Text style={[styles.tileTitle, { color: colors.text }]}>Settings & About</Text>
                <Text style={[styles.tileSubtitle, { color: colors.textSecondary }]}>
                  Theme, info & legal
                </Text>
                <View style={styles.tileFooterRow}>
                  <Text style={[styles.tileActionLink, { color: '#D97706' }]}>
                    Preferences →
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Quick Actions Card */}
            <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 14 }]}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <View style={styles.menuLeft}>
                  <View style={[styles.menuIconCircle, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                  </View>
                  <Text style={[styles.menuLabel, { color: '#EF4444', fontWeight: '700' }]}>
                    Sign Out
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* TAB 1: SUBSCRIPTION & ORDERS (SAME SESSION) */}
        {isLoggedIn && activeTab === 'orders' && (
          <View style={styles.section}>
            {/* Header with Back to Dashboard */}
            <View style={[styles.sectionHeaderRow, { marginBottom: 14 }]}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}
                onPress={() => setActiveTab('dashboard')}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={16} color={COLORS.primary} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.primary }}>Dashboard</Text>
              </TouchableOpacity>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                ORDERS & SUBSCRIPTION
              </Text>
            </View>

            {/* SUBSCRIPTION STATUS CARD (IF ACTIVE) */}
            {user?.isPremium && subDetails && (
              <View style={{ marginBottom: 18 }}>
                <View style={[styles.sectionHeaderRow, { marginBottom: 8 }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    SUBSCRIPTION STATUS
                  </Text>
                </View>
                <View
                  style={[
                    styles.subscriptionCard,
                    {
                      backgroundColor: isDarkMode ? '#0B192C' : '#F0F9FF',
                      borderColor: subDetails.isExpired ? '#EF4444' : '#38BDF8',
                      marginBottom: 0,
                    },
                  ]}
                >
                  <View style={styles.subCardTopRow}>
                    <View style={styles.subCardLeft}>
                      <View style={[styles.crownBox, { backgroundColor: '#FFFFFF', overflow: 'hidden', borderWidth: 1.5, borderColor: '#00A3E8', alignItems: 'center', justifyContent: 'center' }]}>
                        <Image
                          source={require('../../assets/logo.png')}
                          style={{ width: 34, height: 34 }}
                          resizeMode="contain"
                        />
                      </View>
                      <View>
                        <Text style={[styles.subPlanTitle, { color: colors.text }]}>
                          {subDetails.planName}
                        </Text>
                        <Text style={[styles.subPlanPrice, { color: colors.textSecondary }]}>
                          {subDetails.planPrice} • Verified Subscription
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.activePill,
                        {
                          backgroundColor: subDetails.isExpired ? '#FEE2E2' : '#D1FAE5',
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.dotIndicator,
                          { backgroundColor: subDetails.isExpired ? '#EF4444' : '#059669' },
                        ]}
                      />
                      <Text
                        style={[
                          styles.activePillText,
                          { color: subDetails.isExpired ? '#DC2626' : '#065F46' },
                        ]}
                      >
                        {subDetails.isExpired ? 'EXPIRED' : 'ACTIVE'}
                      </Text>
                    </View>
                  </View>

                  {/* Expiration Details Grid */}
                  <View
                    style={[
                      styles.expiryGrid,
                      { backgroundColor: isDarkMode ? '#081729' : '#E0F2FE', borderColor: isDarkMode ? '#1E3A5F' : '#BAE6FD' },
                    ]}
                  >
                    <View style={styles.expiryCol}>
                      <Text style={[styles.expiryLabel, { color: colors.textSecondary }]}>
                        Subscribed On
                      </Text>
                      <Text style={[styles.expiryValue, { color: colors.text }]}>
                        {subDetails.startDate}
                      </Text>
                    </View>
                    <View style={[styles.expiryDivider, { backgroundColor: isDarkMode ? 'rgba(0,163,232,0.25)' : 'rgba(0,163,232,0.2)' }]} />
                    <View style={styles.expiryCol}>
                      <Text style={[styles.expiryLabel, { color: colors.textSecondary }]}>
                        Expires On
                      </Text>
                      <Text
                        style={[
                          styles.expiryValue,
                          { color: subDetails.isExpired ? '#EF4444' : (isDarkMode ? '#38BDF8' : '#0284C7') },
                        ]}
                      >
                        {subDetails.expiryDate}
                      </Text>
                    </View>
                    <View style={[styles.expiryDivider, { backgroundColor: isDarkMode ? 'rgba(0,163,232,0.25)' : 'rgba(0,163,232,0.2)' }]} />
                    <View style={styles.expiryCol}>
                      <Text style={[styles.expiryLabel, { color: colors.textSecondary }]}>
                        Remaining
                      </Text>
                      <Text
                        style={[
                          styles.expiryValue,
                          { color: subDetails.daysRemaining < 30 ? '#EF4444' : '#059669' },
                        ]}
                      >
                        {subDetails.daysRemaining} Days
                      </Text>
                    </View>
                  </View>

                  {/* Upgrade / Change Plan Button */}
                  <TouchableOpacity
                    style={[
                      styles.managePlanBtn,
                      {
                        backgroundColor: isDarkMode ? '#0C2744' : '#E0F2FE',
                        borderColor: isDarkMode ? '#0284C7' : '#7DD3FC',
                      },
                    ]}
                    onPress={() => navigation.navigate('PremiumPlans')}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.managePlanBtnText,
                        { color: isDarkMode ? '#7DD3FC' : '#0284C7' },
                      ]}
                    >
                      {subDetails.isExpired ? 'Renew Subscription Now' : 'View VIP Membership'}
                    </Text>
                    <Ionicons name="arrow-forward" size={14} color={isDarkMode ? '#7DD3FC' : '#0284C7'} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ORDERS & INVOICES LIST */}
            <View style={[styles.sectionHeaderRow, { marginBottom: 8 }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                ORDERS & INVOICES
              </Text>
            </View>

            {loadingOrders && orders.length === 0 ? (
              <View style={[styles.cardGroup, { padding: 24, alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border }]}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={{ color: colors.textSecondary, marginTop: 10, fontSize: 13 }}>
                  Fetching orders...
                </Text>
              </View>
            ) : orders.length > 0 ? (
              <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {orders.map((ord, idx) => {
                  const isLast = idx === orders.length - 1;
                  const isCompleted = ord.status.toLowerCase().includes('complet') || ord.status.toLowerCase().includes('active');
                  const isPending = ord.status.toLowerCase().includes('pend') || ord.status.toLowerCase().includes('hold');

                  return (
                    <TouchableOpacity
                      key={ord.id || idx}
                      style={[
                        styles.orderRow,
                        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                      ]}
                      onPress={() => setSelectedOrder(ord)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.orderRowLeft}>
                        <View style={[styles.orderIconBox, { backgroundColor: isCompleted ? '#DCFCE7' : '#FEF3C7' }]}>
                          <Ionicons
                            name="receipt"
                            size={18}
                            color={isCompleted ? '#16A34A' : '#D97706'}
                          />
                        </View>
                        <View>
                          <Text style={[styles.orderNumberText, { color: colors.text }]}>
                            Order {ord.id}
                          </Text>
                          <Text style={[styles.orderDateText, { color: colors.textSecondary }]}>
                            {ord.date} • {ord.item || 'VIP Subscription'}
                          </Text>
                          <Text style={[styles.orderTotalText, { color: colors.text }]}>
                            {ord.total}
                          </Text>
                        </View>
                      </View>

                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <View
                          style={[
                            styles.orderStatusPill,
                            {
                              backgroundColor: isCompleted ? '#DCFCE7' : isPending ? '#FEF3C7' : '#F1F5F9',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.orderStatusText,
                              {
                                color: isCompleted ? '#15803D' : isPending ? '#B45309' : colors.textSecondary,
                              },
                            ]}
                          >
                            {ord.status}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: COLORS.primary, fontWeight: '700' }}>
                          View Details →
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.cardGroup, { padding: 24, alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="receipt-outline" size={38} color={colors.textSecondary} style={{ opacity: 0.5, marginBottom: 8 }} />
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                  No orders recorded yet
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 14 }}>
                  All your past digital invoices, payments, and VIP plan purchases appear here.
                </Text>
                <TouchableOpacity
                  style={[styles.loginBtn, { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10 }]}
                  onPress={() => navigation.navigate('PremiumPlans')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.loginBtnText}>Browse VIP Plans</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* TAB 2: WOOCOMMERCE ADDRESSES */}
        {isLoggedIn && activeTab === 'addresses' && (
          <View style={styles.section}>
            {/* Header with Back to Dashboard */}
            <View style={[styles.sectionHeaderRow, { marginBottom: 12 }]}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}
                onPress={() => setActiveTab('dashboard')}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={16} color={COLORS.primary} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.primary }}>Dashboard</Text>
              </TouchableOpacity>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                MY ADDRESSES
              </Text>
            </View>

            {/* BILLING ADDRESS CARD */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                BILLING ADDRESS
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    const addr = user?.address || {};
                    const nameParts = (addr.name || user?.name || '').trim().split(' ').filter(Boolean);
                    setFirstName(addr.firstName || user?.firstName || nameParts[0] || '');
                    setLastName(addr.lastName || user?.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''));
                    setCountry(addr.country || user?.country || 'India');
                    setStreet(addr.street || user?.street || '');
                    setStreet2(addr.street2 || user?.street2 || '');
                    setCity(addr.city || user?.city || '');
                    setState(getStateName(addr.state || user?.state || 'Kerala'));
                    setPincode(addr.pincode || user?.pincode || '');
                    setPhone(addr.phone || user?.phone || '');
                    setBillingEmail(addr.email || user?.billingEmail || user?.email || '');
                    setShowAddressModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.editLinkText}>
                    {hasBillingAddress ? 'Edit Billing Address' : '+ Add Billing Address'}
                  </Text>
                </TouchableOpacity>

                {hasBillingAddress ? (
                  <TouchableOpacity
                    onPress={handleClearBillingAddress}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 20 }]}>
              {/* Name */}
              <View style={[styles.addressRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="person-circle-outline" size={18} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addressItemLabel, { color: colors.textSecondary }]}>
                    Full Name
                  </Text>
                  <Text style={[styles.addressItemValue, { color: colors.text }]}>
                    {user?.address?.name || (user?.address?.firstName ? `${user.address.firstName} ${user.address.lastName || ''}`.trim() : (user?.name || 'Not provided'))}
                  </Text>
                </View>
              </View>

              {/* Country / Region */}
              <View style={[styles.addressRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="globe-outline" size={18} color="#0284C7" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addressItemLabel, { color: colors.textSecondary }]}>
                    Country / Region
                  </Text>
                  <Text style={[styles.addressItemValue, { color: colors.text }]}>
                    {getCountryName(user?.address?.country || user?.country || 'India')}
                  </Text>
                </View>
              </View>

              {/* Street Address */}
              <View style={[styles.addressRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="home-outline" size={18} color="#8B5CF6" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addressItemLabel, { color: colors.textSecondary }]}>
                    Street Address
                  </Text>
                  <Text style={[styles.addressItemValue, { color: (user?.address?.street || user?.street) ? colors.text : colors.textSecondary }]}>
                    {[user?.address?.street || user?.street, user?.address?.street2 || user?.street2].filter(Boolean).join(', ') || 'Tap "+ Add Billing Address" to set up'}
                  </Text>
                </View>
              </View>

              {/* Town / City & State */}
              <View style={[styles.addressRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="business-outline" size={18} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addressItemLabel, { color: colors.textSecondary }]}>
                    Town / City & State
                  </Text>
                  <Text style={[styles.addressItemValue, { color: (user?.address?.city || user?.city) ? colors.text : colors.textSecondary }]}>
                    {(user?.address?.city || user?.city)
                      ? `${user?.address?.city || user?.city}, ${getStateName(user?.address?.state || user?.state || 'Kerala')}`
                      : 'Not set up'}
                  </Text>
                </View>
              </View>

              {/* Postal PIN Code */}
              <View style={[styles.addressRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="location-outline" size={18} color="#EF4444" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addressItemLabel, { color: colors.textSecondary }]}>
                    PIN Code
                  </Text>
                  <Text style={[styles.addressItemValue, { color: (user?.address?.pincode || user?.pincode) ? colors.text : colors.textSecondary }]}>
                    {user?.address?.pincode || user?.pincode || 'Not provided'}
                  </Text>
                </View>
              </View>

              {/* Phone */}
              <View style={[styles.addressRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="call-outline" size={18} color="#10B981" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addressItemLabel, { color: colors.textSecondary }]}>
                    Phone (optional)
                  </Text>
                  <Text style={[styles.addressItemValue, { color: (user?.address?.phone || user?.phone) ? colors.text : colors.textSecondary }]}>
                    {user?.address?.phone || user?.phone || 'Not provided'}
                  </Text>
                </View>
              </View>

              {/* Email address */}
              <View style={styles.addressRow}>
                <Ionicons name="mail-outline" size={18} color="#EC4899" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addressItemLabel, { color: colors.textSecondary }]}>
                    Email address
                  </Text>
                  <Text style={[styles.addressItemValue, { color: (user?.address?.email || user?.billingEmail || user?.email) ? colors.text : colors.textSecondary }]}>
                    {user?.address?.email || user?.billingEmail || user?.email || 'Not provided'}
                  </Text>
                </View>
              </View>
            </View>

            {/* SHIPPING ADDRESS CARD */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                SHIPPING ADDRESS
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    const sAddr = user?.shippingAddress || {};
                    const nameParts = (sAddr.name || user?.name || '').trim().split(' ').filter(Boolean);
                    setShippingFirst(sAddr.firstName || user?.firstName || nameParts[0] || '');
                    setShippingLast(sAddr.lastName || user?.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''));
                    setShippingCountry(sAddr.country || user?.country || 'India');
                    setShippingStreet(sAddr.street || '');
                    setShippingStreet2(sAddr.street2 || '');
                    setShippingCity(sAddr.city || '');
                    setShippingState(getStateName(sAddr.state || 'Kerala'));
                    setShippingPincode(sAddr.pincode || '');
                    setShowShippingModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.editLinkText}>
                    {hasShippingAddress ? 'Edit Shipping Address' : '+ Add Shipping Address'}
                  </Text>
                </TouchableOpacity>

                {hasShippingAddress ? (
                  <TouchableOpacity
                    onPress={handleClearShippingAddress}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Shipping Name */}
              <View style={[styles.addressRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="person-outline" size={18} color="#3B82F6" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addressItemLabel, { color: colors.textSecondary }]}>
                    Recipient Name
                  </Text>
                  <Text style={[styles.addressItemValue, { color: colors.text }]}>
                    {user?.shippingAddress?.name || (user?.shippingAddress?.firstName ? `${user.shippingAddress.firstName} ${user.shippingAddress.lastName || ''}`.trim() : user?.name || 'Not provided')}
                  </Text>
                </View>
              </View>

              {/* Shipping Country */}
              <View style={[styles.addressRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="globe-outline" size={18} color="#0284C7" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addressItemLabel, { color: colors.textSecondary }]}>
                    Country / Region
                  </Text>
                  <Text style={[styles.addressItemValue, { color: colors.text }]}>
                    {getCountryName(user?.shippingAddress?.country || 'India')}
                  </Text>
                </View>
              </View>

              {/* Shipping Street */}
              <View style={[styles.addressRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="home-outline" size={18} color="#8B5CF6" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addressItemLabel, { color: colors.textSecondary }]}>
                    Street Address
                  </Text>
                  <Text style={[styles.addressItemValue, { color: user?.shippingAddress?.street ? colors.text : colors.textSecondary }]}>
                    {[user?.shippingAddress?.street, user?.shippingAddress?.street2].filter(Boolean).join(', ') || 'Tap "+ Add Shipping Address" to set up'}
                  </Text>
                </View>
              </View>

              {/* Shipping City & State */}
              <View style={[styles.addressRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="business-outline" size={18} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addressItemLabel, { color: colors.textSecondary }]}>
                    Town / City & State
                  </Text>
                  <Text style={[styles.addressItemValue, { color: user?.shippingAddress?.city ? colors.text : colors.textSecondary }]}>
                    {user?.shippingAddress?.city
                      ? `${user.shippingAddress.city}, ${getStateName(user.shippingAddress.state || 'Kerala')}`
                      : 'Not set up'}
                  </Text>
                </View>
              </View>

              {/* Shipping PIN */}
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={18} color="#EF4444" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addressItemLabel, { color: colors.textSecondary }]}>
                    PIN Code
                  </Text>
                  <Text style={[styles.addressItemValue, { color: user?.shippingAddress?.pincode ? colors.text : colors.textSecondary }]}>
                    {user?.shippingAddress?.pincode || 'Not provided'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* TAB 3: WOOCOMMERCE ACCOUNT DETAILS */}
        {isLoggedIn && activeTab === 'account' && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}
                onPress={() => setActiveTab('dashboard')}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={16} color={COLORS.primary} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.primary }}>Dashboard</Text>
              </TouchableOpacity>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                ACCOUNT DETAILS
              </Text>
              <TouchableOpacity
                onPress={handleOpenAccountModal}
                activeOpacity={0.7}
              >
                <Text style={styles.editLinkText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Display Name */}
              <View style={[styles.addressRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="person-outline" size={18} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addressItemLabel, { color: colors.textSecondary }]}>
                    Display Name
                  </Text>
                  <Text style={[styles.addressItemValue, { color: colors.text }]}>
                    {user?.name || 'Member'}
                  </Text>
                </View>
              </View>

              {/* First Name & Last Name */}
              <View style={[styles.addressRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="id-card-outline" size={18} color="#10B981" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addressItemLabel, { color: colors.textSecondary }]}>
                    First & Last Name
                  </Text>
                  <Text style={[styles.addressItemValue, { color: colors.text }]}>
                    {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Not provided'}
                  </Text>
                </View>
              </View>

              {/* Email Address */}
              <View style={[styles.addressRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="mail-outline" size={18} color="#0284C7" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addressItemLabel, { color: colors.textSecondary }]}>
                    Email Address
                  </Text>
                  <Text style={[styles.addressItemValue, { color: colors.text }]}>
                    {user?.email || 'Not provided'}
                  </Text>
                </View>
              </View>

              {/* Membership Role */}
              <View style={styles.addressRow}>
                <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addressItemLabel, { color: colors.textSecondary }]}>
                    Membership Status
                  </Text>
                  <Text style={[styles.addressItemValue, { color: colors.text }]}>
                    {user?.isPremium ? 'Premium VIP Member' : (user?.role || 'Free Member')}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveAddressBtn, { backgroundColor: COLORS.primary, marginTop: 14 }]}
              onPress={handleOpenAccountModal}
              activeOpacity={0.85}
            >
              <Ionicons name="lock-closed-outline" size={18} color="#FFFFFF" />
              <Text style={styles.saveAddressBtnText}>Change Password & Details</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* TAB 5: SETTINGS & ABOUT */}
        {(!isLoggedIn || activeTab === 'settings') && (
          <View>
            {/* Preferences Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                PREFERENCES
              </Text>

              <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.menuItem}>
                  <View style={styles.menuLeft}>
                    <View style={[styles.menuIconCircle, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}>
                      <Ionicons
                        name={isDarkMode ? 'moon' : 'sunny'}
                        size={18}
                        color={isDarkMode ? '#F59E0B' : '#0F172A'}
                      />
                    </View>
                    <Text style={[styles.menuLabel, { color: colors.text }]}>
                      Dark Theme
                    </Text>
                  </View>
                  <Switch
                    value={isDarkMode}
                    onValueChange={toggleTheme}
                    trackColor={{ false: '#CBD5E1', true: COLORS.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Daily Newsletter & Updates Subscription */}
                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                  ]}
                  onPress={() => setShowNewsletterModal(true)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuLeft, { flex: 1, marginRight: 10 }]}>
                    <View style={[styles.menuIconCircle, { backgroundColor: isDarkMode ? 'rgba(1, 162, 228, 0.18)' : '#E0F2FE' }]}>
                      <Ionicons name="mail" size={18} color="#01A2E4" />
                    </View>
                    <View style={{ flex: 1, paddingRight: 6 }}>
                      <Text style={[styles.menuLabel, { color: colors.text }]}>
                        Daily Newsletter
                      </Text>
                      <Text style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 1 }}>
                        Breaking news and daily digest
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} style={{ marginRight: 6 }} />
                </TouchableOpacity>
              </View>
            </View>

            {/* WordPress Website About Section */}
            <View style={styles.section}>
              <View style={[styles.aboutCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {/* Website-Style About Header */}
                <View style={styles.aboutHeaderBox}>
                  <View style={styles.aboutTitleRow}>
                    <View style={styles.aboutRedBar} />
                    <Text style={[styles.aboutTitleText, { color: colors.text }]}>About</Text>
                  </View>
                  <View style={[styles.aboutDividerLine, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0' }]}>
                    <View style={styles.aboutCyanAccent} />
                  </View>
                </View>

                {/* List of Website Legal & Info Pages */}
                <View style={styles.aboutLinksList}>
                  {ABOUT_PAGES.map((page, idx) => (
                    <TouchableOpacity
                      key={page.id}
                      style={[
                        styles.aboutLinkItem,
                        idx < ABOUT_PAGES.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.border,
                        },
                      ]}
                      onPress={() => handleOpenPage(page)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.aboutLinkLeft}>
                        <Ionicons name="chevron-forward" size={17} color="#00A3E8" />
                        <Text style={[styles.aboutLinkLabel, { color: colors.text }]}>
                          {page.title}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Marketing & Advertising Packages Section */}
            <View style={styles.section}>
              <MarketingPackagesSection style={{ marginTop: 0, marginBottom: 0 }} />
            </View>

            {/* App Info & Sign Out */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                APP INFO & ACCOUNT
              </Text>

              <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.menuItem, { borderBottomColor: colors.border }]}>
                  <View style={styles.menuLeft}>
                    <View style={[styles.menuIconCircle, { backgroundColor: '#E0F2FE' }]}>
                      <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
                    </View>
                    <Text style={[styles.menuLabel, { color: colors.text }]}>
                      App Version
                    </Text>
                  </View>
                  <Text style={[styles.menuBadgeText, { color: colors.textSecondary }]}>
                    {Constants.expoConfig?.version || Constants.manifest?.version || '1.0.17'}
                  </Text>
                </View>

                {isLoggedIn && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={handleLogout}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuLeft}>
                      <View style={[styles.menuIconCircle, { backgroundColor: '#FEE2E2' }]}>
                        <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                      </View>
                      <Text style={[styles.menuLabel, { color: '#EF4444', fontWeight: '700' }]}>
                        Sign Out
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* BILLING ADDRESS MODAL */}
      <Modal
        visible={showAddressModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddressModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border, maxHeight: '92%' }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Billing address
              </Text>
              <TouchableOpacity onPress={() => setShowAddressModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* First name & Last name */}
              <View style={styles.nameRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>First name</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="First name"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>Last name</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Last name"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Country / Region */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>Country / Region</Text>
                <TouchableOpacity
                  style={[styles.selectBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                  onPress={() => setShowCountryPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.selectBoxText, { color: colors.text }]}>
                    {getCountryName(country || 'India')}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Street address */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>Street address</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, marginBottom: 8 }]}
                  value={street}
                  onChangeText={setStreet}
                  placeholder="House number and street name"
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={street2}
                  onChangeText={setStreet2}
                  placeholder="Apartment, suite, unit, etc. (optional)"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Town / City */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>Town / City</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={city}
                  onChangeText={setCity}
                  placeholder="Town / City"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* State */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>State</Text>
                <TouchableOpacity
                  style={[styles.selectBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                  onPress={() => setShowStatePicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.selectBoxText, { color: colors.text }]}>
                    {getStateName(state)}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* PIN Code */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>PIN Code</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={pincode}
                  onChangeText={setPincode}
                  placeholder="PIN Code"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>

              {/* Phone (optional) */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>Phone (optional)</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Phone (optional)"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Email address */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>Email address</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={billingEmail}
                  onChangeText={setBillingEmail}
                  placeholder="Email address"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Save address button */}
              <TouchableOpacity
                style={[styles.wcSaveAddressBtn, { backgroundColor: COLORS.primary }]}
                onPress={handleSaveAddress}
                disabled={savingAddress}
                activeOpacity={0.85}
              >
                {savingAddress ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={[styles.wcSaveAddressBtnText, { color: '#FFFFFF' }]}>Save address</Text>
                )}
              </TouchableOpacity>

              {(hasBillingAddress || street) ? (
                <TouchableOpacity
                  style={{ marginTop: 10, paddingVertical: 10, alignItems: 'center' }}
                  onPress={handleClearBillingAddress}
                  disabled={savingAddress}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>
                    Clear Billing Address
                  </Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>

            {/* Embedded Country Picker Overlay inside Billing Modal */}
            {showCountryPicker && (
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 9999, padding: SPACING.lg, paddingBottom: 36 }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Select Country / Region</Text>
                  <TouchableOpacity onPress={() => setShowCountryPicker(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {COUNTRIES_LIST.map((c) => {
                    const isSelected = country === c.name || country === c.code || getCountryName(country) === c.name;
                    return (
                      <TouchableOpacity
                        key={c.code}
                        style={[
                          styles.stateItem,
                          { borderBottomColor: colors.border },
                          isSelected && { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
                        ]}
                        onPress={() => {
                          setCountry(c.name);
                          setShowCountryPicker(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.stateItemText,
                            { color: isSelected ? COLORS.primary : colors.text },
                            isSelected && { fontWeight: '700' },
                          ]}
                        >
                          {c.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Embedded State Picker Overlay inside Billing Modal */}
            {showStatePicker && (
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 9999, padding: SPACING.lg, paddingBottom: 36 }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Select State</Text>
                  <TouchableOpacity onPress={() => setShowStatePicker(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {INDIAN_STATES.map((s) => {
                    const isSelected = state === s.name || state === s.code || getStateName(state) === s.name;
                    return (
                      <TouchableOpacity
                        key={s.code}
                        style={[
                          styles.stateItem,
                          { borderBottomColor: colors.border },
                          isSelected && { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
                        ]}
                        onPress={() => {
                          setState(s.name);
                          setShowStatePicker(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.stateItemText,
                            { color: isSelected ? COLORS.primary : colors.text },
                            isSelected && { fontWeight: '700' },
                          ]}
                        >
                          {s.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* SHIPPING ADDRESS MODAL */}
      <Modal
        visible={showShippingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShippingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border, maxHeight: '92%' }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Shipping address
              </Text>
              <TouchableOpacity onPress={() => setShowShippingModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Copy from Billing Address Shortcut */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  backgroundColor: isDarkMode ? '#1E293B' : '#E0F2FE',
                  borderRadius: 10,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#334155' : '#BAE6FD',
                }}
                onPress={() => {
                  setShippingFirst(firstName || user?.firstName || '');
                  setShippingLast(lastName || user?.lastName || '');
                  setShippingCountry(country || user?.country || 'India');
                  setShippingStreet(street || user?.street || '');
                  setShippingStreet2(street2 || user?.street2 || '');
                  setShippingCity(city || user?.city || '');
                  setShippingState(state || user?.state || 'Kerala');
                  setShippingPincode(pincode || user?.pincode || '');
                  showToast('Billing address copied to shipping address.');
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="copy-outline" size={16} color={COLORS.primary} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.primary }}>
                  Copy from Billing Address
                </Text>
              </TouchableOpacity>

              {/* First name & Last name */}
              <View style={styles.nameRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>First name</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                    value={shippingFirst}
                    onChangeText={setShippingFirst}
                    placeholder="First name"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>Last name</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                    value={shippingLast}
                    onChangeText={setShippingLast}
                    placeholder="Last name"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Country / Region */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>Country / Region</Text>
                <TouchableOpacity
                  style={[styles.selectBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                  onPress={() => setShowShippingCountryPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.selectBoxText, { color: colors.text }]}>
                    {getCountryName(shippingCountry || 'India')}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Street address */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>Street address</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, marginBottom: 8 }]}
                  value={shippingStreet}
                  onChangeText={setShippingStreet}
                  placeholder="House number and street name"
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={shippingStreet2}
                  onChangeText={setShippingStreet2}
                  placeholder="Apartment, suite, unit, etc. (optional)"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Town / City */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>Town / City</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={shippingCity}
                  onChangeText={setShippingCity}
                  placeholder="Town / City"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* State */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>State</Text>
                <TouchableOpacity
                  style={[styles.selectBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                  onPress={() => setShowShippingStatePicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.selectBoxText, { color: colors.text }]}>
                    {getStateName(shippingState)}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* PIN Code */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>PIN Code</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={shippingPincode}
                  onChangeText={setShippingPincode}
                  placeholder="PIN Code"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>

              {/* Save address button */}
              <TouchableOpacity
                style={[styles.wcSaveAddressBtn, { backgroundColor: COLORS.primary }]}
                onPress={handleSaveShipping}
                disabled={savingShipping}
                activeOpacity={0.85}
              >
                {savingShipping ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={[styles.wcSaveAddressBtnText, { color: '#FFFFFF' }]}>Save address</Text>
                )}
              </TouchableOpacity>

              {(hasShippingAddress || shippingStreet) ? (
                <TouchableOpacity
                  style={{ marginTop: 10, paddingVertical: 10, alignItems: 'center' }}
                  onPress={handleClearShippingAddress}
                  disabled={savingShipping}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>
                    Clear Shipping Address
                  </Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>

            {/* Embedded Shipping Country Picker Overlay */}
            {showShippingCountryPicker && (
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 9999, padding: SPACING.lg, paddingBottom: 36 }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Select Shipping Country</Text>
                  <TouchableOpacity onPress={() => setShowShippingCountryPicker(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {COUNTRIES_LIST.map((c) => {
                    const isSelected = shippingCountry === c.name || shippingCountry === c.code || getCountryName(shippingCountry) === c.name;
                    return (
                      <TouchableOpacity
                        key={c.code}
                        style={[
                          styles.stateItem,
                          { borderBottomColor: colors.border },
                          isSelected && { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
                        ]}
                        onPress={() => {
                          setShippingCountry(c.name);
                          setShowShippingCountryPicker(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.stateItemText,
                            { color: isSelected ? COLORS.primary : colors.text },
                            isSelected && { fontWeight: '700' },
                          ]}
                        >
                          {c.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Embedded Shipping State Picker Overlay */}
            {showShippingStatePicker && (
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 9999, padding: SPACING.lg, paddingBottom: 36 }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Select Shipping State</Text>
                  <TouchableOpacity onPress={() => setShowShippingStatePicker(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {INDIAN_STATES.map((s) => {
                    const isSelected = shippingState === s.name || shippingState === s.code || getStateName(shippingState) === s.name;
                    return (
                      <TouchableOpacity
                        key={s.code}
                        style={[
                          styles.stateItem,
                          { borderBottomColor: colors.border },
                          isSelected && { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
                        ]}
                        onPress={() => {
                          setShippingState(s.name);
                          setShowShippingStatePicker(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.stateItemText,
                            { color: isSelected ? COLORS.primary : colors.text },
                            isSelected && { fontWeight: '700' },
                          ]}
                        >
                          {s.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ACCOUNT DETAILS & PASSWORD CHANGE MODAL */}
      <Modal
        visible={showAccountModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAccountModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border, maxHeight: '92%' }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Account details
              </Text>
              <TouchableOpacity onPress={() => setShowAccountModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* First name & Last name */}
              <View style={styles.nameRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>First name *</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                    value={accFirst}
                    onChangeText={setAccFirst}
                    placeholder="First name"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>Last name *</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                    value={accLast}
                    onChangeText={setAccLast}
                    placeholder="Last name"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* Display name */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>Display name *</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={accDisplayName}
                  onChangeText={setAccDisplayName}
                  placeholder="Display name"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                  This will be how your name will be displayed in the account section and in reviews.
                </Text>
              </View>

              {/* Email address (Disabled & Non-editable) */}
              <View style={styles.formGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary, marginBottom: 0 }]}>
                    Email address
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
                    <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600' }}>Linked Account</Text>
                  </View>
                </View>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: isDarkMode ? '#1A2333' : '#F1F5F9',
                      color: colors.textSecondary,
                      borderColor: colors.border,
                      opacity: 0.85,
                    },
                  ]}
                  value={user?.email || accEmail}
                  editable={false}
                  placeholder="Email address"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                  Account email is linked to your Whiteswan login credentials and cannot be changed here.
                </Text>
              </View>

              {/* PASSWORD CHANGE SUB-SECTION */}
              <View style={{ marginTop: 12, marginBottom: 12 }}>
                <Text style={[styles.formSubHeader, { color: colors.text }]}>Password change</Text>
                <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 12 }} />

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                    Current password (leave blank to leave unchanged)
                  </Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Current password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                    New password (leave blank to leave unchanged)
                  </Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="New password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                    Confirm new password
                  </Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                  />
                </View>
              </View>

              {/* Save changes button */}
              <TouchableOpacity
                style={[styles.wcSaveAddressBtn, { backgroundColor: COLORS.primary }]}
                onPress={handleSaveAccountDetails}
                disabled={savingAccount}
                activeOpacity={0.85}
              >
                {savingAccount ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={[styles.wcSaveAddressBtnText, { color: '#FFFFFF' }]}>Save changes</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ORDER DETAILS MODAL */}
      <Modal
        visible={!!selectedOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Order {selectedOrder?.id}
              </Text>
              <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <View style={{ gap: 14 }}>
                <View style={[styles.orderDetailCard, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderColor: colors.border }]}>
                  <View style={styles.orderDetailRow}>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Order Date</Text>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{selectedOrder.date}</Text>
                  </View>
                  <View style={styles.orderDetailRow}>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Status</Text>
                    <Text style={{ color: '#16A34A', fontSize: 13, fontWeight: '700' }}>{selectedOrder.status}</Text>
                  </View>
                  <View style={styles.orderDetailRow}>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Total</Text>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{selectedOrder.total}</Text>
                  </View>
                  <View style={styles.orderDetailRow}>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Product / Access</Text>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{selectedOrder.item || 'Premium VIP Digital Access'}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.saveAddressBtn, { backgroundColor: COLORS.primary }]}
                  onPress={() => setSelectedOrder(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.saveAddressBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>



      {/* Custom Designed Sign Out Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!loggingOut) setShowLogoutModal(false);
        }}
      >
        <View style={styles.logoutModalOverlay}>
          <View
            style={[
              styles.logoutModalCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.logoutIconBadge}>
              <Ionicons name="log-out" size={30} color="#EF4444" />
            </View>

            <Text style={[styles.logoutModalTitle, { color: colors.text }]}>Sign Out</Text>

            <Text style={[styles.logoutModalMessage, { color: colors.textSecondary }]}>
              Are you sure you want to sign out of your account?
            </Text>

            <View style={styles.logoutButtonRow}>
              <TouchableOpacity
                style={[
                  styles.logoutCancelBtn,
                  { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' },
                ]}
                onPress={() => setShowLogoutModal(false)}
                activeOpacity={0.7}
                disabled={loggingOut}
              >
                <Text style={[styles.logoutCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.logoutConfirmBtn}
                onPress={confirmLogout}
                activeOpacity={0.8}
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="log-out-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.logoutConfirmText}>Sign Out</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Newsletter Popup Modal */}
      <NewsletterPopup
        visible={showNewsletterModal}
        onClose={() => setShowNewsletterModal(false)}
        autoTrigger={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoutModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 22,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  logoutIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EF444415',
    borderWidth: 1.5,
    borderColor: '#EF444430',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoutModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },
  logoutModalMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 22,
    paddingHorizontal: 6,
  },
  logoutButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  logoutCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutCancelText: {
    fontSize: 15,
    fontWeight: '700',
  },
  logoutConfirmBtn: {
    flex: 1.2,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
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
  refreshIconBtn: {
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
    maxWidth: 620,
    width: '100%',
    alignSelf: 'center',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: 14,
    gap: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 34,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editPhotoBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
  },
  userEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  changePhotoBtnText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  guestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: 16,
    gap: 14,
  },
  guestAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestTextContainer: {
    flex: 1,
  },
  guestTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  guestSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  loginBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  /* WooCommerce Tab Switcher */
  wcTabBar: {
    marginBottom: 16,
    width: '100%',
  },
  wcTabBarContent: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    paddingVertical: 2,
  },
  wcTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(156, 163, 175, 0.25)',
  },
  wcTabItemActive: {
    borderWidth: 1.5,
  },
  wcTabItemText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Dashboard [woocommerce_my_account] Styles */
  dashboardGreetingCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  wcNoticeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginBottom: 10,
  },
  wcNoticeBadgeText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '700',
  },
  dashboardGreetingTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 6,
  },
  dashboardGreetingText: {
    fontSize: 13,
    lineHeight: 19,
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
  },
  dashboardTile: {
    width: '48%',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 14,
    justifyContent: 'space-between',
    minHeight: 140,
  },
  tileIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  tileSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 8,
  },
  tileFooterRow: {
    marginTop: 'auto',
  },
  tileActionLink: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },

  /* Subscription Expiry Card Styles */
  subscriptionCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 16,
  },
  subCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  subCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  crownBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subPlanTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  subPlanPrice: {
    fontSize: 12,
    marginTop: 2,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  expiryGrid: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  expiryCol: {
    flex: 1,
    alignItems: 'center',
  },
  expiryDivider: {
    width: 1,
    backgroundColor: 'rgba(217, 119, 6, 0.25)',
  },
  expiryLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  expiryValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  websiteSyncBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
    borderRadius: RADIUS.sm,
    marginBottom: 14,
  },
  websiteSyncText: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
  },
  subActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  subActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  subActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  subSyncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
  },
  syncIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  managePlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  managePlanBtnText: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '700',
  },
  premiumBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  premiumBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  premiumCrownBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  premiumBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  goldPill: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  goldPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  premiumBannerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },

  /* Sections & Lists */
  section: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  editLinkText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  cardGroup: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },

  /* Address Rows */
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  addressItemLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  addressItemValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },

  /* Orders Rows */
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  orderRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  orderIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderNumberText: {
    fontSize: 14,
    fontWeight: '800',
  },
  orderDateText: {
    fontSize: 11,
    marginTop: 2,
  },
  orderTotalText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  orderStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  orderDetailCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  orderDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  /* Preferences & Menus */
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
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
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  photoActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  photoActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: RADIUS.md,
    gap: 8,
  },
  photoActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Form Fields */
  formGroup: {
    marginBottom: 14,
  },
  formSubHeader: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectBoxText: {
    fontSize: 14,
    fontWeight: '600',
  },
  wcSaveAddressBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    marginTop: 10,
    marginBottom: 20,
  },
  wcSaveAddressBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  statePickerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: SPACING.lg,
    paddingBottom: 36,
  },
  stateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.sm,
  },
  stateItemText: {
    fontSize: 14,
  },
  saveAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: RADIUS.lg,
    gap: 8,
    marginTop: 10,
    marginBottom: 20,
  },
  saveAddressBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  /* WordPress Website About Section */
  aboutCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 4,
  },
  aboutHeaderBox: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  aboutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  aboutRedBar: {
    width: 4,
    height: 22,
    backgroundColor: '#E50914',
    borderRadius: 2,
  },
  aboutTitleText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  aboutDividerLine: {
    height: 2,
    width: '100%',
    position: 'relative',
  },
  aboutCyanAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 44,
    backgroundColor: '#00A3E8',
  },
  aboutLinksList: {
    paddingVertical: 2,
  },
  aboutLinkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  aboutLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  aboutLinkLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  toastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
  },
  toastText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
