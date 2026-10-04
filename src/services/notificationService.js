import { Alert, Linking } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const ONESIGNAL_APP_ID =
  process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID || '87c5a74b-23bc-42f2-8c22-41135c83cbf1';

// Detect if running in Expo Go client where custom native modules cannot be loaded
const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let OneSignal = null;
let LogLevel = null;

if (!isExpoGo) {
  try {
    const oneSignalPkg = require('react-native-onesignal');
    OneSignal = oneSignalPkg.OneSignal;
    LogLevel = oneSignalPkg.LogLevel;
  } catch (error) {
    console.warn('[OneSignal] Native module not found in binary:', error?.message || error);
  }
}

class NotificationService {
  static navigationRef = null;
  static hasShownVerificationDialog = false;
  static pushSubscriptionObserver = null;
  static clickListener = null;
  static foregroundListener = null;
  static pendingNavigation = null;

  static setNavigationRef(ref) {
    this.navigationRef = ref;
    if (this.pendingNavigation && this.navigationRef?.isReady?.()) {
      const { screen, params } = this.pendingNavigation;
      this.pendingNavigation = null;
      try {
        this.navigationRef.navigate(screen, params);
      } catch (e) {
        console.warn('[OneSignal] Pending navigation failed:', e);
      }
    }
  }

  /**
   * Check if OneSignal native module is available
   */
  static isAvailable() {
    return !isExpoGo && OneSignal !== null && typeof OneSignal?.initialize === 'function';
  }

  /**
   * Initialize OneSignal Push Notifications SDK
   */
  static async init(navigationRef = null) {
    if (navigationRef) {
      this.navigationRef = navigationRef;
    }

    if (!this.isAvailable()) {
      console.log(
        '[OneSignal] Running in Expo Go or environment without OneSignal native module. Native push is active in standalone APK / Development builds.'
      );
      return {
        success: false,
        cleanup: () => {},
      };
    }

    try {
      console.log('[OneSignal] Initializing OneSignal with App ID:', ONESIGNAL_APP_ID);

      // 1. Configure logging level
      try {
        if (LogLevel?.Debug) {
          OneSignal.Debug.setLogLevel(LogLevel.Debug);
        } else if (LogLevel?.Verbose) {
          OneSignal.Debug.setLogLevel(LogLevel.Verbose);
        }
      } catch (_) {}

      // 2. Initialize SDK
      OneSignal.initialize(ONESIGNAL_APP_ID);

      // 3. Prompt user for notification permission immediately and ensure opt-in
      try {
        OneSignal.Notifications.requestPermission(true);
        OneSignal.User.pushSubscription.optIn();
      } catch (e) {
        console.warn('[OneSignal] Request permission init error:', e);
      }

      // 4. Setup Push Subscription Observer
      this.setupSubscriptionVerification();

      // 5. Setup Notification Click & Foreground Event Listeners
      this.setupNotificationListeners();

      return {
        success: true,
        cleanup: () => {
          this.cleanup();
        },
      };
    } catch (error) {
      console.warn('[OneSignal] Initialization error:', error?.message || error);
      return {
        success: false,
        cleanup: () => {},
      };
    }
  }

  /**
   * Monitor Push Subscription status once server-assigned ID exists
   */
  static setupSubscriptionVerification() {
    if (!this.isAvailable()) return;

    const checkAndLogSubscription = (subscriptionId) => {
      if (this.hasShownVerificationDialog) return;

      if (
        subscriptionId &&
        typeof subscriptionId === 'string' &&
        subscriptionId.trim().length > 0 &&
        !subscriptionId.startsWith('local-')
      ) {
        this.hasShownVerificationDialog = true;
        console.log('[OneSignal] Server-assigned push subscription ID confirmed:', subscriptionId);
      }
    };

    try {
      const currentId = OneSignal.User?.pushSubscription?.id;
      if (currentId) {
        checkAndLogSubscription(currentId);
      }

      this.pushSubscriptionObserver = (event) => {
        const currentSubscriptionId =
          event?.current?.id || OneSignal.User?.pushSubscription?.id;
        checkAndLogSubscription(currentSubscriptionId);
      };

      OneSignal.User?.pushSubscription?.addEventListener(
        'change',
        this.pushSubscriptionObserver
      );
    } catch (err) {
      console.warn('[OneSignal] Push subscription observer error:', err);
    }
  }

