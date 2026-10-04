import { Linking, Platform } from 'react-native';

// Merchant configuration for Whiteswan TV News Mobile App
export const PHONEPE_CONFIG = {
  merchantId: process.env.EXPO_PUBLIC_PHONEPE_MERCHANT_ID || 'M23BOWZSDX87L',
  merchantName: process.env.EXPO_PUBLIC_PHONEPE_MERCHANT_NAME || 'Whiteswan TV News',
  upiVpa: process.env.EXPO_PUBLIC_PHONEPE_MERCHANT_VPA || 'whiteswantvnews@ybl',
  env: process.env.EXPO_PUBLIC_PHONEPE_ENV || 'PRODUCTION',
  saltKey: process.env.EXPO_PUBLIC_PHONEPE_SALT_KEY || '',
  saltIndex: process.env.EXPO_PUBLIC_PHONEPE_SALT_INDEX || '1',
  currency: 'INR',
};

/**
 * Generate UPI Payment data and deep link URLs for Mobile APK
 */
export const getUpiPaymentData = ({ plan, user }) => {
  const cleanAmount = (plan?.price || '299').replace(/[^\d.]/g, '');
  const txnId = `WSTV_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const note = encodeURIComponent(`Whiteswan TV ${plan?.name || 'Premium'} Subscription`);
  const payeeName = encodeURIComponent(PHONEPE_CONFIG.merchantName);
  const payeeVpa = encodeURIComponent(PHONEPE_CONFIG.upiVpa);

  // NPCI standard UPI parameters
  const upiQuery = `pa=${payeeVpa}&pn=${payeeName}&am=${cleanAmount}&cu=${PHONEPE_CONFIG.currency}&tn=${note}&tr=${txnId}&mc=5732`;

  const phonePeUrl = `phonepe://pay?${upiQuery}`;
  const gpayUrl = `tez://upi/pay?${upiQuery}`;
  const paytmUrl = `paytmmp://pay?${upiQuery}`;
  const credUrl = `credpay://upi/pay?${upiQuery}`;
  const amazonPayUrl = `amazonpay://upi/pay?${upiQuery}`;
  const bhimUrl = `bhim://pay?${upiQuery}`;
  const genericUpiUrl = `upi://pay?${upiQuery}`;

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    `upi://pay?${upiQuery}`
  )}`;

  return {
    cleanAmount,
    txnId,
    payeeName: PHONEPE_CONFIG.merchantName,
    payeeVpa: PHONEPE_CONFIG.upiVpa,
    phonePeUrl,
    gpayUrl,
    paytmUrl,
    credUrl,
    amazonPayUrl,
    bhimUrl,
    genericUpiUrl,
    qrCodeUrl,
  };
};

/**
 * Launch specific UPI App directly on Android APK / iOS
 */
export const launchSpecificUpiApp = async (url) => {
  try {
    const canOpen = await Linking.canOpenURL(url).catch(() => false);
    if (canOpen) {
      await Linking.openURL(url);
      return { success: true };
    }
    if (Platform.OS === 'android') {
      await Linking.openURL(url);
      return { success: true };
    }
    // Fallback to generic upi:// if specific app is not installed
    if (url.includes('pa=') && !url.startsWith('upi://')) {
      const query = url.includes('?') ? url.split('?')[1] : '';
      if (query) {
        await Linking.openURL(`upi://pay?${query}`);
        return { success: true };
      }
    }
    return { success: false, error: 'App not installed' };
  } catch (err) {
    if (url.includes('pa=') && !url.startsWith('upi://')) {
      try {
        const query = url.includes('?') ? url.split('?')[1] : '';
        if (query) {
          await Linking.openURL(`upi://pay?${query}`);
          return { success: true };
        }
      } catch (e2) {}
    }
    return { success: false, error: err.message };
  }
};

/**
 * Universal Base64 Encoder
 */
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

/**
 * Create WooCommerce Order via REST API for PhonePe Payment Gateway
 */
