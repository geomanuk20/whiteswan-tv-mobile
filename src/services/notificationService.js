import { Alert, Linking } from 'react-native';
import { OneSignal, LogLevel } from 'react-native-onesignal';

const ONESIGNAL_APP_ID =
  process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID || '87c5a74b-23bc-42f2-8c22-41135c83cbf1';

class NotificationService {
  static navigationRef = null;
  static hasShownVerificationDialog = false;
  static pushSubscriptionObserver = null;
  static clickListener = null;
  static foregroundListener = null;

  static setNavigationRef(ref) {
    this.navigationRef = ref;
  }

  /**
   * Initialize OneSignal Push Notifications SDK
   */
  static async init(navigationRef = null) {
    if (navigationRef) {
      this.navigationRef = navigationRef;
    }

    try {
      console.log('[OneSignal] Initializing OneSignal with App ID:', ONESIGNAL_APP_ID);

      // 1. Configure logging level
      try {
        OneSignal.Debug.setLogLevel(LogLevel.Warn);
      } catch (_) {}

      // 2. Initialize SDK
      OneSignal.initialize(ONESIGNAL_APP_ID);

      // 3. Setup Push Subscription Observer & Verification Dialog
      this.setupSubscriptionVerification();

      // 4. Setup Notification Click & Foreground Event Listeners
      this.setupNotificationListeners();

      return {
        success: true,
        cleanup: () => {
          this.cleanup();
        },
      };
    } catch (error) {
      console.warn('[OneSignal] Init notice (e.g. running outside native build):', error?.message || error);
      return {
        success: false,
        cleanup: () => {},
      };
    }
  }

  /**
   * Monitor Push Subscription status and display verification dialog once server-assigned ID exists
   */
  static setupSubscriptionVerification() {
    const checkAndShowDialog = (subscriptionId) => {
      if (this.hasShownVerificationDialog) return;

      // Real server-assigned subscription ID must be non-empty and NOT start with "local-"
      if (
        subscriptionId &&
        typeof subscriptionId === 'string' &&
        subscriptionId.trim().length > 0 &&
        !subscriptionId.startsWith('local-')
      ) {
        this.hasShownVerificationDialog = true;
        console.log('[OneSignal] Server-assigned push subscription ID confirmed:', subscriptionId);

        Alert.alert(
          'Your OneSignal SDK integration is complete!',
          'You can now send Push Notifications & In-App Messages through OneSignal. Tap below to enable push notifications.',
          [
            {
              text: 'Got it',
              onPress: () => {
                this.requestPermission(true);
              },
            },
          ],
          { cancelable: false }
        );
      }
    };

    try {
      // Evaluate immediate current state at registration time
      const currentId = OneSignal.User.pushSubscription.id;
      checkAndShowDialog(currentId);

      // Retain observer for subscription state changes
      this.pushSubscriptionObserver = (event) => {
        const currentSubscriptionId =
          event?.current?.id || OneSignal.User.pushSubscription.id;
        checkAndShowDialog(currentSubscriptionId);
      };

      OneSignal.User.pushSubscription.addEventListener(
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
    try {
      this.clickListener = (event) => {
        console.log('[OneSignal] Notification clicked:', event);
        this.handleNotificationClick(event);
      };
      OneSignal.Notifications.addEventListener('click', this.clickListener);

      this.foregroundListener = (event) => {
        console.log('[OneSignal] Foreground Notification:', event);
      };
      OneSignal.Notifications.addEventListener(
        'foregroundWillDisplay',
        this.foregroundListener
      );
    } catch (err) {
      console.warn('[OneSignal] Notification listeners error:', err);
    }
  }

  /**
   * Request Notification Permissions (Android 13+ & iOS)
   */
  static async requestPermission(fallbackToSettings = true) {
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
    try {
      if (externalId) {
        OneSignal.login(String(externalId));
      }
    } catch (error) {
      console.warn('[OneSignal] Login error:', error);
    }
  }

  static logout() {
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
    try {
      OneSignal.User.addTag(key, String(value));
    } catch (error) {
      console.warn('[OneSignal] Add tag error:', error);
    }
  }

  static addTags(tags) {
    try {
      OneSignal.User.addTags(tags);
    } catch (error) {
      console.warn('[OneSignal] Add tags error:', error);
    }
  }

  static removeTag(key) {
    try {
      OneSignal.User.removeTag(key);
    } catch (error) {
      console.warn('[OneSignal] Remove tag error:', error);
    }
  }

  /**
   * Email & SMS Subscription Management
   */
  static addEmail(email) {
    try {
      if (email) {
        OneSignal.User.addEmail(email);
      }
    } catch (error) {
      console.warn('[OneSignal] Add email error:', error);
    }
  }

  static removeEmail(email) {
    try {
      if (email) {
        OneSignal.User.removeEmail(email);
      }
    } catch (error) {
      console.warn('[OneSignal] Remove email error:', error);
    }
  }

  static addSms(number) {
    try {
      if (number) {
        OneSignal.User.addSms(number);
      }
    } catch (error) {
      console.warn('[OneSignal] Add SMS error:', error);
    }
  }

  static removeSms(number) {
    try {
      if (number) {
        OneSignal.User.removeSms(number);
      }
    } catch (error) {
      console.warn('[OneSignal] Remove SMS error:', error);
    }
  }

  /**
   * Push Subscription Status
   */
  static getPushSubscriptionId() {
    try {
      return OneSignal.User.pushSubscription.id;
    } catch (error) {
      return null;
    }
  }

  static async getOptedInAsync() {
    try {
      return await OneSignal.User.pushSubscription.getOptedInAsync();
    } catch (error) {
      return false;
    }
  }

  static optIn() {
    try {
      OneSignal.User.pushSubscription.optIn();
    } catch (error) {
      console.warn('[OneSignal] Opt in error:', error);
    }
  }

  static optOut() {
    try {
      OneSignal.User.pushSubscription.optOut();
    } catch (error) {
      console.warn('[OneSignal] Opt out error:', error);
    }
  }

  /**
   * Handle user tapping on a notification (Deep Link / Article / Screen)
   */
  static handleNotificationClick(event) {
    const data = event?.notification?.additionalData || {};
    const { postId, post_id, url, screen } = data;
    const targetPostId = postId || post_id;

    if (this.navigationRef?.isReady?.()) {
      if (targetPostId) {
        this.navigationRef.navigate('ArticleDetail', { postId: parseInt(targetPostId, 10) });
        return;
      }

      if (screen === 'LiveTV') {
        this.navigationRef.navigate('MainTabs', { screen: 'LiveTV' });
        return;
      }

      if (screen) {
        try {
          this.navigationRef.navigate(screen);
          return;
        } catch (e) {}
      }
    }

    const launchUrl = url || event?.notification?.launchURL;
    if (launchUrl) {
      Linking.canOpenURL(launchUrl).then((supported) => {
        if (supported) {
          Linking.openURL(launchUrl);
        }
      });
    }
  }

  /**
   * Cleanup listeners on unmount
   */
  static cleanup() {
    try {
      if (this.pushSubscriptionObserver) {
        OneSignal.User.pushSubscription.removeEventListener(
          'change',
          this.pushSubscriptionObserver
        );
        this.pushSubscriptionObserver = null;
      }
      if (this.clickListener) {
        OneSignal.Notifications.removeEventListener('click', this.clickListener);
        this.clickListener = null;
      }
      if (this.foregroundListener) {
        OneSignal.Notifications.removeEventListener(
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