  /**
   * Setup click and foreground notification handlers
   */
  static setupNotificationListeners() {
    if (!this.isAvailable()) return;

    try {
      this.clickListener = (event) => {
        console.log('[OneSignal] Notification clicked:', event);
        this.handleNotificationClick(event);
      };
      OneSignal.Notifications?.addEventListener('click', this.clickListener);

      this.foregroundListener = (event) => {
        console.log('[OneSignal] Foreground Notification:', event);
      };
      OneSignal.Notifications?.addEventListener(
        'foregroundWillDisplay',
        this.foregroundListener
      );
    } catch (err) {
      console.warn('[OneSignal] Notification listeners error:', err);
    }
  }

  /**
   * Helper: Parse WordPress article URL or parameters
   */
  static parseWordPressLink(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return null;
    try {
      const trimmed = urlStr.trim();
      // Check query parameter ?p=123 or &p=123
      const pMatch = trimmed.match(/[?&]p=(\d+)/i);
      if (pMatch && pMatch[1]) {
        return { postId: parseInt(pMatch[1], 10) };
      }

      // Check if URL belongs to whiteswantvnews.com or is a relative path
      if (trimmed.includes('whiteswantvnews.com') || trimmed.startsWith('/')) {
        const cleanPath = trimmed
          .replace(/^https?:\/\/(www\.)?whiteswantvnews\.com/i, '')
          .split('?')[0]
          .split('#')[0]
          .replace(/^\/+|\/+$/g, '');

        if (!cleanPath) {
          return { screen: 'MainTabs' };
        }

        const segments = cleanPath.split('/').filter(Boolean);
        if (segments.length > 0) {
          const lastSegment = segments[segments.length - 1];

          if (cleanPath === 'live-tv' || cleanPath === 'live' || lastSegment === 'live-tv') {
            return { screen: 'MainTabs', params: { screen: 'LiveTV' } };
          }

          if (cleanPath.startsWith('category/') || cleanPath.startsWith('categories/')) {
            return { screen: 'MainTabs', params: { screen: 'Categories' } };
          }

          if (cleanPath === 'saved' || cleanPath === 'bookmarks') {
            return { screen: 'MainTabs', params: { screen: 'Saved' } };
          }

          // Article slug
          if (
            lastSegment !== 'wp-admin' &&
            lastSegment !== 'wp-login.php' &&
            lastSegment !== 'feed'
          ) {
            return {
              screen: 'ArticleDetail',
              params: {
                slug: decodeURIComponent(lastSegment),
                postUrl: trimmed,
              },
            };
          }
        }
      }
    } catch (e) {
      console.warn('[OneSignal] URL parsing error:', e);
    }
    return null;
  }

  /**
   * Execute navigation safely with cold-start retry
   */
  static navigateSafely(screen, params = {}, retries = 5) {
    if (this.navigationRef?.isReady?.()) {
      try {
        this.navigationRef.navigate(screen, params);
        return;
      } catch (e) {
        console.warn('[OneSignal] Direct navigate failed:', e);
      }
    }

    this.pendingNavigation = { screen, params };

    if (retries > 0) {
      setTimeout(() => {
        if (this.pendingNavigation) {
          this.navigateSafely(screen, params, retries - 1);
        }
      }, 500);
    }
  }