export const createWcPhonePeOrder = async ({ plan, user }) => {
  try {
    const WC_KEY = (process.env.EXPO_PUBLIC_WC_CONSUMER_KEY || 'ck_a33ceb8f1bf8a8455edd5575d4ade10315ead10f').trim();
    const WC_SECRET = (process.env.EXPO_PUBLIC_WC_CONSUMER_SECRET || 'cs_cf90612243340ff344b70cc550adf175862f69cc').trim();
    const authHeader = `Basic ${encodeAuth(`${WC_KEY}:${WC_SECRET}`)}`;

    const productId = plan?.productId || (plan?.id === 'monthly' ? 176441 : 173639);
    const firstName = user?.firstName || (user?.name ? user.name.split(' ')[0] : 'Customer');
    const lastName = user?.lastName || (user?.name && user.name.split(' ').length > 1 ? user.name.split(' ').slice(1).join(' ') : 'Member');
    const email = user?.email || 'customer@whiteswantvnews.com';
    const phone = user?.phone || user?.address?.phone || '9633052562';

    // 1. Resolve registered WooCommerce customer ID
    let resolvedCustomerId = 0;
    if (user?.id) {
      const numericId = String(user.id).replace(/^wp_/, '');
      if (/^\d+$/.test(numericId) && Number(numericId) < 1000000000) {
        resolvedCustomerId = Number(numericId);
      }
    }

    if (!resolvedCustomerId && user?.email) {
      try {
        const custRes = await fetch(
          `https://whiteswantvnews.com/wp-json/wc/v3/customers?email=${encodeURIComponent(user.email.trim().toLowerCase())}`,
          {
            headers: {
              Authorization: authHeader,
              Accept: 'application/json',
              'User-Agent': 'WhiteswanTVNews/1.0',
            },
          }
        );
        if (custRes.ok) {
          const list = await custRes.json();
          if (Array.isArray(list) && list.length > 0 && list[0]?.id) {
            resolvedCustomerId = Number(list[0].id);
          }
        }
      } catch (e) {}
    }

    const orderPayload = {
      payment_method: 'phonepe',
      payment_method_title: 'PhonePe Payment Solutions',
      set_paid: false,
      customer_id: resolvedCustomerId || 0,
      billing: {
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone,
        address_1: user?.address?.street || 'Kerala',
        city: user?.address?.city || 'Kochi',
        state: 'KL',
        postcode: user?.address?.pincode || '682001',
        country: 'IN',
      },
      line_items: [
        {
          product_id: productId,
          quantity: 1,
        },
      ],
    };

    const res = await fetch('https://whiteswantvnews.com/wp-json/wc/v3/orders', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Mobile) WhiteswanTVNews/1.0',
      },
      body: JSON.stringify(orderPayload),
    });

    if (res.ok) {
      const order = await res.json();
      
      // Instantly construct direct PhonePe Gateway URL (Page 2) so user never sees intermediate table (Page 1)
      const directPaymentUrl = order?.id && order?.order_key
        ? `https://whiteswantvnews.com/checkout/order-pay/${order.id}/?key=${order.order_key}&order=${order.id}`
        : order.payment_url;

      return {
        success: true,
        orderId: order.id,
        orderKey: order.order_key,
        total: order.total,
        paymentUrl: directPaymentUrl,
      };
    }
  } catch (e) {
    console.log('createWcPhonePeOrder error:', e.message);
  }
  return { success: false };
};

/**
 * Launch PhonePe / UPI payment on Mobile APK
 */
export const launchPhonePePayment = async ({ plan, user }) => {
  const upiData = getUpiPaymentData({ plan, user });

  // 1. Try direct PhonePe app intent
  try {
    const canOpenPhonePe = await Linking.canOpenURL(upiData.phonePeUrl).catch(() => false);
    if (canOpenPhonePe) {
      await Linking.openURL(upiData.phonePeUrl);
      return { success: true, type: 'phonepe_app', txnId: upiData.txnId, upiData };
    }
  } catch (e) {}

  // 2. Try universal UPI intent (triggers Android app chooser)
  try {
    const canOpenUpi = await Linking.canOpenURL(upiData.genericUpiUrl).catch(() => false);
    if (canOpenUpi) {
      await Linking.openURL(upiData.genericUpiUrl);
      return { success: true, type: 'upi_chooser', txnId: upiData.txnId, upiData };
    }
  } catch (e) {}

  // 3. Try direct Android launch
  if (Platform.OS === 'android') {
    try {
      await Linking.openURL(upiData.phonePeUrl);
      return { success: true, type: 'phonepe_app_direct', txnId: upiData.txnId, upiData };
    } catch (e1) {
      try {
        await Linking.openURL(upiData.genericUpiUrl);
        return { success: true, type: 'generic_upi_direct', txnId: upiData.txnId, upiData };
      } catch (e2) {}
    }
  }

  // 4. Open native in-app payment sheet
  return { success: false, needsModal: true, txnId: upiData.txnId, upiData };
};
