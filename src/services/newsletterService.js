import AsyncStorage from '@react-native-async-storage/async-storage';

const WP_AJAX_URL = 'https://whiteswantvnews.com/wp-admin/admin-ajax.php';
const WP_SITE_URL = 'https://whiteswantvnews.com/';

const HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  'Referer': 'https://whiteswantvnews.com/',
  'Origin': 'https://whiteswantvnews.com',
};

const STORAGE_KEYS = {
  SUBSCRIBED: '@adnl_user_subscribed',
  DISMISSED_TIME: '@adnl_popup_dismissed_time',
  SAVED_EMAIL: '@adnl_user_email',
  CACHED_NONCE: '@adnl_cached_nonce',
};

// Default fallback nonce if scraping is unavailable
let inMemoryNonce = '82363fd36e';

/**
 * Fetch the latest nonce from the website HTML or fallback to cached/default nonce
 */
export const getNewsletterNonce = async () => {
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_NONCE);
    if (cached) {
      inMemoryNonce = cached;
    }

    // Attempt to scrape fresh nonce from homepage in background
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(WP_SITE_URL, {
      headers: HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();
      const match = html.match(/"nonce":"([a-zA-Z0-9]+)"/);
      if (match && match[1]) {
        inMemoryNonce = match[1];
        await AsyncStorage.setItem(STORAGE_KEYS.CACHED_NONCE, match[1]);
      }
    }
  } catch (e) {
    // Graceful fallback to default/cached nonce
  }
  return inMemoryNonce;
};

/**
 * Check if the popup should be shown based on subscription status and frequency cooldown
 * @param {number} cooldownMinutes - Delay in minutes before showing dismissed popup again (default: 30)
 */
export const shouldShowNewsletterPopup = async (cooldownMinutes = 30) => {
  try {
    const isSubscribed = await AsyncStorage.getItem(STORAGE_KEYS.SUBSCRIBED);
    if (isSubscribed === '1' || isSubscribed === 'true') {
      return false;
    }

    const dismissedTimeStr = await AsyncStorage.getItem(STORAGE_KEYS.DISMISSED_TIME);
    if (dismissedTimeStr) {
      const dismissedTime = parseInt(dismissedTimeStr, 10);
      const cooldownMs = cooldownMinutes * 60 * 1000;
      if (Date.now() - dismissedTime < cooldownMs) {
        return false;
      }
    }

    return true;
  } catch (e) {
    return true;
  }
};

/**
 * Record that user dismissed the popup
 */
export const markPopupDismissed = async () => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.DISMISSED_TIME, Date.now().toString());
  } catch (e) { }
};

/**
 * Record that user has successfully subscribed
 */
export const markUserSubscribed = async (email = '') => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SUBSCRIBED, '1');
    if (email) {
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_EMAIL, email);
    }
  } catch (e) { }
};

/**
 * Submit newsletter subscription to WordPress backend
 */
export const subscribeToNewsletter = async (email, name = '') => {
  if (!email || !email.trim()) {
    return {
      success: false,
      message: 'Please enter a valid email address.',
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return {
      success: false,
      message: 'Please enter a valid email address format.',
    };
  }

  try {
    const nonce = await getNewsletterNonce();

    const formData = new URLSearchParams();
    formData.append('action', 'adnl_subscribe');
    formData.append('nonce', nonce);
    formData.append('email', cleanEmail);
    if (name) {
      formData.append('name', name.trim());
    }

    const response = await fetch(WP_AJAX_URL, {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const result = await response.json();

    if (result && result.success) {
      await markUserSubscribed(cleanEmail);
      return {
        success: true,
        message: result.data?.message || 'Thank you! You have successfully subscribed to our daily digest.',
      };
    }

    // Handle failure / already subscribed
    const isAlreadySub =
      result?.data?.code === 'already_subscribed' ||
      (typeof result?.data?.message === 'string' &&
        result.data.message.toLowerCase().includes('already subscribed'));

    if (isAlreadySub) {
      await markUserSubscribed(cleanEmail);
      return {
        success: false,
        isAlreadySubscribed: true,
        message: result?.data?.message || `${cleanEmail} is already subscribed to our newsletter!`,
      };
    }

    return {
      success: false,
      message: result?.data?.message || 'Subscription failed. Please try again later.',
    };
  } catch (error) {
    console.error('Newsletter subscribe error:', error);
    return {
      success: false,
      message: 'Unable to connect to newsletter service. Please check your internet connection.',
    };
  }
};