  /**
   * Handle user tapping on a notification (Deep Link / Article / Screen)
   */
  static handleNotificationClick(event) {
    console.log('[OneSignal] Notification click event received:', JSON.stringify(event));

    const data = event?.notification?.additionalData || {};
    // 1. Check direct post ID fields
    const rawPostId =
      data.postId ||
      data.post_id ||
      data.id ||
      data.article_id ||
      data?.custom?.a?.post_id ||
      data?.custom?.post_id;

    if (rawPostId) {
      const parsedId = parseInt(rawPostId, 10);
      if (!isNaN(parsedId) && parsedId > 0) {
        this.navigateSafely('ArticleDetail', { postId: parsedId });
        return;
      }
    }

    // 2. Check WordPress URL / launch URL
    const url =
      data.url ||
      data.target_url ||
      data.openURL ||
      data.link ||
      event?.notification?.launchURL;

    if (url) {
      const parsed = this.parseWordPressLink(url);
      if (parsed) {
        if (parsed.postId) {
          this.navigateSafely('ArticleDetail', { postId: parsed.postId });
          return;
        }
        if (parsed.screen === 'ArticleDetail') {
          this.navigateSafely('ArticleDetail', parsed.params);
          return;
        }
        if (parsed.screen) {
          this.navigateSafely(parsed.screen, parsed.params || {});
          return;
        }
      }

      // If it is an external link (not whiteswantvnews.com), open in external browser
      Linking.canOpenURL(url).then((supported) => {
        if (supported) {
          Linking.openURL(url);
        }
      });
      return;
    }

    // 3. Check explicit screen parameter
    if (data.screen === 'LiveTV') {
      this.navigateSafely('MainTabs', { screen: 'LiveTV' });
      return;
    }

    if (data.screen) {
      this.navigateSafely(data.screen, data.params || {});
    }
  }

  /**
   * Request Notification Permissions (Android 13+ & iOS)
   */
  static async requestPermission(fallbackToSettings = true) {
    if (!this.isAvailable()) return false;
    try {
      return await OneSignal.Notifications.requestPermission(fallbackToSettings);
    } catch (error) {
      console.warn('[OneSignal] Request permission error:', error);
      return false;
    }
  }

  /**
   * User Identity Management
   */
  static login(externalId) {
    if (!this.isAvailable()) return;
    try {
      if (externalId) {
        OneSignal.login(String(externalId));
      }
    } catch (error) {
      console.warn('[OneSignal] Login error:', error);
    }
  }

  static logout() {
    if (!this.isAvailable()) return;
    try {
      OneSignal.logout();
    } catch (error) {
      console.warn('[OneSignal] Logout error:', error);
    }
  }

  /**
   * User Tags Management
   */
  static addTag(key, value) {
    if (!this.isAvailable()) return;
    try {
      OneSignal.User.addTag(key, String(value));
    } catch (error) {
      console.warn('[OneSignal] Add tag error:', error);
    }
  }

  static addTags(tags) {
    if (!this.isAvailable()) return;
    try {
      OneSignal.User.addTags(tags);
    } catch (error) {
      console.warn('[OneSignal] Add tags error:', error);
    }
  }

  static removeTag(key) {
    if (!this.isAvailable()) return;
    try {
      OneSignal.User.removeTag(key);
    } catch (error) {
      console.warn('[OneSignal] Remove tag error:', error);
    }
  }

  /**
   * Push Subscription Status
   */
  static getPushSubscriptionId() {
    if (!this.isAvailable()) return null;
    try {
      return OneSignal.User?.pushSubscription?.id;
    } catch (error) {
      return null;
    }
  }

  static async getOptedInAsync() {
    if (!this.isAvailable()) return false;
    try {
      return await OneSignal.User.pushSubscription.getOptedInAsync();
    } catch (error) {
      return false;
    }
  }

  static optIn() {
    if (!this.isAvailable()) return;
    try {
      OneSignal.User.pushSubscription.optIn();
    } catch (error) {
      console.warn('[OneSignal] Opt in error:', error);
    }
  }

  static optOut() {
    if (!this.isAvailable()) return;
    try {
      OneSignal.User.pushSubscription.optOut();
    } catch (error) {
      console.warn('[OneSignal] Opt out error:', error);
    }
  }

  /**
   * Cleanup listeners on unmount
   */
  static cleanup() {
    if (!this.isAvailable()) return;
    try {
      if (this.pushSubscriptionObserver) {
        OneSignal.User?.pushSubscription?.removeEventListener(
          'change',
          this.pushSubscriptionObserver
        );
        this.pushSubscriptionObserver = null;
      }
      if (this.clickListener) {
        OneSignal.Notifications?.removeEventListener('click', this.clickListener);
        this.clickListener = null;
      }
      if (this.foregroundListener) {
        OneSignal.Notifications?.removeEventListener(
          'foregroundWillDisplay',
          this.foregroundListener
        );
        this.foregroundListener = null;
      }
    } catch (error) {
      console.warn('[OneSignal] Cleanup error:', error);
    }
  }
}

export default NotificationService;
