import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Linking,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

const MOBILE_USER_AGENT = Platform.select({
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Mobile; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  default: 'Mozilla/5.0 (Linux; Android 14; Mobile; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
});

export const WebExtrasScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { url, title, isPhonePeCheckout, wpCookies } = route.params || {};
  const { colors, isDarkMode } = useTheme();
  const { user, syncUserSubscription } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentWebUrl, setCurrentWebUrl] = useState(url || '');

  const activeCookies = wpCookies || user?.wpCookies || '';

  const handleShare = async () => {
    try {
      await Share.share({
        title: title || 'Whiteswan TV News',
        message: `${title || 'Whiteswan TV News'}\n${url}`,
        url: url,
      });
    } catch (e) {
      console.error('Share error:', e);
    }
  };

  const handleNavigationStateChange = (navState) => {
    const currentUrl = navState?.url || '';
    setCurrentWebUrl(currentUrl);
    if (
      currentUrl.includes('order-received') ||
      currentUrl.includes('payment=success') ||
      currentUrl.includes('status=SUCCESS') ||
      currentUrl.includes('code=PAYMENT_SUCCESS') ||
      currentUrl.includes('wc-api=wc_phonepe') ||
      currentUrl.includes('wc-api')
    ) {
      if (isPhonePeCheckout) {
        if (typeof syncUserSubscription === 'function') {
          syncUserSubscription().catch(() => {});
        }
        Alert.alert(
          'Payment Successful! 🎉',
          'Thank you for subscribing to Whiteswan TV News Premium VIP. Your VIP benefits are now active!',
          [{ text: 'Start Reading', onPress: () => navigation.goBack() }]
        );
        return;
      }
      navigation.goBack();
    }
  };

  const handleShouldStartLoadWithRequest = (request) => {
    const { url: requestUrl } = request;
    if (
      requestUrl.startsWith('phonepe://') ||
      requestUrl.startsWith('ppe://') ||
      requestUrl.startsWith('upi://') ||
      requestUrl.startsWith('tez://') ||
      requestUrl.startsWith('gpay://') ||
      requestUrl.startsWith('paytmmp://') ||
      requestUrl.startsWith('paytm://') ||
      requestUrl.startsWith('cred://') ||
      requestUrl.startsWith('credpay://') ||
      requestUrl.startsWith('bhim://') ||
      requestUrl.startsWith('amazonpay://') ||
      requestUrl.startsWith('supermoney://') ||
      requestUrl.startsWith('whatsapp://') ||
      requestUrl.startsWith('intent://') ||
      (requestUrl.includes('pay?') && requestUrl.includes('pa='))
    ) {
      try {
        let openUrl = requestUrl;
        if (requestUrl.startsWith('intent://')) {
          const schemeMatch = requestUrl.match(/scheme=([^;]+)/);
          const pkgMatch = requestUrl.match(/package=([^;]+)/);
          if (schemeMatch && schemeMatch[1]) {
            const scheme = schemeMatch[1];
            openUrl = requestUrl.replace(/^intent:\/\//, `${scheme}://`).split('#Intent')[0];
          } else if (pkgMatch && pkgMatch[1] && requestUrl.includes('upi')) {
            const upiPayload = requestUrl.split('#Intent')[0].replace(/^intent:\/\//, 'upi://');
            openUrl = upiPayload;
          }
        }
        Linking.openURL(openUrl).catch(() => {
          if (openUrl.includes('pa=') && !openUrl.startsWith('upi://')) {
            const query = openUrl.includes('?') ? openUrl.split('?')[1] : '';
            if (query) {
              Linking.openURL(`upi://pay?${query}`).catch(() => {});
            }
          }
        });
      } catch (e) {}
      return false;
    }
    return true;
  };

  const cleanAppCss = `
    header, footer, nav,
    .site-header, .site-footer, .header, .footer,
    .td-header-wrap, .td-footer-wrapper, .mobile-menu-wrapper, .td-menu-background,
    .header-main, .mobile-header, .top-bar, .sub-header, .top-bar-style-1,
    #site-header, #masthead, .masthead, .td-header-template-wrap, .td-banner-wrap-full,
    [class*="header-"], [class*="-header"], [class*="td-header"],
    [id*="header-"], [id*="-header"],
    [class*="navbar"], [class*="nav-"],
    .social-icons, .subscribe-btn, #search-trigger, #mobile-toggle,
    .wp-site-blocks > header, .wp-site-blocks > footer,
    .woocommerce-error, .woocommerce-NoticeGroup, .election-banner, .floating-bar,
    [class*="election"], [class*="ticker"], [id*="ticker"], .notice-banner,
    .custom-wc-switch-prompt, .woocommerce-privacy-policy-text,
    .adnl-slidein-popup, .adnl-popup-overlay, #ws-index2-widget,
    .td-a-rec, .td-a-rec-id-header, .td_block_wrap, .td-post-content,
    .td-category-header, .td-post-template-default, .td-crumb-container,
    .td-sub-footer-container, .td-pb-row, .td-main-content-wrap > .td-container,
    #td-outer-wrap > .td-header-wrap, #td-outer-wrap > .td-footer-wrapper,
    .woocommerce-order-pay > .shop_table, .woocommerce-order-pay > ul.order_details,
    .woocommerce-order-pay > p, .woocommerce-order-pay > h2, .woocommerce-order-pay > h3,
    .woocommerce-order-pay .woocommerce-order-overview,
    .woocommerce-order-details, .woocommerce-customer-details, .order_details,
    .shop_table, #order_review,
    .advertisement, [class*="advertisement"], [id*="advertisement"] {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
    body, html {
      padding: 0 !important;
      margin: 0 !important;
      background-color: #ffffff !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    }
    .woocommerce, .woocommerce-page, .woocommerce-checkout {
      max-width: 100% !important;
      margin: 0 auto !important;
      padding: 12px !important;
    }
  `;

  const injectedJs = `
    (function() {
      var style = document.createElement('style');
      style.innerHTML = \`${cleanAppCss}\`;
      document.head.appendChild(style);

      var isWpOrderPage = window.location.hostname.includes('whiteswantvnews.com') && 
                          (window.location.pathname.includes('order-pay') || window.location.pathname.includes('checkout'));

      if (isWpOrderPage) {
        var existingOverlay = document.getElementById('wstv-phonepe-overlay');
        if (!existingOverlay) {
          var overlay = document.createElement('div');
          overlay.id = 'wstv-phonepe-overlay';
          overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#ffffff;z-index:99999999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:-apple-system,sans-serif;text-align:center;padding:24px;box-sizing:border-box;';
          overlay.innerHTML = '<div style="width:52px;height:52px;border:4px solid #E0F2FE;border-top:4px solid #00A3E8;border-radius:50%;animation:wstvSpin 0.8s linear infinite;margin-bottom:20px;"></div><div style="font-size:19px;font-weight:700;color:#0F172A;margin-bottom:8px;">Connecting to PhonePe...</div><div style="font-size:14px;color:#64748B;">Please wait while we secure your payment session.</div><style>@keyframes wstvSpin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}</style>';
          document.body.appendChild(overlay);
        }
      }

      var sanitizeUI = function() {
        var elements = document.querySelectorAll('header, footer, .td-header-wrap, .td-footer-wrapper, .woocommerce-error, .woocommerce-NoticeGroup, [class*="ticker"], [class*="election"], [id*="ticker"], [id*="election"], .td-a-rec, .td-banner-wrap-full');
        elements.forEach(function(el) {
          el.style.display = 'none';
        });

        var nodes = document.querySelectorAll('div, p, li, span');
        nodes.forEach(function(n) {
          if (n.textContent && (n.textContent.toLowerCase().includes('guest order') || n.textContent.toLowerCase().includes('pay for order'))) {
            if (n.id !== 'wstv-phonepe-overlay') {
              n.style.display = 'none';
            }
          }
        });
      };

      sanitizeUI();
      setTimeout(sanitizeUI, 100);
      setTimeout(sanitizeUI, 300);
      setTimeout(sanitizeUI, 800);

      // Direct Place Order: Auto-submit pay-for-order button to navigate directly to PhonePe
      var autoSubmitOrder = function() {
        if (window.__wstvOrderSubmitted) return;
        var btn = document.getElementById('place_order') ||
                  document.querySelector('button[name="woocommerce_checkout_place_order"]') ||
                  document.querySelector('button.button.alt') ||
                  document.querySelector('#order_review input[type="submit"]') ||
                  document.querySelector('#order_review button[type="submit"]');

        if (btn) {
          window.__wstvOrderSubmitted = true;
          try {
            btn.click();
          } catch (e) {
            var form = document.getElementById('order_review');
            if (form) form.submit();
          }
        } else {
          var form = document.getElementById('order_review');
          if (form) {
            window.__wstvOrderSubmitted = true;
            try {
              form.submit();
            } catch (e) {}
          }
        }
      };

      autoSubmitOrder();
      setTimeout(autoSubmitOrder, 100);
      setTimeout(autoSubmitOrder, 300);
      setTimeout(autoSubmitOrder, 600);
      setTimeout(autoSubmitOrder, 1200);
    })();
    true;
  `;

  const isIntermediateWpPage =
    isPhonePeCheckout &&
    (loading ||
      !currentWebUrl ||
      currentWebUrl.includes('whiteswantvnews.com') ||
      currentWebUrl.includes('order-pay') ||
      currentWebUrl.includes('checkout'));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Navigation Bar */}
      <View
        style={[
          styles.navBar,
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

        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {title || (isPhonePeCheckout ? 'PhonePe Payment' : 'Whiteswan Gateway')}
        </Text>

        <TouchableOpacity
          style={styles.shareBtn}
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <Ionicons name="share-social-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Main WebView Container */}
      <View style={{ flex: 1, position: 'relative' }}>
        {/* In-App WebView with Mobile Chrome User-Agent for full UPI Intent Apps */}
        <WebView
          source={{
            uri: url,
            headers: activeCookies ? { Cookie: activeCookies } : {},
          }}
          userAgent={MOBILE_USER_AGENT}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={handleNavigationStateChange}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          injectedJavaScriptBeforeContentLoaded={injectedJs}
          injectedJavaScript={injectedJs}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          thirdPartyCookiesEnabled={true}
          sharedCookiesEnabled={true}
          mixedContentMode="always"
          setSupportMultipleWindows={false}
          originWhitelist={['*']}
          allowsInlineMediaPlayback={true}
          showsVerticalScrollIndicator={false}
          style={styles.webview}
        />

        {/* Full-Screen Branded Loading Session (Replaces intermediate WordPress Order-Pay / Receipt page) */}
        {isIntermediateWpPage && (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              styles.fullScreenOverlay,
              { backgroundColor: colors.background },
            ]}
          >
            <View
              style={[
                styles.loadingCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.gatewayLogoCircle}>
                <Image
                  source={require('../../assets/logo.png')}
                  style={styles.gatewayLogo}
                  resizeMode="contain"
                />
              </View>

              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 18 }} />

              <Text style={[styles.gatewayTitle, { color: colors.text }]}>
                Connecting to PhonePe...
              </Text>

              <Text style={[styles.gatewaySubtitle, { color: colors.textSecondary }]}>
                Please wait while we secure your payment session and redirect you to the payment gateway.
              </Text>

              <View
                style={[
                  styles.secureBadge,
                  { backgroundColor: isDarkMode ? '#064E3B' : '#ECFDF5', borderColor: '#059669' },
                ]}
              >
                <Ionicons name="shield-checkmark" size={14} color="#059669" />
                <Text style={styles.secureBadgeText}>256-Bit Encrypted & Verified</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  shareBtn: {
    padding: 6,
  },
  webview: {
    flex: 1,
  },
  fullScreenOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 99999,
  },
  loadingCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  gatewayLogoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#00A3E8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#00A3E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  gatewayLogo: {
    width: 48,
    height: 48,
  },
  gatewayTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  gatewaySubtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  secureBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
});
