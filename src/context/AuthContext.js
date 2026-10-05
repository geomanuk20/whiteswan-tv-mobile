import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import {
  getStateCode,
  getStateName,
  COUNTRIES_LIST,
  getCountryCode,
  getCountryName,
} from '../constants/indianStates';

const SESSION_STORAGE_KEY = '@whiteswan_user_session';
const USERS_DB_KEY = '@whiteswan_registered_users_db';
const WP_SITE_URL = 'https://whiteswantvnews.com';

const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

// WooCommerce REST API v3 configuration
const WC_CONSUMER_KEY = (process.env.EXPO_PUBLIC_WC_CONSUMER_KEY || 'ck_a33ceb8f1bf8a8455edd5575d4ade10315ead10f').trim();
const WC_CONSUMER_SECRET = (process.env.EXPO_PUBLIC_WC_CONSUMER_SECRET || 'cs_cf90612243340ff344b70cc550adf175862f69cc').trim();

/**
 * Universal Base64 Encoder (Cross-platform support for Expo/React Native & Web)
 */
const encodeBase64 = (str) => {
  if (typeof btoa === 'function') {
    try {
      return btoa(str);
    } catch (e) {}
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64');
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (
    let block = 0, charCode, idx = 0, map = chars;
    str.charAt(idx | 0) || ((map = '='), idx % 1);
    output += map.charAt(63 & (block >> (8 - (idx % 1) * 8)))
  ) {
    charCode = str.charCodeAt((idx += 3 / 4));
    if (charCode > 0xff) {
      throw new Error("'btoa' failed: The string contains characters outside Latin1 range.");
    }
    block = (block << 8) | charCode;
  }
  return output;
};

/**
 * Safe Date Parser (prevents RangeError: Date value out of bounds on invalid DB strings)
 */
const parseSafeDate = (val, fallback = new Date()) => {
  if (!val) return fallback;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? fallback : val;
  }
  try {
    const str = String(val).trim();
    if (
      !str ||
      str === '0000-00-00 00:00:00' ||
      str === '0000-00-00' ||
      str === '0' ||
      str === 'false' ||
      str === 'Recent' ||
      str === 'null' ||
      str === 'undefined'
    ) {
      return fallback;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      if (year >= 2000 && year <= 2100) {
        return d;
      }
    }
  } catch (e) {}
  return fallback;
};

const toSafeIsoString = (val, fallback = new Date()) => {
  const d = parseSafeDate(val, fallback);
  return d.toISOString();
};

/**
 * Helper: WooCommerce REST API authentication headers (Basic Auth: ck_... : cs_...)
 */
const getWcRestAuthHeaders = () => {
  if (!WC_CONSUMER_KEY || !WC_CONSUMER_SECRET) return null;
  const basicAuth = encodeBase64(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`);
  return {
    Authorization: `Basic ${basicAuth}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'WhiteswanTVNewsApp/1.0',
  };
};

const AuthContext = createContext({
  user: null,
  isLoggedIn: false,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  updateProfile: async () => {},
  syncWordPressData: async () => {},
  refreshUserData: async () => {},
  syncUserSubscription: async () => {},
  fetchWcSubscriptions: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const isLoggedOutRef = React.useRef(false);

  /**
   * Helper: Fetch media attachment source URL by attachment ID
   */
  const fetchMediaSourceUrl = async (mediaId, restHeaders) => {
    if (!mediaId) return '';
    try {
      const headers = restHeaders || {
        'User-Agent': 'WhiteswanTVNewsApp/1.0',
        Accept: 'application/json',
      };
      const res = await fetch(`${WP_SITE_URL}/wp-json/wp/v2/media/${mediaId}`, {
        headers,
      });
      if (res.ok) {
        const mediaData = await res.json();
        if (mediaData?.source_url) {
          return mediaData.source_url;
        }
        if (mediaData?.media_details?.sizes?.medium?.source_url) {
          return mediaData.media_details.sizes.medium.source_url;
        }
        if (mediaData?.guid?.rendered) {
          return mediaData.guid.rendered;
        }
      }
    } catch (e) {
      console.log('fetchMediaSourceUrl note:', e.message);
    }
    return '';
  };

  /**
   * Helper: Resolve custom avatar URL from WordPress media attachment ID or metadata
   */
  const resolveCustomAvatar = async (customer, restHeaders) => {
    if (!customer) return '';

    // 1. Inspect meta_data with strict key priority (WhiteSwan direct URL first)
    if (Array.isArray(customer.meta_data) && customer.meta_data.length > 0) {
      const metaMap = {};
      for (const meta of customer.meta_data) {
        if (meta && meta.key) {
          metaMap[meta.key] = meta.value;
        }
      }

      const avatarPriorityKeys = [
        'whiteswan_custom_avatar_url',
        'custom_profile_avatar',
        'avatar',
        'customer_avatar',
        'user_profile_avatar',
        'profile_photo',
        'profile_picture',
        'wp_user_avatar',
        'simple_local_avatar',
        'basic_user_avatar',
        'user_avatar',
        'whiteswan_custom_avatar_id',
        'avatar_id',
        'user_avatar_id',
      ];

      for (const key of avatarPriorityKeys) {
        if (!(key in metaMap)) continue;
        const rawVal = metaMap[key];
        if (!rawVal || rawVal === '0' || rawVal === 0 || rawVal === '' || (typeof rawVal === 'string' && rawVal.trim() === '')) {
          continue;
        }

        // If string (URL or Data URI)
        if (typeof rawVal === 'string') {
          const trimmed = rawVal.trim();
          if (trimmed.startsWith('file://') || trimmed.includes('/ExperienceData/') || trimmed.includes('/ImagePicker/')) {
            continue;
          }
          if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/')) {
            return trimmed.replace(/&amp;/g, '&');
          }
        }

        // If object structure (Simple Local Avatars / Media arrays)
        if (typeof rawVal === 'object' && rawVal !== null) {
          const checkObjUrl = (urlStr) => {
            if (typeof urlStr === 'string') {
              const t = urlStr.trim();
              if (!t.startsWith('file://') && (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('data:image/'))) {
                return t.replace(/&amp;/g, '&');
              }
            }
            return null;
          };

          const matched = checkObjUrl(rawVal.full) || checkObjUrl(rawVal.url) || checkObjUrl(rawVal.source_url) || checkObjUrl(rawVal['96']) || checkObjUrl(rawVal['150']);
          if (matched) return matched;

          if (rawVal.media_id || rawVal.id) {
            const mid = String(rawVal.media_id || rawVal.id).trim();
            if (/^\d+$/.test(mid) && mid !== '0') {
              const resolved = await fetchMediaSourceUrl(mid, restHeaders);
              if (resolved && !resolved.startsWith('file://')) return resolved.replace(/&amp;/g, '&');
            }
          }
        }

        // If numeric attachment ID
        const mediaId = String(rawVal).trim();
        if (/^\d+$/.test(mediaId) && mediaId !== '0') {
          const resolved = await fetchMediaSourceUrl(mediaId, restHeaders);
          if (resolved && !resolved.startsWith('file://')) return resolved.replace(/&amp;/g, '&');
        }
      }
    }

    // 2. Query WordPress Core User REST API (/wp-json/wp/v2/users/<id>)
    if (customer.id && /^\d+$/.test(String(customer.id))) {
      try {
        const wpUserRes = await fetch(`${WP_SITE_URL}/wp-json/wp/v2/users/${customer.id}`, {
          headers: { 'User-Agent': 'WhiteswanTVNewsApp/1.0', Accept: 'application/json' },
        });
        if (wpUserRes.ok) {
          const wpUser = await wpUserRes.json();
          if (wpUser?.avatar_urls) {
            const avatarUrl = wpUser.avatar_urls['96'] || wpUser.avatar_urls['48'] || wpUser.avatar_urls['24'];
            if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('http') && !avatarUrl.startsWith('file://')) {
              return avatarUrl.replace(/&amp;/g, '&');
            }
          }
        }
      } catch (e) {}
    }

    // 3. Gravatar or customer.avatar_url fallback
    if (customer.avatar_url && typeof customer.avatar_url === 'string') {
      const trimmed = customer.avatar_url.trim();
      if (trimmed && !trimmed.startsWith('file://') && (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/'))) {
        return trimmed.replace(/&amp;/g, '&');
      }
    }

    return '';
  };

  /**
   * REST API: Fetch WooCommerce Customer details by email, customer ID, or username
   */
  const fetchWcCustomer = async (emailOrId) => {
    const restHeaders = getWcRestAuthHeaders();
    if (!restHeaders || !emailOrId) return null;

    try {
      let customer = null;
      const strVal = String(emailOrId).trim();
      if (!strVal) return null;

      const cleanNumericId = strVal.replace(/^wp_/, '');

      // 1. If it's a positive integer (e.g. 1, 667, 1232, 1723 or wp_1723), query direct customer ID endpoint
      if (/^\d+$/.test(cleanNumericId)) {
        try {
          const res = await fetch(`${WP_SITE_URL}/wp-json/wc/v3/customers/${cleanNumericId}`, {
            headers: restHeaders,
          });
          if (res.ok) {
            const data = await res.json();
            if (data && String(data.id) === cleanNumericId) customer = data;
          }
        } catch (e) {}
      }

      // 2. Query with role=all to search by exact email
      if (!customer && strVal.includes('@')) {
        try {
          const res = await fetch(`${WP_SITE_URL}/wp-json/wc/v3/customers?role=all&email=${encodeURIComponent(strVal.toLowerCase())}`, {
            headers: restHeaders,
          });
          if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list) && list.length > 0) {
              const exact = list.find((c) => c && c.email && c.email.toLowerCase() === strVal.toLowerCase());
              if (exact) customer = exact;
            }
          }
        } catch (e) {}
      }

      // 3. Query search with role=all by username only
      if (!customer && !strVal.startsWith('wp_')) {
        try {
          const cleanQuery = strVal.trim();
          const res = await fetch(`${WP_SITE_URL}/wp-json/wc/v3/customers?role=all&search=${encodeURIComponent(cleanQuery)}`, {
            headers: restHeaders,
          });
          if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list) && list.length > 0) {
              const exact = list.find(
                (c) =>
                  (c && c.username && c.username.toLowerCase() === cleanQuery.toLowerCase()) ||
                  (c && c.email && c.email.toLowerCase() === cleanQuery.toLowerCase())
              );
              if (exact) customer = exact;
            }
          }
        } catch (e) {}
      }

      // 4. Try current logged-in user email if different and valid
      if (!customer && user?.email && user.email.toLowerCase() !== strVal.toLowerCase() && user.email.includes('@')) {
        try {
          const res = await fetch(`${WP_SITE_URL}/wp-json/wc/v3/customers?role=all&email=${encodeURIComponent(user.email.toLowerCase())}`, {
            headers: restHeaders,
          });
          if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list) && list.length > 0) {
              const exact = list.find((c) => c && c.email && c.email.toLowerCase() === user.email.toLowerCase());
              if (exact) customer = exact;
            }
          }
        } catch (e) {}
      }

      if (!customer || !customer.id) return null;

      const billing = customer.billing || {};
      const shipping = customer.shipping || {};
      const resolvedAvatar = await resolveCustomAvatar(customer, restHeaders);
      const email = customer.email || billing.email || '';
      const emailKey = email ? email.toLowerCase() : '';

      if (resolvedAvatar && (resolvedAvatar.startsWith('http') || resolvedAvatar.startsWith('data:image')) && emailKey) {
        try {
          await AsyncStorage.setItem(`@whiteswan_avatar_${emailKey}`, resolvedAvatar);
        } catch (e) {}
      } else if (emailKey) {
        try {
          await AsyncStorage.removeItem(`@whiteswan_avatar_${emailKey}`);
        } catch (e) {}
      }

      return {
        id: customer.id,
        email: email,
        firstName: customer.first_name || billing.first_name || '',
        lastName: customer.last_name || billing.last_name || '',
        name: `${customer.first_name || billing.first_name || ''} ${customer.last_name || billing.last_name || ''}`.trim() || customer.username || 'Member',
        username: customer.username || '',
        avatar: resolvedAvatar || customer.avatar_url || '',
        phone: billing.phone || '',
        address: {
          firstName: billing.first_name || customer.first_name || '',
          lastName: billing.last_name || customer.last_name || '',
          name: `${billing.first_name || ''} ${billing.last_name || ''}`.trim(),
          country: getCountryName(billing.country || 'India'),
          street: billing.address_1 || '',
          street2: billing.address_2 || '',
          city: billing.city || '',
          district: billing.city || '',
          state: getStateName(billing.state || 'Kerala'),
          pincode: billing.postcode || '',
          phone: billing.phone || '',
          email: billing.email || customer.email || '',
        },
        shippingAddress: {
          firstName: shipping.first_name || customer.first_name || '',
          lastName: shipping.last_name || customer.last_name || '',
          name: `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim(),
          country: getCountryName(shipping.country || 'India'),
          street: shipping.address_1 || '',
          street2: shipping.address_2 || '',
          city: shipping.city || '',
          state: getStateName(shipping.state || 'Kerala'),
          pincode: shipping.postcode || '',
        },
      };
    } catch (e) {
      console.log('fetchWcCustomer note:', e.message);
      return null;
    }
  };

  /**
   * REST API: Update WooCommerce Customer details (profile, billing, shipping)
   */
  const updateWcCustomer = async (emailOrId, updatePayload) => {
    const restHeaders = getWcRestAuthHeaders();
    if (!restHeaders || !emailOrId) return false;

    try {
      let customerId = null;
      const strVal = String(emailOrId).trim();
      const cleanNumericId = strVal.replace(/^wp_/, '');
      if (/^\d+$/.test(cleanNumericId)) {
        customerId = cleanNumericId;
      } else {
        const found = await fetchWcCustomer(emailOrId);
        if (found?.id) {
          customerId = String(found.id);
        }
      }

      if (customerId) {
        const res = await fetch(`${WP_SITE_URL}/wp-json/wc/v3/customers/${customerId}`, {
          method: 'PUT',
          headers: restHeaders,
          body: JSON.stringify(updatePayload),
        });

        if (res.ok) {
          console.log('WooCommerce REST API customer updated successfully for ID:', customerId);
          return true;
        } else {
          const errJson = await res.json().catch(() => ({}));
          console.log('WooCommerce REST API customer update note:', errJson?.message || res.status);
        }
      } else {
        const targetEmail = strVal.includes('@') ? strVal : (updatePayload?.billing?.email || user?.email || '');
        if (targetEmail) {
          const res = await fetch(`${WP_SITE_URL}/wp-json/wc/v3/customers`, {
            method: 'POST',
            headers: restHeaders,
            body: JSON.stringify({
              email: targetEmail,
              password: `WcUser@${Date.now()}`,
              ...updatePayload,
            }),
          });
          if (res.ok) {
            console.log('WooCommerce REST API customer created successfully for email:', targetEmail);
            return true;
          }
        }
      }
    } catch (e) {
      console.log('updateWcCustomer note:', e.message);
    }
    return false;
  };

  /**
   * REST API: Fetch WooCommerce Orders for a specific user
   */
  const fetchWcOrders = async (userOrEmailOrId) => {
    const restHeaders = getWcRestAuthHeaders();
    if (!restHeaders || !userOrEmailOrId) return null;

    try {
      let orders = [];
      let customerId = null;
      let targetEmail = '';
      let targetUsername = '';

      if (typeof userOrEmailOrId === 'object' && userOrEmailOrId !== null) {
        targetEmail = userOrEmailOrId.email ? userOrEmailOrId.email.trim().toLowerCase() : '';
        targetUsername = userOrEmailOrId.username ? userOrEmailOrId.username.trim() : '';
        const rawId = String(userOrEmailOrId.numericId || userOrEmailOrId.id || '').replace(/^wp_/, '');
        if (/^\d+$/.test(rawId) && rawId !== '0') {
          customerId = rawId;
        }
      } else {
        const strVal = String(userOrEmailOrId).trim();
        if (/^\d+$/.test(strVal)) {
          customerId = strVal;
        } else if (strVal.includes('@')) {
          targetEmail = strVal.toLowerCase();
        } else {
          targetUsername = strVal;
        }
      }

      // If we don't have numeric customerId yet, lookup via WooCommerce customer endpoints
      if (!customerId && (targetEmail || targetUsername)) {
        try {
          const customerObj = await fetchWcCustomer(targetEmail || targetUsername);
          if (customerObj && customerObj.id && /^\d+$/.test(String(customerObj.id))) {
            customerId = String(customerObj.id);
          }
        } catch (e) {}
      }

      // Strategy 1: Query by customer ID if known
      if (customerId && customerId !== '0') {
        try {
          const res = await fetch(`${WP_SITE_URL}/wp-json/wc/v3/orders?customer=${customerId}&per_page=50`, {
            headers: restHeaders,
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              orders = data.filter((o) => {
                const oCustId = o.customer_id ? String(o.customer_id) : '';
                const bEmail = o.billing?.email ? o.billing.email.trim().toLowerCase() : '';
                const sEmail = o.shipping?.email ? o.shipping.email.trim().toLowerCase() : '';
                if (customerId && customerId !== '0' && oCustId === customerId) return true;
                if (targetEmail && (bEmail === targetEmail || sEmail === targetEmail)) return true;
                return false;
              });
            }
          }
        } catch (e) {}
      }

      // Strategy 2: Query by search string (email)
      if (orders.length === 0 && targetEmail) {
        try {
          const res = await fetch(`${WP_SITE_URL}/wp-json/wc/v3/orders?search=${encodeURIComponent(targetEmail)}&per_page=50`, {
            headers: restHeaders,
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              orders = data.filter((o) => {
                const bEmail = o.billing?.email ? o.billing.email.trim().toLowerCase() : '';
                const sEmail = o.shipping?.email ? o.shipping.email.trim().toLowerCase() : '';
                return bEmail === targetEmail || sEmail === targetEmail;
              });
            }
          }
        } catch (e) {}
      }

      // Strategy 3: Query recent orders and strictly match customer email or valid ID in memory
      if (orders.length === 0 && (targetEmail || (customerId && customerId !== '0'))) {
        try {
          const res = await fetch(`${WP_SITE_URL}/wp-json/wc/v3/orders?per_page=50`, {
            headers: restHeaders,
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              const matched = data.filter((o) => {
                const billingEmail = o.billing?.email ? o.billing.email.trim().toLowerCase() : '';
                const shippingEmail = o.shipping?.email ? o.shipping.email.trim().toLowerCase() : '';
                const orderCustomerId = o.customer_id ? String(o.customer_id) : '';
                if (targetEmail && (billingEmail === targetEmail || shippingEmail === targetEmail)) return true;
                if (customerId && customerId !== '0' && orderCustomerId === customerId) return true;
                return false;
              });
              if (matched.length > 0) orders = matched;
            }
          }
        } catch (e) {}
      }

      if (!Array.isArray(orders) || orders.length === 0) return null;

      // Deduplicate orders by ID
      const seenIds = new Set();
      const uniqueOrders = [];
      for (const ord of orders) {
        if (!seenIds.has(ord.id)) {
          seenIds.add(ord.id);
          uniqueOrders.push(ord);
        }
      }

      return uniqueOrders.map((o) => {
        const lineItems = (o.line_items || []).map((li) => li.name).join(', ') || 'VIP Subscription';
        const rawDate = o.date_created || o.date_created_gmt || o.date || new Date().toISOString();
        const parsedD = parseSafeDate(rawDate);
        const dateStr = parsedD.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const timeStr = parsedD.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

        return {
          id: `#${o.number || o.id}`,
          rawId: `${o.id}`,
          date: dateStr,
          time: timeStr,
          dateTime: `${dateStr}, ${timeStr}`,
          rawDate: rawDate,
          status: o.status ? (o.status.charAt(0).toUpperCase() + o.status.slice(1)) : 'Completed',
          total: `${o.currency_symbol || '₹'}${o.total || '0'} for ${(o.line_items || []).length || 1} item(s)`,
          item: lineItems,
          lineItemsRaw: o.line_items || [],
          viewUrl: `${WP_SITE_URL}/my-account/view-order/${o.id}/`,
          source: 'woocommerce_rest_api',
        };
      });
    } catch (e) {
      console.log('fetchWcOrders note:', e.message);
      return null;
    }
  };

  /**
   * Helper: Check if an order item, subscription object, or product title indicates a VIP subscription
   */
  const detectSubscriptionFromLineItems = (lineItems, orderOrSub = {}) => {
    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) return null;
    const subKeywords = [
      'vip',
      'subscription',
      'membership',
      'premium',
      'yearly',
      'annual',
      'monthly',
      'quarterly',
      'plan',
      'pass',
      'whiteswan',
    ];

    if (orderOrSub && orderOrSub.status) {
      const st = String(orderOrSub.status).toLowerCase().trim();
      const validStatuses = ['active', 'processing', 'completed', 'pending-cancel'];
      if (!validStatuses.includes(st)) {
        return null;
      }
    }

    for (const item of lineItems) {
      const name = (item.name || item.product_name || '').toLowerCase();
      const isMatch = subKeywords.some((kw) => name.includes(kw));

      if (isMatch) {
        let durationDays = 365;
        let defaultPlanName = 'Yearly VIP Access';
        let defaultPrice = '₹299/Year';

        if (name.includes('6 month') || name.includes('half year') || name.includes('180')) {
          durationDays = 180;
          defaultPlanName = '6-Month VIP Access';
          defaultPrice = '₹199/6-Months';
        } else if (name.includes('month') || name.includes('30 day')) {
          durationDays = 30;
          defaultPlanName = 'Monthly VIP Access';
          defaultPrice = '₹49/Month';
        }

        const rawStartDate =
          orderOrSub.date_created_raw ||
          orderOrSub.rawDate ||
          orderOrSub.date_created ||
          orderOrSub.date_created_gmt ||
          orderOrSub.start_date ||
          new Date().toISOString();
        const startDate = parseSafeDate(rawStartDate);

        let expiryDate;
        if (orderOrSub.next_payment_date && orderOrSub.next_payment_date !== '0000-00-00 00:00:00') {
          expiryDate = parseSafeDate(
            orderOrSub.next_payment_date,
            new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000)
          );
        } else if (orderOrSub.end_date && orderOrSub.end_date !== '0000-00-00 00:00:00') {
          expiryDate = parseSafeDate(
            orderOrSub.end_date,
            new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000)
          );
        } else {
          expiryDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
        }

        const now = new Date();
        const diffMs = expiryDate.getTime() - now.getTime();
        const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        const isExpired = diffMs <= 0;

        return {
          planName: item.name || defaultPlanName,
          planPrice: item.total
            ? `₹${item.total}`
            : orderOrSub.total
            ? `₹${orderOrSub.total}`
            : defaultPrice,
          startDate: toSafeIsoString(startDate),
          expiryDate: toSafeIsoString(expiryDate),
          durationDays,
          daysRemaining,
          isExpired,
          orderId: orderOrSub.id || orderOrSub.number || null,
          source: 'WordPress Website (whiteswantvnews.com)',
        };
      }
    }
    return null;
  };

  /**
   * REST API: Fetch WooCommerce Subscriptions for a user (/wp-json/wc/v3/subscriptions)
   */
  const fetchWcSubscriptions = async (userOrEmailOrId) => {
    const restHeaders = getWcRestAuthHeaders();
    if (!restHeaders || !userOrEmailOrId) return null;

    try {
      let customerId = null;
      let targetEmail = '';
      let targetUsername = '';

      if (typeof userOrEmailOrId === 'object' && userOrEmailOrId !== null) {
        targetEmail = userOrEmailOrId.email ? userOrEmailOrId.email.trim().toLowerCase() : '';
        targetUsername = userOrEmailOrId.username ? userOrEmailOrId.username.trim() : '';
        const rawId = String(userOrEmailOrId.numericId || userOrEmailOrId.id || '').replace(/^wp_/, '');
        if (/^\d+$/.test(rawId) && rawId !== '0') {
          customerId = rawId;
        }
      } else {
        const strVal = String(userOrEmailOrId).trim();
        if (/^\d+$/.test(strVal)) {
          customerId = strVal;
        } else if (strVal.includes('@')) {
          targetEmail = strVal.toLowerCase();
        } else {
          targetUsername = strVal;
        }
      }

      if (!targetEmail && !customerId && !targetUsername) return null;

      if (!customerId && (targetEmail || targetUsername)) {
        try {
          const customerObj = await fetchWcCustomer(targetEmail || targetUsername);
          if (customerObj && customerObj.id && /^\d+$/.test(String(customerObj.id))) {
            customerId = String(customerObj.id);
          }
        } catch (e) {}
      }

      let subs = [];

      const endpointsToTry = [];
      if (customerId) {
        endpointsToTry.push(`${WP_SITE_URL}/wp-json/wc/v3/subscriptions?customer=${customerId}&per_page=20`);
        endpointsToTry.push(`${WP_SITE_URL}/wp-json/wc/v1/subscriptions?customer=${customerId}&per_page=20`);
      }
      if (targetEmail) {
        endpointsToTry.push(`${WP_SITE_URL}/wp-json/wc/v3/subscriptions?search=${encodeURIComponent(targetEmail)}&per_page=20`);
      }
      endpointsToTry.push(`${WP_SITE_URL}/wp-json/wc/v3/subscriptions?per_page=30`);

      for (const ep of endpointsToTry) {
        try {
          const res = await fetch(ep, { headers: restHeaders });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              const filtered = data.filter((s) => {
                const bEmail = s.billing?.email ? s.billing.email.trim().toLowerCase() : '';
                const sCustId = s.customer_id ? String(s.customer_id) : '';
                if (targetEmail && bEmail === targetEmail) return true;
                if (customerId && customerId !== '0' && sCustId === customerId) return true;
                return false;
              });
              if (filtered.length > 0) {
                subs = filtered;
                break;
              }
            }
          }
        } catch (e) {}
      }

      return subs.length > 0 ? subs : null;
    } catch (e) {
      console.log('fetchWcSubscriptions note:', e.message);
      return null;
    }
  };

  /**
   * HTML Fallback: Fetch subscriptions from /my-account/subscriptions/
   */
  const fetchUserSubscriptionsHtml = async (authCookies) => {
    if (!authCookies) return [];
    try {
      const res = await fetch(`${WP_SITE_URL}/my-account/subscriptions/`, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': USER_AGENT,
          Referer: `${WP_SITE_URL}/my-account/`,
          Cookie: authCookies,
        },
      });

      if (!res.ok) return [];
      const html = await res.text();
      const subscriptions = [];

      const rowRegex =
        /<tr[^>]*class=["'][^"']*(?:woocommerce-subscriptions-table__row|woocommerce-orders-table__row)[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi;
      let match;
      while ((match = rowRegex.exec(html)) !== null) {
        const rowHtml = match[1];
        const idMatch =
          rowHtml.match(/subscription-id[^>]*>[\s\S]*?<a[^>]*href=["']([^"']*)["'][^>]*>#?(\d+)<\/a>/i) ||
          rowHtml.match(/data-title=["']Subscription["'][^>]*>[\s\S]*?#?(\d+)/i);
        const statusMatch = rowHtml.match(/subscription-status[^>]*>([\s\S]*?)<\/td>/i);
        const nextPaymentMatch =
          rowHtml.match(/subscription-next-payment[^>]*>[\s\S]*?<time[^>]*datetime=["']([^"']*)["'][^>]*>([^<]+)<\/time>/i) ||
          rowHtml.match(/subscription-next-payment[^>]*>([\s\S]*?)<\/td>/i);
        const totalMatch = rowHtml.match(/subscription-total[^>]*>([\s\S]*?)<\/td>/i);

        if (idMatch || statusMatch) {
          const rawId = idMatch ? idMatch[2] || idMatch[1] || '' : `${Date.now()}`;
          const viewUrl =
            idMatch && idMatch[1]?.startsWith('http')
              ? idMatch[1]
              : `${WP_SITE_URL}/my-account/view-subscription/${rawId}/`;
          const rawStatus = statusMatch ? statusMatch[1].replace(/<[^>]+>/g, '').trim() : 'Active';
          const rawTotal = totalMatch
            ? totalMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
            : '₹299 / year';
          const nextPayDate = nextPaymentMatch
            ? (nextPaymentMatch[2] || nextPaymentMatch[1] || '').replace(/<[^>]+>/g, '').trim()
            : '';

          subscriptions.push({
            id: `#${rawId}`,
            rawId,
            status: rawStatus,
            total: rawTotal,
            nextPayment: nextPayDate,
            viewUrl,
            source: 'woocommerce_subscriptions_html',
          });
        }
      }

      return subscriptions;
    } catch (e) {
      console.log('fetchUserSubscriptionsHtml note:', e.message);
      return [];
    }
  };

  /**
   * Unified Subscription Sync:
   * Checks WordPress/WooCommerce Subscriptions & Orders to grant/refresh VIP access
   */
  const syncUserSubscription = async (activeUser = null) => {
    if (isLoggedOutRef.current) {
      return { success: false, isPremium: false, message: 'User is signed out.' };
    }
    const targetUser = activeUser || user;
    if (!targetUser || !targetUser.email) {
      return { success: false, isPremium: false, message: 'Please sign in to sync your subscription.' };
    }

    try {
      const emailKey = targetUser.email.toLowerCase();
      let detectedSub = null;

      // 1. Check WooCommerce Subscriptions REST API
      const wcSubs = await fetchWcSubscriptions(targetUser);
      if (Array.isArray(wcSubs) && wcSubs.length > 0) {
        const activeWcSub = wcSubs.find(
          (s) =>
            s &&
            (s.status === 'active' ||
              s.status === 'processing' ||
              s.status === 'pending-cancel')
        );

        if (activeWcSub) {
          detectedSub = detectSubscriptionFromLineItems(activeWcSub.line_items, activeWcSub);
          if (!detectedSub) {
            const startDate = parseSafeDate(activeWcSub.start_date || activeWcSub.date_created);
            let expiryDate;
            if (activeWcSub.next_payment_date && activeWcSub.next_payment_date !== '0000-00-00 00:00:00') {
              expiryDate = parseSafeDate(activeWcSub.next_payment_date, new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000));
            } else if (activeWcSub.end_date && activeWcSub.end_date !== '0000-00-00 00:00:00') {
              expiryDate = parseSafeDate(activeWcSub.end_date, new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000));
            } else {
              expiryDate = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
            }

            const isExpired = expiryDate.getTime() < Date.now();
            detectedSub = {
              planName: activeWcSub.line_items?.[0]?.name || 'Yearly VIP Access',
              planPrice: `${activeWcSub.currency_symbol || '₹'}${activeWcSub.total || '299'}`,
              startDate: toSafeIsoString(startDate),
              expiryDate: toSafeIsoString(expiryDate),
              durationDays: 365,
              daysRemaining: Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
              isExpired,
              status: activeWcSub.status,
              source: 'WooCommerce Subscriptions (whiteswantvnews.com)',
            };
          }
        }
      }

      // 2. Check WooCommerce Orders REST API for completed subscription/VIP orders
      if (!detectedSub) {
        const wcOrders = await fetchWcOrders(targetUser);
        if (Array.isArray(wcOrders) && wcOrders.length > 0) {
          for (const ord of wcOrders) {
            const status = (ord.status || '').toLowerCase();
            if (status === 'completed' || status === 'processing' || status === 'active') {
              const subMatch = detectSubscriptionFromLineItems(
                ord.lineItemsRaw && ord.lineItemsRaw.length > 0
                  ? ord.lineItemsRaw
                  : [{ name: ord.item || 'VIP Subscription', total: ord.total }],
                {
                  date_created: ord.rawDate || ord.date,
                  date_created_raw: ord.rawDate,
                }
              );
              if (subMatch && !subMatch.isExpired) {
                detectedSub = subMatch;
                break;
              }
            }
          }
        }
      }

      // 3. Check HTML Subscriptions (/my-account/subscriptions/)
      if (!detectedSub) {
        const cookies = await getAuthenticatedWordPressCookies(targetUser);
        if (cookies) {
          const htmlSubs = await fetchUserSubscriptionsHtml(cookies);
          if (Array.isArray(htmlSubs) && htmlSubs.length > 0) {
            const activeHtmlSub = htmlSubs.find(
              (s) =>
                s &&
                (s.status.toLowerCase() === 'active' ||
                  s.status.toLowerCase() === 'processing' ||
                  s.status.toLowerCase() === 'pending-cancel')
            );

            if (
              activeHtmlSub &&
              !activeHtmlSub.status.toLowerCase().includes('cancel') &&
              !activeHtmlSub.status.toLowerCase().includes('expired') &&
              !activeHtmlSub.status.toLowerCase().includes('pending') &&
              !activeHtmlSub.status.toLowerCase().includes('fail')
            ) {
              const startDate = new Date();
              let expiryDate = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
              if (activeHtmlSub.nextPayment) {
                expiryDate = parseSafeDate(activeHtmlSub.nextPayment, expiryDate);
              }
              const isExpired = expiryDate.getTime() < Date.now();
              detectedSub = {
                planName: 'Yearly VIP Access',
                planPrice: activeHtmlSub.total || '₹299/Year',
                startDate: toSafeIsoString(startDate),
                expiryDate: toSafeIsoString(expiryDate),
                durationDays: 365,
                daysRemaining: Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
                isExpired,
                status: activeHtmlSub.status,
                source: 'WordPress Website (/my-account/subscriptions/)',
              };
            }
          }
        }
      }

      // 4. If active website subscription was detected, update user profile and persist
      if (detectedSub && !detectedSub.isExpired) {
        let updatedUserObj = null;

        setUser((prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            role: 'Premium VIP',
            isPremium: true,
            isExpired: false,
            premiumPlan: detectedSub.planName || prev.premiumPlan || 'Yearly VIP Access',
            planPrice: detectedSub.planPrice || prev.planPrice || '₹299/Year',
            subscribedAt: detectedSub.startDate || prev.subscribedAt || new Date().toISOString(),
            expiresAt:
              detectedSub.expiryDate ||
              prev.expiresAt ||
              new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            subscriptionSource: detectedSub.source || 'WordPress Website',
          };
          updatedUserObj = updated;
          return updated;
        });

        if (updatedUserObj) {
          await persistUserToMobileDatabase(updatedUserObj);
        } else {
          const directUpdated = {
            ...targetUser,
            role: 'Premium VIP',
            isPremium: true,
            isExpired: false,
            premiumPlan: detectedSub.planName || targetUser.premiumPlan || 'Yearly VIP Access',
            planPrice: detectedSub.planPrice || targetUser.planPrice || '₹299/Year',
            subscribedAt: detectedSub.startDate || targetUser.subscribedAt || new Date().toISOString(),
            expiresAt:
              detectedSub.expiryDate ||
              targetUser.expiresAt ||
              new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            subscriptionSource: detectedSub.source || 'WordPress Website',
          };
          await persistUserToMobileDatabase(directUpdated);
          setUser(directUpdated);
        }

        await AsyncStorage.setItem(
          `@whiteswan_subscription_${emailKey}`,
          JSON.stringify(detectedSub)
        );

        return {
          success: true,
          isPremium: true,
          subDetails: detectedSub,
          message: `Active subscription to "${detectedSub.planName}" successfully synced from WordPress website!`,
        };
      }

      // 5. If subscription expired or was cancelled on website
      if (detectedSub && detectedSub.isExpired) {
        const expiredUser = {
          ...targetUser,
          role: 'Free Member',
          isPremium: false,
          isExpired: true,
          premiumPlan: detectedSub.planName || targetUser.premiumPlan || null,
        };
        await persistUserToMobileDatabase(expiredUser);
        setUser(expiredUser);
        await AsyncStorage.removeItem(`@whiteswan_subscription_${emailKey}`).catch(() => {});
        return {
          success: true,
          isPremium: false,
          message: 'Your subscription on the website has expired.',
        };
      }

      // 6. If no active subscription found on WordPress, check local PhonePe / in-app purchase for this exact email
      let localValidSub = null;
      if (emailKey) {
        try {
          const rawSavedSub = await AsyncStorage.getItem(`@whiteswan_subscription_${emailKey}`);
          if (rawSavedSub) {
            const parsed = JSON.parse(rawSavedSub);
            if (parsed && parsed.expiryDate && new Date(parsed.expiryDate).getTime() > Date.now()) {
              localValidSub = parsed;
            } else {
              await AsyncStorage.removeItem(`@whiteswan_subscription_${emailKey}`).catch(() => {});
            }
          }
        } catch (e) {}
      }

      if (localValidSub) {
        const activeLocalUser = {
          ...targetUser,
          role: 'Premium VIP',
          isPremium: true,
          isExpired: false,
          premiumPlan: localValidSub.planName || targetUser.premiumPlan || 'Yearly VIP Access',
          planPrice: localValidSub.planPrice || targetUser.planPrice || '₹299/Year',
          subscribedAt: localValidSub.startDate || targetUser.subscribedAt || new Date().toISOString(),
          expiresAt: localValidSub.expiryDate || targetUser.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          subscriptionSource: localValidSub.source || 'PhonePe Payment',
        };
        await persistUserToMobileDatabase(activeLocalUser);
        setUser(activeLocalUser);
        return {
          success: true,
          isPremium: true,
          subDetails: localValidSub,
          message: 'VIP Subscription is active on your account.',
        };
      }

      // 7. Strictly Free Member - No subscription for this account
      const freeUser = {
        ...targetUser,
        role: 'Free Member',
        isPremium: false,
        isExpired: false,
        premiumPlan: null,
        planPrice: null,
        subscribedAt: null,
        expiresAt: null,
        subscriptionSource: null,
      };
      await persistUserToMobileDatabase(freeUser);
      setUser(freeUser);
      await AsyncStorage.removeItem(`@whiteswan_subscription_${emailKey}`).catch(() => {});

      return {
        success: true,
        isPremium: false,
        message: 'No active subscription found for your account on whiteswantvnews.com.',
      };
    } catch (e) {
      console.error('syncUserSubscription error:', e);
      return { success: false, isPremium: false, message: e.message || 'Failed to sync subscriptions.' };
    }
  };

  // Real-time synchronization with WordPress:
  // 1. When app becomes active from background or foreground
  // 2. Periodic sync timer every 15 seconds while user is logged in
  useEffect(() => {
    if (!user?.email) return;

    // Immediate sync on user login/session load
    syncUserSubscription(user).catch(() => {});

    // AppState listener for instant sync when opening or switching back to app
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        syncUserSubscription().catch(() => {});
      }
    });

    // Periodic live heartbeat polling (every 15 seconds)
    const heartbeatInterval = setInterval(() => {
      syncUserSubscription().catch(() => {});
    }, 15000);

    return () => {
      appStateSub.remove();
      clearInterval(heartbeatInterval);
    };
  }, [user?.email, user?.id]);

  // Load session on startup
  // Helper: Retrieve all registered users from local database
  const getRegisteredUsers = async () => {
    try {
      const raw = await AsyncStorage.getItem(USERS_DB_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to read users database:', e);
      return [];
    }
  };

  const persistUserToMobileDatabase = async (updatedUser) => {
    if (!updatedUser || isLoggedOutRef.current) return;
    try {
      const emailKey = updatedUser.email ? updatedUser.email.toLowerCase() : '';

      // 1. Save to session storage (only when user has not logged out)
      if (!isLoggedOutRef.current) {
        await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedUser));
      }

      // 2. Save individual keys for high-reliability recovery
      if (emailKey) {
        if (updatedUser.address) {
          await AsyncStorage.setItem(`@whiteswan_address_${emailKey}`, JSON.stringify(updatedUser.address));
        }
        if (updatedUser.shippingAddress) {
          await AsyncStorage.setItem(`@whiteswan_shipping_${emailKey}`, JSON.stringify(updatedUser.shippingAddress));
        }
        if (updatedUser.phone) {
          await AsyncStorage.setItem(`@whiteswan_phone_${emailKey}`, updatedUser.phone);
        }
        if (updatedUser.avatar) {
          await AsyncStorage.setItem(`@whiteswan_avatar_${emailKey}`, updatedUser.avatar);
        }
        if (updatedUser.password) {
          await AsyncStorage.setItem(`@whiteswan_pwd_${emailKey}`, updatedUser.password);
        }
        if (updatedUser.wpCookies) {
          await AsyncStorage.setItem(`@whiteswan_cookies_${emailKey}`, updatedUser.wpCookies);
        }
      }

      // 3. Upsert into USERS_DB_KEY (strictly match by email or username, never generic IDs)
      const users = await getRegisteredUsers();
      let matched = false;
      const updatedUsers = users.map((u) => {
        const matchEmail = u.email && emailKey && u.email.toLowerCase() === emailKey;
        const matchUsername = u.username && updatedUser.username && u.username.toLowerCase() === updatedUser.username.toLowerCase();
        if (matchEmail || matchUsername) {
          matched = true;
          return { ...u, ...updatedUser };
        }
        return u;
      });

      if (!matched) {
        updatedUsers.push(updatedUser);
      }

      await AsyncStorage.setItem(USERS_DB_KEY, JSON.stringify(updatedUsers));
    } catch (e) {
      console.error('Failed to persist user to mobile database:', e);
    }
  };

  useEffect(() => {
    loadUserSession();
  }, []);

  const loadUserSession = async () => {
    try {
      const sessionData = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      if (sessionData) {
        let parsed = JSON.parse(sessionData);

        // Check persistent custom avatar, password, cookies, address, and phone
        if (parsed.email) {
          const emailKey = parsed.email.toLowerCase();
          const savedAvatar = await AsyncStorage.getItem(`@whiteswan_avatar_${emailKey}`);
          if (savedAvatar && (savedAvatar.startsWith('http') || savedAvatar.startsWith('data:image'))) {
            parsed.avatar = savedAvatar;
          }
          const savedPwd = await AsyncStorage.getItem(`@whiteswan_pwd_${emailKey}`);
          if (savedPwd && !parsed.password) {
            parsed.password = savedPwd;
          }
          const savedCookies = await AsyncStorage.getItem(`@whiteswan_cookies_${emailKey}`);
          if (savedCookies && !parsed.wpCookies) {
            parsed.wpCookies = savedCookies;
          }
          const savedPhone = await AsyncStorage.getItem(`@whiteswan_phone_${emailKey}`);
          if (savedPhone) {
            parsed.phone = savedPhone;
          }
          const savedAddress = await AsyncStorage.getItem(`@whiteswan_address_${emailKey}`);
          if (savedAddress) {
            try {
              const parsedAddr = JSON.parse(savedAddress);
              parsed.address = {
                ...(parsed.address || {}),
                ...parsedAddr,
              };
              parsed.firstName = parsedAddr.firstName || parsed.firstName || '';
              parsed.lastName = parsedAddr.lastName || parsed.lastName || '';
              parsed.country = getCountryName(parsedAddr.country || parsed.country || 'India');
              parsed.street = parsedAddr.street || parsed.street || '';
              parsed.street2 = parsedAddr.street2 || parsed.street2 || '';
              parsed.city = parsedAddr.city || parsed.city || '';
              parsed.district = parsedAddr.district || parsed.district || parsed.city || '';
              parsed.pincode = parsedAddr.pincode || parsed.pincode || '';
              parsed.state = getStateName(parsedAddr.state || parsed.state || 'Kerala');
              parsed.billingEmail = parsedAddr.email || parsedAddr.billingEmail || parsed.billingEmail || parsed.email || '';
              if (parsedAddr.phone && !parsed.phone) {
                parsed.phone = parsedAddr.phone;
              }
            } catch (e) {}
          }

          // Persistent Shipping Address
          const savedShipping = await AsyncStorage.getItem(`@whiteswan_shipping_${emailKey}`);
          if (savedShipping) {
            try {
              parsed.shippingAddress = {
                ...(parsed.shippingAddress || {}),
                ...JSON.parse(savedShipping),
              };
            } catch (e) {}
          }
        }

        // Cross-reference registered users local DB strictly by email or username
        const users = await getRegisteredUsers();
        const stored = users.find(
          (u) =>
            (u.email && parsed.email && u.email.toLowerCase() === parsed.email.toLowerCase()) ||
            (u.username && parsed.username && u.username.toLowerCase() === parsed.username.toLowerCase())
        );

        if (stored) {
          const parsedAddr = parsed.address || {};
          const storedAddr = stored.address || {};
          const mergedAddr = {
            ...storedAddr,
            ...parsedAddr,
          };
          const parsedShip = parsed.shippingAddress || {};
          const storedShip = stored.shippingAddress || {};
          const mergedShip = {
            ...storedShip,
            ...parsedShip,
          };
          const resolvedFirst = parsed.firstName !== undefined ? parsed.firstName : (stored.firstName || storedAddr.firstName || parsedAddr.firstName || '');
          const resolvedLast = parsed.lastName !== undefined ? parsed.lastName : (stored.lastName || storedAddr.lastName || parsedAddr.lastName || '');
          const resolvedCountry = getCountryName(parsed.country || parsedAddr.country || stored.country || storedAddr.country || 'India');
          const resolvedBillingEmail = parsed.billingEmail || parsedAddr.email || stored.billingEmail || storedAddr.email || parsed.email || '';
          const resolvedStreet = parsedAddr.street !== undefined ? parsedAddr.street : (parsed.street !== undefined ? parsed.street : (storedAddr.street || stored.street || ''));
          const resolvedStreet2 = parsedAddr.street2 !== undefined ? parsedAddr.street2 : (parsed.street2 !== undefined ? parsed.street2 : (storedAddr.street2 || stored.street2 || ''));
          const resolvedCity = parsedAddr.city !== undefined ? parsedAddr.city : (parsed.city !== undefined ? parsed.city : (storedAddr.city || stored.city || ''));
          const resolvedDistrict = parsedAddr.district !== undefined ? parsedAddr.district : (parsed.district !== undefined ? parsed.district : (storedAddr.district || stored.district || resolvedCity || ''));
          const resolvedPincode = parsedAddr.pincode !== undefined ? parsedAddr.pincode : (parsed.pincode !== undefined ? parsed.pincode : (storedAddr.pincode || stored.pincode || ''));
          const resolvedState = getStateName(parsedAddr.state !== undefined ? parsedAddr.state : (parsed.state !== undefined ? parsed.state : (storedAddr.state || stored.state || 'Kerala')));
          const resolvedPhone = parsedAddr.phone !== undefined ? parsedAddr.phone : (parsed.phone !== undefined ? parsed.phone : (storedAddr.phone || stored.phone || null));

          parsed = {
            ...parsed,
            avatar: parsed.avatar || stored.avatar,
            name: parsed.name || stored.name || (resolvedFirst ? `${resolvedFirst} ${resolvedLast}`.trim() : 'Member'),
            firstName: resolvedFirst,
            lastName: resolvedLast,
            country: resolvedCountry,
            billingEmail: resolvedBillingEmail,
            address: {
              ...mergedAddr,
              firstName: resolvedFirst,
              lastName: resolvedLast,
              name: (resolvedFirst ? `${resolvedFirst} ${resolvedLast}`.trim() : parsed.name || stored.name || 'Member'),
              country: resolvedCountry,
              street: resolvedStreet,
              street2: resolvedStreet2,
              city: resolvedCity,
              district: resolvedDistrict,
              pincode: resolvedPincode,
              state: resolvedState,
              phone: resolvedPhone,
              email: resolvedBillingEmail,
            },
            shippingAddress: mergedShip,
            street: resolvedStreet,
            street2: resolvedStreet2,
            city: resolvedCity,
            district: resolvedDistrict,
            pincode: resolvedPincode,
            state: resolvedState,
            phone: resolvedPhone,
            password: parsed.password || stored.password,
            wpCookies: parsed.wpCookies || stored.wpCookies || '',
            isPremium: stored.isPremium !== undefined ? stored.isPremium : parsed.isPremium,
            premiumPlan: stored.premiumPlan || parsed.premiumPlan,
          };
        } else if (parsed.name && (!parsed.firstName || !parsed.lastName)) {
          const parts = parsed.name.trim().split(' ').filter(Boolean);
          if (!parsed.firstName) parsed.firstName = parts[0] || '';
          if (!parsed.lastName) parsed.lastName = parts.slice(1).join(' ') || '';
          if (!parsed.country) parsed.country = parsed.address?.country || 'India';
        }

        setUser(parsed);

        // Background refresh address, profile, and subscription from live WordPress
        refreshWordPressProfile(parsed).catch(() => {});
        syncUserSubscription(parsed).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to load user session:', e);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Helper: Extract input value from HTML (text inputs, selects, textareas)
   */
  const extractInputValue = (html, name) => {
    if (!html || !name) return '';

    // 1. Textarea match
    const textareaMatch = html.match(
      new RegExp('<textarea[^>]*?name=["\']?' + name + '["\']?[^>]*?>([\\s\\S]*?)<\\/textarea>', 'i')
    );
    if (textareaMatch && textareaMatch[1]) {
      return textareaMatch[1].trim();
    }

    // 2. Select tag selected option
    const selectMatch = html.match(
      new RegExp('<select[^>]*?name=["\']?' + name + '["\']?[^>]*?>([\\s\\S]*?)<\\/select>', 'i')
    );
    if (selectMatch && selectMatch[1]) {
      const optionMatch =
        selectMatch[1].match(/<option[^>]*?value=["']([^"']*)["'][^>]*?selected/i) ||
        selectMatch[1].match(/<option[^>]*?selected[^>]*?value=["']([^"']*)["']/i) ||
        selectMatch[1].match(/<option[^>]*?selected[^>]*?>([^<]*)<\/option>/i);
      if (optionMatch && optionMatch[1] !== undefined) {
        return optionMatch[1].trim();
      }
    }

    // 3. Input tag match (name="..." or id="...")
    const inputMatches = html.match(
      new RegExp('<input[^>]*?(?:name=["\']?' + name + '["\']?|id=["\']?' + name + '["\']?)[^>]*?>', 'gi')
    );
    if (inputMatches) {
      for (const tag of inputMatches) {
        const valMatch = tag.match(/\bvalue=["']([^"']*)["']/i);
        if (valMatch && valMatch[1] !== undefined && valMatch[1].trim()) {
          return valMatch[1].trim();
        }
      }
    }

    return '';
  };

  /**
   * Helper: Escape XML special characters
   */
  const escapeXml = (unsafe) => {
    return (unsafe || '').replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  };

  /**
   * Helper: Parse XML tag value
   */
  const extractXmlVal = (xml, tag) => {
    const match = xml.match(new RegExp(`<name>${tag}</name>\\s*<value>(?:<string>)?([^<]+)(?:</string>)?</value>`, 'i'));
    return match ? match[1].trim() : null;
  };

  /**
   * Helper: Parse formatted WooCommerce address block
   */
  const parseAddressBlock = (addressHtml) => {
    if (!addressHtml) return null;
    const text = addressHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&#039;/g, "'")
      .replace(/&quot;/g, '"')
      .trim();
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    let name = lines[0] || '';
    let pincode = '';
    let city = '';
    let state = 'Kerala';
    let country = 'India';

    let pinCityLineIdx = -1;
    let stateLineIdx = -1;
    let countryLineIdx = -1;

    // 1. Identify PIN code & City, State, Country lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // PIN code
      const pinMatch = line.match(/\b(\d{6})\b/);
      if (pinMatch) {
        pincode = pinMatch[1];
        const withoutPin = line.replace(/\b\d{6}\b/, '').replace(/,/g, '').trim();
        if (withoutPin) {
          city = withoutPin;
        }
        pinCityLineIdx = i;
      }

      // Check Indian states
      for (const st of INDIAN_STATES) {
        if (
          line.toLowerCase() === st.name.toLowerCase() ||
          line.toLowerCase() === st.code.toLowerCase() ||
          line.toLowerCase().includes(st.name.toLowerCase())
        ) {
          state = st.name;
          stateLineIdx = i;
          break;
        }
      }

      // Check Country
      for (const c of COUNTRIES_LIST) {
        if (
          line.toLowerCase() === c.name.toLowerCase() ||
          line.toLowerCase() === c.code.toLowerCase()
        ) {
          country = c.name;
          countryLineIdx = i;
          break;
        }
      }
    }

    // 2. Identify Street Address lines (lines between Name and City/State/Country)
    const streetLines = [];
    for (let i = 1; i < lines.length; i++) {
      if (i !== pinCityLineIdx && i !== stateLineIdx && i !== countryLineIdx) {
        streetLines.push(lines[i]);
      }
    }

    let street = streetLines[0] || '';
    let street2 = streetLines.length > 1 ? streetLines[1] : '';

    if (!city && streetLines.length > 1 && pinCityLineIdx === -1) {
      city = streetLines[streetLines.length - 1];
      if (streetLines.length === 2) {
        street2 = '';
      }
    }

    let firstName = '';
    let lastName = '';
    if (name) {
      const parts = name.split(' ').filter(Boolean);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }

    return {
      name,
      firstName,
      lastName,
      street,
      street2,
      city: city || '',
      district: city || '',
      pincode,
      state: state || 'Kerala',
      country: country || 'India',
    };
  };

  /**
   * Helper: Fetch WordPress user profile & address details from WooCommerce endpoints / REST API
   */
  const fetchWordPressAddressAndProfile = async (authCookies, activeUser = null) => {
    const userEmail = (activeUser?.email || user?.email || '').trim();
    const targetUsername = (activeUser?.username || user?.username || '').trim();

    // 0. Prioritize WooCommerce REST API if API credentials are configured
    if (userEmail || activeUser?.id || targetUsername) {
      try {
        const restCustomer = await fetchWcCustomer(userEmail || activeUser?.id || targetUsername);
        if (restCustomer) {
          const restBilling = restCustomer.billing || {};
          const restShipping = restCustomer.shipping || {};
          const resolvedFirst = restCustomer.first_name || restBilling.first_name || '';
          const resolvedLast = restCustomer.last_name || restBilling.last_name || '';
          const resolvedName = (resolvedFirst ? `${resolvedFirst} ${resolvedLast}`.trim() : '') || restCustomer.username || restCustomer.email || 'Member';
          const customAvatar = await resolveCustomAvatar(restCustomer, getWcRestAuthHeaders());
          const finalAvatar = customAvatar || restCustomer.avatar_url || '';

          const normalized = {
            id: restCustomer.id ? `wp_${restCustomer.id}` : (activeUser?.id || `wp_${Date.now()}`),
            numericId: restCustomer.id,
            name: resolvedName,
            firstName: resolvedFirst,
            lastName: resolvedLast,
            username: restCustomer.username || targetUsername,
            email: restCustomer.email || userEmail,
            billingEmail: restBilling.email || restCustomer.email || userEmail,
            avatar: finalAvatar,
            phone: restBilling.phone || null,
            address: {
              firstName: resolvedFirst,
              lastName: resolvedLast,
              name: resolvedName,
              street: restBilling.address_1 || '',
              street2: restBilling.address_2 || '',
              city: restBilling.city || '',
              state: getStateName(restBilling.state || 'Kerala'),
              pincode: restBilling.postcode || '',
              country: getCountryName(restBilling.country || 'India'),
              phone: restBilling.phone || null,
              email: restBilling.email || restCustomer.email || userEmail,
            },
            shippingAddress: {
              firstName: restShipping.first_name || resolvedFirst,
              lastName: restShipping.last_name || resolvedLast,
              name: (restShipping.first_name ? `${restShipping.first_name} ${restShipping.last_name}`.trim() : resolvedName),
              street: restShipping.address_1 || '',
              street2: restShipping.address_2 || '',
              city: restShipping.city || '',
              state: getStateName(restShipping.state || 'Kerala'),
              pincode: restShipping.postcode || '',
              country: getCountryName(restShipping.country || 'India'),
            },
          };
          console.log('Successfully fetched and normalized customer profile via WooCommerce REST API for:', userEmail || targetUsername);
          return normalized;
        }
      } catch (restErr) {
        console.log('WooCommerce REST API fetch note:', restErr.message);
      }
    }

    if (!authCookies) return null;
    try {
      let addressData = null;
      let shippingAddressData = null;
      let profileData = {};
      let firstName = '';
      let lastName = '';
      let billingPhone = '';

      const reqHeaders = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': USER_AGENT,
        'Referer': `${WP_SITE_URL}/my-account/`,
        'Cookie': authCookies,
      };

      // 0. Dashboard overview (/my-account/)
      try {
        const dashRes = await fetch(`${WP_SITE_URL}/my-account/`, {
          headers: reqHeaders,
        });
        if (dashRes.ok) {
          const dashHtml = await dashRes.text();
          
          // Verify that this is an authenticated page, not a login form
          if (!dashHtml.includes('woocommerce-form-login') && !dashHtml.includes('name="login"')) {
            // Avatar
            const avatarMatch =
              dashHtml.match(/id=["']ws-avatar-preview["'][^>]*src=["']([^"']+)["']/i) ||
              dashHtml.match(/src=["']([^"']+)["'][^>]*id=["']ws-avatar-preview["']/i) ||
              dashHtml.match(/<img[^>]+src=["']([^"']+)["'][^>]*class=["'][^"']*(?:ws-avatar-img|wc-profile-avatar|avatar)[^"']*["']/i) ||
              dashHtml.match(/class=["'][^"']*(?:ws-avatar-img|wc-profile-avatar|avatar)[^"']*["'][^>]*src=["']([^"']+)["']/i) ||
              dashHtml.match(/<img[^>]+src=["']([^"']*(?:avatar|gravatar|uploads)[^"']*)["']/i);
            if (avatarMatch && avatarMatch[1]) {
              let cleanAvatar = avatarMatch[1].replace(/&amp;/g, '&').trim();
              if (cleanAvatar.startsWith('//')) {
                cleanAvatar = 'https:' + cleanAvatar;
              } else if (cleanAvatar.startsWith('/')) {
                cleanAvatar = `${WP_SITE_URL}${cleanAvatar}`;
              }
              // If placeholder unsplash avatar, mark as empty
              if (!cleanAvatar.includes('unsplash.com')) {
                profileData.avatar = cleanAvatar;
              }
            }

            // Name
            const nameMatch =
              dashHtml.match(/Hello\s+<strong>([^<]+)<\/strong>/i) ||
              dashHtml.match(/class=["'][^"']*(?:user-name|display-name|account-name)[^"']*["'][^>]*>([^<]+)</i);
            if (nameMatch && nameMatch[1]) {
              profileData.name = nameMatch[1].trim();
            }
          }
        }
      } catch (e) {}

      // 1. Check Address Overview page (/my-account/edit-address/)
      try {
        const overviewRes = await fetch(`${WP_SITE_URL}/my-account/edit-address/`, {
          headers: reqHeaders,
        });
        if (overviewRes.ok) {
          const oHtml = await overviewRes.text();
          if (!oHtml.includes('woocommerce-form-login') && !oHtml.includes('name="login"')) {
            // Billing column
            const billingColMatch =
              oHtml.match(/Billing\s*address[\s\S]*?<address[^>]*>([\s\S]*?)<\/address>/i) ||
              oHtml.match(/class=["'][^"']*(?:u-column1|billing-address|woocommerce-Address)[^"']*["'][\s\S]*?<address[^>]*>([\s\S]*?)<\/address>/i) ||
              oHtml.match(/<address[^>]*>([\s\S]*?)<\/address>/i);

            if (billingColMatch && billingColMatch[1] && !billingColMatch[1].toLowerCase().includes('not set up')) {
              const parsedBilling = parseAddressBlock(billingColMatch[1]);
              if (parsedBilling && (parsedBilling.street || parsedBilling.city || parsedBilling.pincode)) {
                addressData = { ...(addressData || {}), ...parsedBilling };
              }
            }

            // Shipping column
            const shippingColMatch =
              oHtml.match(/Shipping\s*address[\s\S]*?<address[^>]*>([\s\S]*?)<\/address>/i) ||
              oHtml.match(/class=["'][^"']*(?:u-column2|shipping-address)[^"']*["'][\s\S]*?<address[^>]*>([\s\S]*?)<\/address>/i);

            if (shippingColMatch && shippingColMatch[1] && !shippingColMatch[1].toLowerCase().includes('not set up')) {
              const parsedShipping = parseAddressBlock(shippingColMatch[1]);
              if (parsedShipping && (parsedShipping.street || parsedShipping.city || parsedShipping.pincode)) {
                shippingAddressData = { ...(shippingAddressData || {}), ...parsedShipping };
              }
            }
          }
        }
      } catch (e) {}

      // 2. Billing address edit form (/my-account/edit-address/billing/)
      try {
        const billingRes = await fetch(`${WP_SITE_URL}/my-account/edit-address/billing/`, {
          headers: reqHeaders,
        });

        if (billingRes.ok) {
          const bHtml = await billingRes.text();
          if (!bHtml.includes('woocommerce-form-login') && !bHtml.includes('name="login"')) {
            const streetVal = extractInputValue(bHtml, 'billing_address_1');
            const street2Val = extractInputValue(bHtml, 'billing_address_2');
            const cityVal = extractInputValue(bHtml, 'billing_city');
            const stateVal = extractInputValue(bHtml, 'billing_state');
            const pincodeVal = extractInputValue(bHtml, 'billing_postcode');
            billingPhone = extractInputValue(bHtml, 'billing_phone');
            const bFirst = extractInputValue(bHtml, 'billing_first_name');
            const bLast = extractInputValue(bHtml, 'billing_last_name');
            const bCountry = extractInputValue(bHtml, 'billing_country');
            const bEmail = extractInputValue(bHtml, 'billing_email');

            if (bFirst) firstName = bFirst;
            if (bLast) lastName = bLast;

            if (streetVal || cityVal || pincodeVal || billingPhone || bFirst || bLast) {
              addressData = {
                ...(addressData || {}),
                firstName: bFirst || addressData?.firstName || firstName || '',
                lastName: bLast || addressData?.lastName || lastName || '',
                country: bCountry === 'IN' ? 'India' : (bCountry || addressData?.country || 'India'),
                street: streetVal || addressData?.street || '',
                street2: street2Val || addressData?.street2 || '',
                city: cityVal || addressData?.city || '',
                district: cityVal || addressData?.district || (stateVal === 'KL' ? 'Kerala' : stateVal) || '',
                pincode: pincodeVal || addressData?.pincode || '',
                phone: billingPhone || addressData?.phone || '',
                email: bEmail || addressData?.email || userEmail || '',
                state: getStateName(stateVal || addressData?.state || 'Kerala'),
              };
            }
            if (bEmail && bEmail.includes('@') && !profileData.email) {
              profileData.email = bEmail;
            }
          }
        }
      } catch (e) {}

      // 3. Shipping address edit form (/my-account/edit-address/shipping/)
      try {
        const shipRes = await fetch(`${WP_SITE_URL}/my-account/edit-address/shipping/`, {
          headers: reqHeaders,
        });

        if (shipRes.ok) {
          const sHtml = await shipRes.text();
          if (!sHtml.includes('woocommerce-form-login') && !sHtml.includes('name="login"')) {
            const sFirst = extractInputValue(sHtml, 'shipping_first_name');
            const sLast = extractInputValue(sHtml, 'shipping_last_name');
            const sCountry = extractInputValue(sHtml, 'shipping_country');
            const sStreet = extractInputValue(sHtml, 'shipping_address_1');
            const sStreet2 = extractInputValue(sHtml, 'shipping_address_2');
            const sCity = extractInputValue(sHtml, 'shipping_city');
            const sState = extractInputValue(sHtml, 'shipping_state');
            const sPincode = extractInputValue(sHtml, 'shipping_postcode');

            if (sFirst || sLast || sStreet || sCity || sPincode) {
              shippingAddressData = {
                ...(shippingAddressData || {}),
                firstName: sFirst || firstName || '',
                lastName: sLast || lastName || '',
                name: `${sFirst || firstName || ''} ${sLast || lastName || ''}`.trim(),
                country: sCountry === 'IN' ? 'India' : (sCountry || 'India'),
                street: sStreet || '',
                street2: sStreet2 || '',
                city: sCity || '',
                state: getStateName(sState || 'Kerala'),
                pincode: sPincode || '',
              };
            }
          }
        }
      } catch (e) {}

      // 4. Account name & email details (/my-account/edit-account/)
      try {
        const accRes = await fetch(`${WP_SITE_URL}/my-account/edit-account/`, {
          headers: reqHeaders,
        });

        if (accRes.ok) {
          const aHtml = await accRes.text();
          if (!aHtml.includes('woocommerce-form-login') && !aHtml.includes('name="login"')) {
            const accFirst = extractInputValue(aHtml, 'account_first_name');
            const accLast = extractInputValue(aHtml, 'account_last_name');
            const displayName = extractInputValue(aHtml, 'account_display_name');
            const realEmail = extractInputValue(aHtml, 'account_email');

            const resolvedFirst = accFirst || firstName;
            const resolvedLast = accLast || lastName;
            const resolvedDisplay = displayName || (resolvedFirst ? `${resolvedFirst} ${resolvedLast}`.trim() : '');

            if (resolvedDisplay) {
              profileData.name = resolvedDisplay;
            }
            if (resolvedFirst) profileData.firstName = resolvedFirst;
            if (resolvedLast) profileData.lastName = resolvedLast;
            if (realEmail && realEmail.includes('@')) {
              profileData.email = realEmail;
            }
          }
        }
      } catch (e) {}

      const finalEmail = userEmail || profileData.email || addressData?.email;
      const finalFirst = addressData?.firstName || firstName || profileData.firstName || '';
      const finalLast = addressData?.lastName || lastName || profileData.lastName || '';
      const finalName = (finalFirst ? `${finalFirst} ${finalLast}`.trim() : '') || profileData.name || addressData?.name || '';

      return {
        ...profileData,
        address: addressData,
        shippingAddress: shippingAddressData,
        firstName: finalFirst || undefined,
        lastName: finalLast || undefined,
        name: finalName || undefined,
        country: addressData?.country || 'India',
        street: addressData?.street,
        street2: addressData?.street2,
        city: addressData?.city,
        district: addressData?.district,
        pincode: addressData?.pincode,
        state: addressData?.state,
        phone: billingPhone || addressData?.phone || undefined,
        email: finalEmail || undefined,
        billingEmail: addressData?.email || finalEmail || undefined,
      };
    } catch (e) {
      return null;
    }
  };

  /**
   * Helper: Sanitize cookie headers for clean HTTP request transmission
   */
  const cleanCookieString = (rawCookies) => {
    if (!rawCookies) return '';
    const cookieMap = {};
    const ignoreKeys = new Set(['path', 'expires', 'domain', 'samesite', 'max-age', 'httponly', 'secure']);

    const rawList = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
    for (const raw of rawList) {
      if (!raw) continue;
      const segments = raw.split(/;|\n/);
      for (let seg of segments) {
        seg = seg.trim();
        if (!seg) continue;
        const subParts = seg.split(/,\s*(?=[a-zA-Z0-9_.-]+=[^;]+)/);
        for (const part of subParts) {
          const trimmed = part.trim();
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            let key = trimmed.substring(0, eqIdx).trim().replace(/^[,\s]+/, '');
            const val = trimmed.substring(eqIdx + 1).trim();
            if (!ignoreKeys.has(key.toLowerCase()) && val && val !== 'deleted') {
              cookieMap[key] = val;
            }
          }
        }
      }
    }

    return Object.entries(cookieMap)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  };

  /**
   * Helper: Extract all cookies from fetch Response across native and web platforms
   */
  const extractCookiesFromResponse = (res) => {
    if (!res) return '';
    let cookieList = [];
    try {
      if (typeof res.headers?.getSetCookie === 'function') {
        const sc = res.headers.getSetCookie();
        if (Array.isArray(sc) && sc.length) cookieList.push(...sc);
      }
      if (typeof res.headers?.raw === 'function') {
        const raw = res.headers.raw()['set-cookie'];
        if (raw) {
          if (Array.isArray(raw)) cookieList.push(...raw);
          else cookieList.push(raw);
        }
      }
      if (typeof res.headers?.forEach === 'function') {
        res.headers.forEach((val, key) => {
          if (key && key.toLowerCase() === 'set-cookie' && val) {
            cookieList.push(val);
          }
        });
      }
      if (typeof res.headers?.get === 'function') {
        const val = res.headers.get('set-cookie');
        if (val) cookieList.push(val);
      }
      if (res.headers && res.headers['set-cookie']) {
        const val = res.headers['set-cookie'];
        if (Array.isArray(val)) cookieList.push(...val);
        else cookieList.push(val);
      }
      if (res.headers?.map && res.headers.map['set-cookie']) {
        const val = res.headers.map['set-cookie'];
        if (Array.isArray(val)) cookieList.push(...val);
        else cookieList.push(val);
      }
    } catch (e) {}
    return cleanCookieString(cookieList);
  };

  /**
   * Helper: Obtain verified active WordPress session cookies (auto-logging in if cookies are missing or expired)
   */
  const getAuthenticatedWordPressCookies = async (activeUser) => {
    if (!activeUser) return '';
    let cookies = cleanCookieString(activeUser.wpCookies || '');
    let pwd = activeUser.password;
    const emailKey = activeUser.email ? activeUser.email.toLowerCase() : '';

    if (!cookies && emailKey) {
      try {
        const savedCookies = await AsyncStorage.getItem(`@whiteswan_cookies_${emailKey}`);
        if (savedCookies) cookies = cleanCookieString(savedCookies);
      } catch (e) {}
    }

    if (!pwd && emailKey) {
      try {
        pwd = await AsyncStorage.getItem(`@whiteswan_pwd_${emailKey}`);
      } catch (e) {}
    }

    if (!pwd && activeUser.username) {
      try {
        const uPwd = await AsyncStorage.getItem(`@whiteswan_pwd_${activeUser.username.toLowerCase()}`);
        if (uPwd) pwd = uPwd;
      } catch (e) {}
    }

    if (!pwd || !cookies) {
      const users = await getRegisteredUsers();
      const stored = users.find(
        (u) =>
          (u.email && emailKey && u.email.toLowerCase() === emailKey) ||
          (u.username && activeUser.username && u.username.toLowerCase() === (activeUser.username || '').toLowerCase())
      );
      if (stored?.password && !pwd) {
        pwd = stored.password;
      }
      if (stored?.wpCookies && !cookies) {
        cookies = cleanCookieString(stored.wpCookies);
      }
    }

    // Verify if existing cookies are still authenticated
    let isValidSession = false;
    if (cookies) {
      try {
        const checkRes = await fetch(`${WP_SITE_URL}/my-account/edit-address/billing/`, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': USER_AGENT,
            'Cookie': cookies,
          },
        });
        if (checkRes.ok) {
          const checkHtml = await checkRes.text();
          if (
            !checkHtml.includes('woocommerce-login-nonce') &&
            !checkHtml.includes('class="woocommerce-form-login"') &&
            !checkHtml.includes('name="login"') &&
            (checkHtml.includes('name="billing_address_1"') ||
             checkHtml.includes('name="billing_first_name"') ||
             checkHtml.includes('woocommerce-edit-address-nonce') ||
             checkHtml.includes('woocommerce-MyAccount-navigation'))
          ) {
            isValidSession = true;
          }
        }
      } catch (e) {}
    }

    if (!isValidSession && pwd) {
      try {
        const getRes = await fetch(`${WP_SITE_URL}/my-account/`, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': USER_AGENT,
            'Referer': `${WP_SITE_URL}/`,
          },
        });
        const pHtml = await getRes.text();
        const initCookies = extractCookiesFromResponse(getRes);
        const nonce =
          extractInputValue(pHtml, 'woocommerce-login-nonce') ||
          (pHtml.match(/name="woocommerce-login-nonce"\s+value="([^"]+)"/i)?.[1] || '');

        const loginRes = await fetch(`${WP_SITE_URL}/my-account/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': USER_AGENT,
            'Referer': `${WP_SITE_URL}/my-account/`,
            'Origin': WP_SITE_URL,
            ...(initCookies ? { 'Cookie': initCookies } : {}),
          },
          body: new URLSearchParams({
            username: activeUser.email || activeUser.username,
            password: pwd,
            rememberme: 'forever',
            'woocommerce-login-nonce': nonce,
            _wp_http_referer: '/my-account/',
            login: 'Log in',
          }).toString(),
        });

        const loginHtml = await loginRes.text();
        const newCookies = extractCookiesFromResponse(loginRes);
        const mergedCookies = cleanCookieString([initCookies, newCookies]);
        const isAuthSuccess =
          mergedCookies.includes('wordpress_logged_in_') ||
          loginRes.status === 302 ||
          loginHtml.includes('woocommerce-MyAccount-navigation') ||
          loginHtml.includes('customer-logout') ||
          (loginHtml.includes('Hello ') && !loginHtml.includes('class="woocommerce-error"'));

        if (isAuthSuccess || mergedCookies) {
          cookies = mergedCookies;
          if (emailKey) {
            await AsyncStorage.setItem(`@whiteswan_cookies_${emailKey}`, cookies);
          }
          if (activeUser) {
            activeUser.wpCookies = cookies;
          }
        }
      } catch (e) {
        // Silent recovery
      }
    }

    return cookies;
  };

  /**
   * Background Refresh from WordPress (Safely merges remote updates without erasing local data)
   */
  const refreshWordPressProfile = async (activeUser) => {
    if (isLoggedOutRef.current || !activeUser || !activeUser.email) return null;
    try {
      const cookies = await getAuthenticatedWordPressCookies(activeUser);
      const wpData = await fetchWordPressAddressAndProfile(cookies, activeUser);
      if (wpData) {
          let updatedUserObj = null;
          const emailKey = activeUser.email.toLowerCase();

          // If avatar was retrieved from WP / WC, persist it; if removed on WP, clear it
          if (wpData.avatar && (wpData.avatar.startsWith('http') || wpData.avatar.startsWith('data:image'))) {
            await AsyncStorage.setItem(`@whiteswan_avatar_${emailKey}`, wpData.avatar);
          } else if (wpData.avatar === '') {
            await AsyncStorage.removeItem(`@whiteswan_avatar_${emailKey}`);
          }

          setUser((prev) => {
            if (!prev) return prev;
            const prevAddr = prev.address || {};
            const wpAddr = wpData.address;
            const wpShip = wpData.shippingAddress;
            const prevShip = prev.shippingAddress || {};

            let resolvedAvatar = prev.avatar || '';
            if (wpData.avatar !== undefined) {
              if (wpData.avatar && (wpData.avatar.startsWith('http') || wpData.avatar.startsWith('data:image'))) {
                resolvedAvatar = wpData.avatar;
              } else if (wpData.avatar === '') {
                resolvedAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(prev.name || 'User')}&background=00A3E8&color=fff&bold=true`;
              }
            }
            const avatarHasChanged = resolvedAvatar && resolvedAvatar !== prev.avatar;
            const currentTimestamp = avatarHasChanged ? Date.now() : (prev.avatarUpdatedAt || Date.now());
            const resolvedFirst = wpData.firstName || wpAddr?.firstName || prevAddr.firstName || prev.firstName || '';
            const resolvedLast = wpData.lastName || wpAddr?.lastName || prevAddr.lastName || prev.lastName || '';
            const resolvedName = (resolvedFirst ? `${resolvedFirst} ${resolvedLast}`.trim() : '') || wpData.name || prev.name || 'Member';
            const resolvedCountry = getCountryName(wpAddr?.country || prevAddr.country || prev.country || 'India');
            const resolvedStreet = (wpAddr?.street && wpAddr.street.trim()) || prevAddr.street || prev.street || '';
            const resolvedStreet2 = (wpAddr?.street2 && wpAddr.street2.trim()) || prevAddr.street2 || prev.street2 || '';
            const resolvedCity = (wpAddr?.city && wpAddr.city.trim()) || prevAddr.city || prev.city || '';
            const resolvedDistrict = (wpAddr?.district && wpAddr.district.trim()) || (wpAddr?.city && wpAddr.city.trim()) || prevAddr.district || prev.district || resolvedCity || '';
            const resolvedPincode = (wpAddr?.pincode && wpAddr.pincode.trim()) || prevAddr.pincode || prev.pincode || '';
            const resolvedState = getStateName(wpAddr?.state || prevAddr.state || prev.state || 'Kerala');
            const resolvedPhone = (wpAddr?.phone && wpAddr.phone.trim()) || wpData.phone || prevAddr.phone || prev.phone || '';
            const resolvedBillingEmail = (wpAddr?.email && wpAddr.email.trim()) || wpData.billingEmail || wpData.email || prevAddr.email || prev.billingEmail || prev.email || '';

            const mergedAddress = {
              firstName: resolvedFirst,
              lastName: resolvedLast,
              country: resolvedCountry,
              street: resolvedStreet,
              street2: resolvedStreet2,
              city: resolvedCity,
              district: resolvedDistrict,
              pincode: resolvedPincode,
              state: resolvedState,
              phone: resolvedPhone,
              email: resolvedBillingEmail,
              name: resolvedName,
            };

            const mergedShipping = {
              firstName: wpShip?.firstName || prevShip.firstName || resolvedFirst,
              lastName: wpShip?.lastName || prevShip.lastName || resolvedLast,
              name: wpShip?.name || prevShip.name || (resolvedFirst ? `${resolvedFirst} ${resolvedLast}`.trim() : resolvedName),
              country: getCountryName(wpShip?.country || prevShip.country || resolvedCountry),
              street: (wpShip?.street && wpShip.street.trim()) || prevShip.street || '',
              street2: (wpShip?.street2 && wpShip.street2.trim()) || prevShip.street2 || '',
              city: (wpShip?.city && wpShip.city.trim()) || prevShip.city || '',
              state: getStateName(wpShip?.state || prevShip.state || 'Kerala'),
              pincode: (wpShip?.pincode && wpShip.pincode.trim()) || prevShip.pincode || '',
            };

            const updated = {
              ...prev,
              ...(resolvedName ? { name: resolvedName } : {}),
              firstName: resolvedFirst,
              lastName: resolvedLast,
              country: resolvedCountry,
              billingEmail: resolvedBillingEmail,
              ...(wpData.email && wpData.email.trim() ? { email: wpData.email.trim() } : {}),
              ...(resolvedAvatar ? { avatar: resolvedAvatar } : {}),
              avatarUpdatedAt: currentTimestamp,
              address: mergedAddress,
              shippingAddress: mergedShipping,
              street: resolvedStreet,
              street2: resolvedStreet2,
              city: resolvedCity,
              district: resolvedDistrict,
              pincode: resolvedPincode,
              state: resolvedState,
              phone: resolvedPhone,
              wpCookies: cookies,
            };
            updatedUserObj = updated;
            return updated;
          });

          if (updatedUserObj) {
            await persistUserToMobileDatabase(updatedUserObj);
          }
        }

        // Automatically sync subscription status from WordPress in background
        syncUserSubscription(activeUser).catch(() => {});
        return updatedUserObj;
    } catch (e) {
      // Silent refresh
    }
    return null;
  };

  /**
   * Helper: Extract all hidden input fields from an HTML form
   */
  const extractHiddenFields = (html) => {
    const fields = {};
    if (!html) return fields;
    const hiddenMatches = html.match(/<input[^>]+type=["']hidden["'][^>]*>/gi) || [];
    for (const tag of hiddenMatches) {
      const nameMatch = tag.match(/\bname=["']([^"']+)["']/i);
      const valMatch = tag.match(/\bvalue=["']([^"']*)["']/i);
      if (nameMatch && nameMatch[1]) {
        fields[nameMatch[1]] = valMatch ? valMatch[1] : '';
      }
    }
    return fields;
  };

  /**
   * Helper: Update core WordPress profile details (wp_users & wp_usermeta) directly via XML-RPC
   */
  const editWordPressProfileViaXmlRpc = async (activeUser, profileData = {}) => {
    if (!activeUser) return false;
    try {
      const emailKey = activeUser.email ? activeUser.email.toLowerCase() : '';
      let pwd = activeUser.password;
      if (!pwd && emailKey) {
        try {
          pwd = await AsyncStorage.getItem(`@whiteswan_pwd_${emailKey}`);
        } catch (e) {}
      }
      if (!pwd && activeUser.username) {
        try {
          pwd = await AsyncStorage.getItem(`@whiteswan_pwd_${activeUser.username.toLowerCase()}`);
        } catch (e) {}
      }
      if (!pwd) return false;

      const username = activeUser.username || activeUser.email;
      const firstName = profileData.firstName !== undefined ? profileData.firstName : (activeUser.firstName || '');
      const lastName = profileData.lastName !== undefined ? profileData.lastName : (activeUser.lastName || '');
      const displayName = profileData.displayName || profileData.name || (firstName ? `${firstName} ${lastName}`.trim() : (activeUser.name || 'Member'));

      const xmlPayload = `<?xml version="1.0"?>
<methodCall>
  <methodName>wp.editProfile</methodName>
  <params>
    <param><value><string>1</string></value></param>
    <param><value><string>${escapeXml(username)}</string></value></param>
    <param><value><string>${escapeXml(pwd)}</string></value></param>
    <param>
      <value>
        <struct>
          ${firstName ? `<member><name>first_name</name><value><string>${escapeXml(firstName)}</string></value></member>` : ''}
          ${lastName ? `<member><name>last_name</name><value><string>${escapeXml(lastName)}</string></value></member>` : ''}
          ${displayName ? `<member><name>display_name</name><value><string>${escapeXml(displayName)}</string></value></member>` : ''}
          ${displayName ? `<member><name>nickname</name><value><string>${escapeXml(displayName)}</string></value></member>` : ''}
        </struct>
      </value>
    </param>
  </params>
</methodCall>`;

      const res = await fetch(`${WP_SITE_URL}/xmlrpc.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'User-Agent': 'WhiteswanTVNewsApp/1.0',
        },
        body: xmlPayload,
      });

      if (res.ok) {
        const txt = await res.text();
        const success = txt.includes('<boolean>1</boolean>') || txt.includes('<methodResponse>');
        if (success) {
          console.log('WordPress core profile updated via XML-RPC for:', username);
        }
        return success;
      }
    } catch (e) {
      console.log('XML-RPC editProfile note:', e.message);
    }
    return false;
  };

  /**
   * Sync Profile and Address changes to live WordPress website database
   */
  const syncProfileAndAddressToWordPress = async (activeUser, updates = {}) => {
    if (!activeUser) return false;

    try {
      const email = activeUser.email || updates.email || '';
      let pwd = activeUser.password;
      const emailKey = email ? email.toLowerCase() : '';

      if (!pwd && emailKey) {
        try {
          pwd = await AsyncStorage.getItem(`@whiteswan_pwd_${emailKey}`);
        } catch (e) {}
      }

      // Obtain verified session cookies
      let authCookies = await getAuthenticatedWordPressCookies(activeUser);

      const targetName = updates.name || activeUser.name || 'Member';
      const nameParts = targetName.trim().split(' ').filter(Boolean);
      const firstName = updates.firstName || activeUser.firstName || nameParts[0] || 'Member';
      const lastName = updates.lastName || activeUser.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');

      const country = updates.country || updates.address?.country || activeUser.country || activeUser.address?.country || 'India';
      const countryCode = getCountryCode(country);

      const street = updates.address?.street !== undefined ? updates.address.street : (updates.street !== undefined ? updates.street : (activeUser.address?.street || activeUser.street || ''));
      const street2 = updates.address?.street2 !== undefined ? updates.address.street2 : (updates.street2 !== undefined ? updates.street2 : (activeUser.address?.street2 || activeUser.street2 || ''));
      const city = updates.address?.city !== undefined ? updates.address.city : (updates.city !== undefined ? updates.city : (activeUser.address?.city || activeUser.city || ''));
      const district = updates.address?.district || updates.district || activeUser.address?.district || activeUser.district || city || '';
      const state = updates.address?.state || updates.state || activeUser.address?.state || activeUser.state || 'Kerala';
      const stateCode = getStateCode(state);
      const pincode = updates.address?.pincode !== undefined ? updates.address.pincode : (updates.pincode !== undefined ? updates.pincode : (activeUser.address?.pincode || activeUser.pincode || ''));
      const phone = updates.phone || updates.address?.phone || activeUser.phone || activeUser.address?.phone || '';
      const billingEmail = updates.billingEmail || updates.email || updates.address?.email || email;

      // Shipping fields
      const shipUpdates = updates.shippingAddress || {};
      const shipActive = activeUser.shippingAddress || {};
      const shipFirst = shipUpdates.firstName !== undefined ? shipUpdates.firstName : (shipActive.firstName || firstName);
      const shipLast = shipUpdates.lastName !== undefined ? shipUpdates.lastName : (shipActive.lastName || lastName);
      const shipCountry = shipUpdates.country || shipActive.country || country;
      const shipCountryCode = getCountryCode(shipCountry);
      const shipStreet = shipUpdates.street !== undefined ? shipUpdates.street : (shipActive.street || '');
      const shipStreet2 = shipUpdates.street2 !== undefined ? shipUpdates.street2 : (shipActive.street2 || '');
      const shipCity = shipUpdates.city !== undefined ? shipUpdates.city : (shipActive.city || '');
      const shipState = shipUpdates.state || shipActive.state || state;
      const shipStateCode = getStateCode(shipState);
      const shipPincode = shipUpdates.pincode !== undefined ? shipUpdates.pincode : (shipActive.pincode || '');

      // 0. Update customer profile & addresses directly via WooCommerce REST API if configured
      try {
        const restPayload = {
          first_name: firstName,
          last_name: lastName,
          billing: {
            first_name: firstName,
            last_name: lastName,
            address_1: street,
            address_2: street2,
            city: city || district,
            state: stateCode,
            postcode: pincode,
            country: countryCode,
            email: billingEmail,
            phone: phone,
          },
          shipping: {
            first_name: shipFirst,
            last_name: shipLast,
            address_1: shipStreet,
            address_2: shipStreet2,
            city: shipCity,
            state: shipStateCode,
            postcode: shipPincode,
            country: shipCountryCode,
          },
        };
        await updateWcCustomer(email || activeUser.email || activeUser.id, restPayload);
      } catch (restErr) {
        console.log('REST API customer update note:', restErr.message);
      }

      // Helper to execute form save with auto-recovery if unauthenticated
      const executeFormSync = async (endpointUrl, formFields, refererUrl) => {
        try {
          let getRes = await fetch(endpointUrl, {
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'User-Agent': USER_AGENT,
              'Referer': refererUrl || `${WP_SITE_URL}/my-account/edit-address/`,
              'Cookie': authCookies,
            },
          });

          let pageHtml = await getRes.text();
          let hiddenFields = extractHiddenFields(pageHtml);
          let nonce =
            hiddenFields['woocommerce-edit-address-nonce'] ||
            extractInputValue(pageHtml, 'woocommerce-edit-address-nonce') ||
            hiddenFields['_wpnonce'] ||
            hiddenFields['save-account-details-nonce'];

          // If nonce not found (e.g. redirected to login page), force re-login and retry
          if (!nonce && pwd) {
            console.log('Session expired during form sync, re-authenticating...');
            authCookies = await getAuthenticatedWordPressCookies({ ...activeUser, password: pwd });
            getRes = await fetch(endpointUrl, {
              headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'User-Agent': USER_AGENT,
                'Referer': refererUrl || `${WP_SITE_URL}/my-account/edit-address/`,
                'Cookie': authCookies,
              },
            });
            pageHtml = await getRes.text();
            hiddenFields = extractHiddenFields(pageHtml);
            nonce =
              hiddenFields['woocommerce-edit-address-nonce'] ||
              extractInputValue(pageHtml, 'woocommerce-edit-address-nonce') ||
              hiddenFields['_wpnonce'] ||
              hiddenFields['save-account-details-nonce'];
          }

          const postParams = new URLSearchParams();
          // First include all hidden fields from page (nonces, referers, actions)
          for (const [hk, hv] of Object.entries(hiddenFields)) {
            postParams.append(hk, hv);
          }
          // Overlay with updated fields
          for (const [fk, fv] of Object.entries(formFields)) {
            postParams.set(fk, fv);
          }
          if (refererUrl) {
            const pathMatch = refererUrl.match(/https?:\/\/[^/]+(\/.*)/);
            postParams.set('_wp_http_referer', pathMatch ? pathMatch[1] : refererUrl);
          }
          if (nonce) {
            if (endpointUrl.includes('edit-address')) {
              postParams.set('woocommerce-edit-address-nonce', nonce);
            } else if (endpointUrl.includes('edit-account')) {
              postParams.set('save-account-details-nonce', nonce);
            }
          }

          const postRes = await fetch(endpointUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'User-Agent': USER_AGENT,
              'Referer': refererUrl,
              'Origin': WP_SITE_URL,
              'Cookie': authCookies,
            },
            body: postParams.toString(),
          });

          const postCookies = extractCookiesFromResponse(postRes);
          if (postCookies) {
            authCookies = cleanCookieString([authCookies, postCookies]);
          }

          console.log(`WordPress sync for ${endpointUrl} status:`, postRes.status);
          return postRes.ok || postRes.status === 302;
        } catch (err) {
          console.log(`Form sync error for ${endpointUrl}:`, err.message);
          return false;
        }
      };

      // 1. Sync Billing Address to WooCommerce (/my-account/edit-address/billing/)
      await executeFormSync(
        `${WP_SITE_URL}/my-account/edit-address/billing/`,
        {
          billing_first_name: firstName,
          billing_last_name: lastName,
          billing_company: '',
          billing_country: countryCode,
          billing_address_1: street,
          billing_address_2: street2,
          billing_city: city || district,
          billing_state: stateCode,
          billing_postcode: pincode,
          billing_phone: phone,
          billing_email: billingEmail,
          action: 'edit_address',
          save_address: 'Save address',
        },
        `${WP_SITE_URL}/my-account/edit-address/billing/`
      );

      // 2. Sync Shipping Address to WooCommerce (/my-account/edit-address/shipping/)
      if (shipStreet || shipCity || shipPincode || updates.shippingAddress) {
        await executeFormSync(
          `${WP_SITE_URL}/my-account/edit-address/shipping/`,
          {
            shipping_first_name: shipFirst,
            shipping_last_name: shipLast,
            shipping_company: '',
            shipping_country: shipCountryCode,
            shipping_address_1: shipStreet,
            shipping_address_2: shipStreet2,
            shipping_city: shipCity,
            shipping_state: shipStateCode,
            shipping_postcode: shipPincode,
            action: 'edit_address',
            save_address: 'Save address',
          },
          `${WP_SITE_URL}/my-account/edit-address/shipping/`
        );
      }

      // 3. Sync Account Details (First name, Last name, Display Name, Email)
      await executeFormSync(
        `${WP_SITE_URL}/my-account/edit-account/`,
        {
          account_first_name: firstName,
          account_last_name: lastName,
          account_display_name: targetName,
          account_email: email,
          action: 'save_account_details',
          save_account_details: 'Save changes',
        },
        `${WP_SITE_URL}/my-account/edit-account/`
      );

      // 4. Also update core WordPress profile via XML-RPC
      editWordPressProfileViaXmlRpc(activeUser, {
        firstName,
        lastName,
        displayName: targetName,
      }).catch(() => {});

      // 5. Update session cookies
      if (emailKey && authCookies) {
        await AsyncStorage.setItem(`@whiteswan_cookies_${emailKey}`, authCookies);
      }
      setUser((prev) => (prev ? { ...prev, wpCookies: authCookies } : prev));

      return true;
    } catch (err) {
      console.log('syncProfileAndAddressToWordPress error:', err.message);
      return false;
    }
  };

  /**
   * Upload user avatar to WordPress Media Library & website database
   */
  const uploadAvatarToWordPress = async (activeUser, imageUri, rawBase64 = null) => {
    if (!activeUser || !imageUri) {
      return imageUri;
    }

    const userIdOrEmail = (activeUser.id && /^\d+$/.test(String(activeUser.id).trim()))
      ? String(activeUser.id).trim()
      : (activeUser.email || activeUser.username || activeUser.id);

    // 0. If it is already an HTTP URL (e.g. default avatar reset or external URL), sync directly via WooCommerce REST API
    if (imageUri.startsWith('http')) {
      try {
        const isDefaultAvatar = imageUri.includes('ui-avatars.com') || imageUri.includes('default') || imageUri === '';
        const metaList = [
          { key: 'whiteswan_custom_avatar_url', value: isDefaultAvatar ? '' : imageUri },
          { key: 'whiteswan_custom_avatar_id', value: '' },
          { key: 'custom_profile_avatar', value: isDefaultAvatar ? '' : imageUri },
          { key: 'avatar', value: isDefaultAvatar ? '' : imageUri },
          { key: 'avatar_id', value: '' },
          { key: 'simple_local_avatar', value: isDefaultAvatar ? '' : { full: imageUri, url: imageUri } },
          { key: 'basic_user_avatar', value: isDefaultAvatar ? '' : imageUri },
          { key: 'wp_user_avatar', value: isDefaultAvatar ? '' : imageUri },
          { key: 'user_avatar', value: isDefaultAvatar ? '' : imageUri },
          { key: 'user_avatar_id', value: '' },
          { key: 'profile_photo', value: isDefaultAvatar ? '' : imageUri },
          { key: 'profile_picture', value: isDefaultAvatar ? '' : imageUri },
          { key: 'customer_avatar', value: isDefaultAvatar ? '' : imageUri },
          { key: 'user_profile_avatar', value: isDefaultAvatar ? '' : imageUri },
          { key: 'avatar_url', value: isDefaultAvatar ? '' : imageUri },
          { key: 'profile_photo_url', value: isDefaultAvatar ? '' : imageUri },
          { key: 'synced_profile_photo', value: isDefaultAvatar ? '' : imageUri },
          { key: 'um_member_directory_data', value: { account_status: 'approved', hide_in_members: false, profile_photo: !isDefaultAvatar, cover_photo: false, verified: false } },
          { key: 'wp_custom_avatar', value: '' },
        ];
        const metaPayload = {
          avatar_url: isDefaultAvatar ? '' : imageUri,
          meta_data: metaList,
        };
        await updateWcCustomer(userIdOrEmail, metaPayload);
        console.log('Synchronized HTTP/Reset avatar to WordPress database via REST API:', isDefaultAvatar ? 'CLEARED ALL AVATAR META' : imageUri);
      } catch (e) {
        console.log('HTTP avatar database sync note:', e.message);
      }
      return imageUri;
    }

    try {
      const email = activeUser.email;
      let pwd = activeUser.password;
      const emailKey = email ? email.toLowerCase() : '';

      if (!pwd && emailKey) {
        try {
          pwd = await AsyncStorage.getItem(`@whiteswan_pwd_${emailKey}`);
        } catch (e) {}
      }

      // Obtain base64 representation of image
      let base64Data = rawBase64;
      if (!base64Data && imageUri.startsWith('data:image')) {
        base64Data = imageUri.split(',')[1] || imageUri;
      }

      // Read from local file system if not provided in base64
      if (!base64Data && (imageUri.startsWith('file://') || imageUri.startsWith('/'))) {
        try {
          base64Data = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch (fsReadErr) {
          console.log('FileSystem avatar read note:', fsReadErr.message);
        }
      }

      if (!base64Data && !imageUri.startsWith('http')) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(imageUri, { signal: controller.signal });
          clearTimeout(timeoutId);
          const blob = await res.blob();

          base64Data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (reader.result) {
                const b64 = reader.result.toString().split(',')[1] || reader.result.toString();
                resolve(b64);
              } else {
                resolve(null);
              }
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } catch (e) {}
      }

      let uploadedUrl = null;
      let uploadedMediaId = null;

      // 1. Upload via XML-RPC wp.uploadFile if user password and base64 available
      if (pwd && base64Data) {
        try {
          const fileName = `avatar_${emailKey ? emailKey.replace(/[^a-z0-9]/g, '_') : 'user'}_${Date.now()}.jpg`;
          const uploadXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>wp.uploadFile</methodName>
  <params>
    <param><value><string>1</string></value></param>
    <param><value><string>${escapeXml(activeUser.username || activeUser.email)}</string></value></param>
    <param><value><string>${escapeXml(pwd)}</string></value></param>
    <param>
      <value>
        <struct>
          <member><name>name</name><value><string>${fileName}</string></value></member>
          <member><name>type</name><value><string>image/jpeg</string></value></member>
          <member><name>bits</name><value><base64>${base64Data}</base64></value></member>
          <member><name>overwrite</name><value><boolean>0</boolean></value></member>
        </struct>
      </value>
    </param>
  </params>
</methodCall>`;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          const uploadRes = await fetch(`${WP_SITE_URL}/xmlrpc.php`, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/xml; charset=utf-8',
              'User-Agent': 'WhiteswanTVNewsApp/1.0',
            },
            body: uploadXml,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (uploadRes.ok) {
            const xmlResp = await uploadRes.text();
            const urlMatch = xmlResp.match(/<name>url<\/name>\s*<value>(?:<string>)?([^<]+)(?:<\/string>)?<\/value>/i);
            const idMatch = xmlResp.match(/<name>id<\/name>\s*<value>(?:<string>|<int>)?([^<]+)(?:<\/string>|<\/int>)?<\/value>/i);
            if (urlMatch && urlMatch[1]) {
              uploadedUrl = urlMatch[1].trim();
              if (idMatch && idMatch[1]) {
                uploadedMediaId = idMatch[1].trim();
              }
              console.log('WordPress avatar uploaded successfully via XML-RPC:', uploadedUrl, 'Media ID:', uploadedMediaId);
            }
          }
        } catch (xmlErr) {
          console.log('XML-RPC avatar upload note:', xmlErr.message);
        }
      }

      // 2. Upload via REST API /wp-json/wp/v2/media if XML-RPC didn't succeed
      if (!uploadedUrl) {
        try {
          const authCookies = await getAuthenticatedWordPressCookies(activeUser);
          if (authCookies) {
            const formData = new FormData();
            formData.append('file', {
              uri: imageUri,
              name: `avatar_${Date.now()}.jpg`,
              type: 'image/jpeg',
            });

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            const restRes = await fetch(`${WP_SITE_URL}/wp-json/wp/v2/media`, {
              method: 'POST',
              headers: {
                'User-Agent': USER_AGENT,
                'Cookie': authCookies,
              },
              body: formData,
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (restRes.ok) {
              const mediaJson = await restRes.json();
              if (mediaJson?.source_url) {
                uploadedUrl = mediaJson.source_url;
                if (mediaJson.id) {
                  uploadedMediaId = String(mediaJson.id).trim();
                }
                console.log('REST API avatar uploaded successfully:', uploadedUrl, 'Media ID:', uploadedMediaId);
              }
            }
          }
        } catch (restErr) {
          console.log('REST API avatar upload note:', restErr.message);
        }
      }

      // 3. Link uploaded avatar URL & media ID to WordPress / WooCommerce user database
      let finalAvatarData = (uploadedUrl && uploadedUrl.startsWith('http'))
        ? uploadedUrl
        : (base64Data ? (base64Data.startsWith('data:image') ? base64Data : `data:image/jpeg;base64,${base64Data}`) : null);

      if (!finalAvatarData && imageUri && !imageUri.startsWith('file://')) {
        finalAvatarData = imageUri;
      }

      if (finalAvatarData && (finalAvatarData.startsWith('http') || finalAvatarData.startsWith('data:image'))) {
        try {
          const metaList = [
            { key: 'whiteswan_custom_avatar_url', value: finalAvatarData },
            { key: 'custom_profile_avatar', value: finalAvatarData },
            { key: 'avatar', value: finalAvatarData },
            { key: 'user_avatar', value: uploadedMediaId || finalAvatarData },
            { key: 'profile_photo', value: finalAvatarData },
            { key: 'profile_picture', value: finalAvatarData },
            { key: 'customer_avatar', value: finalAvatarData },
            { key: 'user_profile_avatar', value: finalAvatarData },
            { key: 'avatar_url', value: finalAvatarData },
            { key: 'profile_photo_url', value: finalAvatarData },
            { key: 'synced_profile_photo', value: finalAvatarData },
            { key: 'basic_user_avatar', value: finalAvatarData },
            { key: 'um_member_directory_data', value: { account_status: 'approved', hide_in_members: false, profile_photo: true, cover_photo: false, verified: false } },
          ];

          if (uploadedMediaId) {
            metaList.push(
              { key: 'whiteswan_custom_avatar_id', value: String(uploadedMediaId) },
              { key: 'wp_user_avatar', value: String(uploadedMediaId) },
              { key: 'simple_local_avatar', value: { media_id: String(uploadedMediaId), full: finalAvatarData, url: finalAvatarData } },
              { key: 'avatar_id', value: String(uploadedMediaId) },
              { key: 'user_avatar_id', value: String(uploadedMediaId) }
            );
          } else {
            metaList.push(
              { key: 'wp_user_avatar', value: finalAvatarData },
              { key: 'simple_local_avatar', value: { full: finalAvatarData, url: finalAvatarData } }
            );
          }

          const metaPayload = {
            avatar_url: finalAvatarData,
            meta_data: metaList,
          };
          const wcResult = await updateWcCustomer(userIdOrEmail, metaPayload);
          console.log('WooCommerce Customer avatar store result in WordPress database:', wcResult);
        } catch (e) {
          console.log('WooCommerce customer avatar meta update note:', e.message);
        }

        // Cache purge / touch WordPress session to update web dashboard
        try {
          const authCookies = await getAuthenticatedWordPressCookies(activeUser);
          if (authCookies) {
            await fetch(`${WP_SITE_URL}/my-account/edit-account/`, {
              method: 'GET',
              headers: {
                'User-Agent': USER_AGENT,
                'Cookie': authCookies,
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
              },
            });
          }
        } catch (e) {}

        return finalAvatarData;
      }
    } catch (e) {
      console.log('Avatar upload error:', e.message);
    }

    return imageUri;
  };

  /**
   * Register user directly on WordPress Website (whiteswantvnews.com)
   */
  const registerUserOnWordPress = async (name, email, password, explicitFirst = '', explicitLast = '') => {
    const parts = (name || '').trim().split(' ').filter(Boolean);
    const firstName = (explicitFirst || parts[0] || 'Member').trim();
    const lastName = (explicitLast !== undefined && explicitLast !== '' ? explicitLast : (parts.length > 1 ? parts.slice(1).join(' ') : '')).trim();
    const username = email.split('@')[0];

    // --- Strategy 1: WooCommerce /my-account/ Form Registration (Passes $_POST fields to WordPress PHP hooks) ---
    try {
      const pageRes = await fetch(`${WP_SITE_URL}/my-account/`, {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      const pageHtml = await pageRes.text();
      const cookies = extractCookiesFromResponse(pageRes);
      const hiddenFields = extractHiddenFields(pageHtml);
      const nonceMatch = pageHtml.match(/name="woocommerce-register-nonce"\s+value="([^"]+)"/i);
      const nonce =
        extractInputValue(pageHtml, 'woocommerce-register-nonce') ||
        hiddenFields['woocommerce-register-nonce'] ||
        hiddenFields['_wpnonce'] ||
        (nonceMatch ? nonceMatch[1] : '');

      const bodyParams = new URLSearchParams();
      for (const [hk, hv] of Object.entries(hiddenFields)) {
        bodyParams.append(hk, hv);
      }
      bodyParams.set('username', username);
      bodyParams.set('email', email.trim().toLowerCase());
      bodyParams.set('password', password);
      bodyParams.set('first_name', firstName);
      bodyParams.set('last_name', lastName);
      bodyParams.set('billing_first_name', firstName);
      bodyParams.set('billing_last_name', lastName);
      bodyParams.set('reg_first_name', firstName);
      bodyParams.set('reg_last_name', lastName);
      bodyParams.set('account_first_name', firstName);
      bodyParams.set('account_last_name', lastName);
      if (nonce) {
        bodyParams.set('woocommerce-register-nonce', nonce);
      }
      bodyParams.set('_wp_http_referer', '/my-account/');
      bodyParams.set('register', 'Register');

      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
        'Referer': `${WP_SITE_URL}/my-account/`,
        'Origin': WP_SITE_URL,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      };

      if (cookies) {
        headers['Cookie'] = cookies;
      }

      const registerRes = await fetch(`${WP_SITE_URL}/my-account/`, {
        method: 'POST',
        headers,
        body: bodyParams.toString(),
      });

      const resHtml = await registerRes.text();
      const resCookies = extractCookiesFromResponse(registerRes);
      const allCookies = cleanCookieString([cookies, resCookies]);

      // Check for errors returned by WordPress form
      const errorMatch =
        resHtml.match(/<ul class=["']woocommerce-error["'][^>]*>([\s\S]*?)<\/ul>/i) ||
        resHtml.match(/<div class=["']woocommerce-error["'][^>]*>([\s\S]*?)<\/div>/i);
      if (errorMatch) {
        const errorText = errorMatch[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&#039;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim();
        if (
          errorText.toLowerCase().includes('already registered') ||
          errorText.toLowerCase().includes('already exists')
        ) {
          throw new Error('An account is already registered with this email address. Please sign in instead.');
        }
        if (errorText) {
          throw new Error(errorText);
        }
      }

      const isRegistered =
        allCookies.includes('wordpress_logged_in_') ||
        (registerRes.status === 302 && !resHtml.includes('woocommerce-error')) ||
        resHtml.includes('woocommerce-MyAccount-navigation') ||
        resHtml.includes('customer-logout');

      if (isRegistered) {
        return {
          success: true,
          firstName,
          lastName,
          wpCookies: allCookies,
        };
      }
    } catch (formErr) {
      if (formErr.message && !formErr.message.includes('fetch') && !formErr.message.includes('Network')) {
        throw formErr;
      }
      console.log('WordPress form registration note:', formErr.message);
    }

    // --- Strategy 2: WooCommerce REST API Customer Creation ---
    const restHeaders = getWcRestAuthHeaders();
    if (restHeaders) {
      try {
        const createRes = await fetch(`${WP_SITE_URL}/wp-json/wc/v3/customers`, {
          method: 'POST',
          headers: restHeaders,
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            first_name: firstName,
            last_name: lastName,
            username: username,
            password: password,
            billing: {
              first_name: firstName,
              last_name: lastName,
              email: email.trim().toLowerCase(),
            },
            shipping: {
              first_name: firstName,
              last_name: lastName,
            },
          }),
        });

        const resData = await createRes.json().catch(() => ({}));
        if (createRes.ok && resData?.id) {
          return {
            success: true,
            id: `wp_${resData.id}`,
            firstName: resData.first_name || firstName,
            lastName: resData.last_name || lastName,
            wpCookies: '',
          };
        } else if (resData?.code) {
          if (resData.code.includes('email-exists') || resData.code.includes('already-exists')) {
            throw new Error('An account is already registered with this email address. Please sign in instead.');
          }
          if (resData.code.includes('username-exists')) {
            throw new Error('An account with this username already exists. Please choose a different username.');
          }
        }
      } catch (restErr) {
        if (restErr.message && !restErr.message.includes('fetch')) {
          throw restErr;
        }
      }
    }

    return {
      success: true,
      firstName,
      lastName,
      wpCookies: '',
    };
  };

  /**
   * Authenticate directly against live WordPress website (whiteswantvnews.com)
   */
  const authenticateWithWordPressSite = async (identifier, password) => {
    const cleanId = identifier.trim();
    const cleanPwd = password;
    let authError = '';

    // --- Strategy 1: WooCommerce /my-account/ Form Auth ---
    try {
      const getRes = await fetch(`${WP_SITE_URL}/my-account/`, {
        headers: { 'User-Agent': USER_AGENT },
      });
      const pageHtml = await getRes.text();
      const cookies = extractCookiesFromResponse(getRes);

      const nonceMatch = pageHtml.match(/name="woocommerce-login-nonce"\s+value="([^"]+)"/i);
      const loginNonce =
        extractInputValue(pageHtml, 'woocommerce-login-nonce') ||
        (nonceMatch ? nonceMatch[1] : '');

      const bodyParams = new URLSearchParams();
      bodyParams.append('username', cleanId);
      bodyParams.append('password', cleanPwd);
      bodyParams.append('rememberme', 'forever');
      if (loginNonce) {
        bodyParams.append('woocommerce-login-nonce', loginNonce);
      }
      bodyParams.append('_wp_http_referer', '/my-account/');
      bodyParams.append('login', 'Log in');

      const loginRes = await fetch(`${WP_SITE_URL}/my-account/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
          'Referer': `${WP_SITE_URL}/my-account/`,
          'Origin': WP_SITE_URL,
          ...(cookies ? { 'Cookie': cookies } : {}),
        },
        body: bodyParams.toString(),
      });

      const loginHtml = await loginRes.text();
      const resCookies = extractCookiesFromResponse(loginRes);
      const allCookies = cleanCookieString([cookies, resCookies]);

      // Check for WooCommerce / WordPress error notices in response HTML
      const errorMatch =
        loginHtml.match(/<ul class=["']woocommerce-error["'][^>]*>([\s\S]*?)<\/ul>/i) ||
        loginHtml.match(/<div class=["']woocommerce-error["'][^>]*>([\s\S]*?)<\/div>/i) ||
        loginHtml.match(/<div class=["']woocommerce-NoticeGroup woocommerce-NoticeGroup-checkout["'][^>]*>([\s\S]*?)<\/div>/i);

      if (errorMatch) {
        const extractedErr = errorMatch[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&#039;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim();
        if (extractedErr) {
          const cleanErr = extractedErr
            .replace(/^Error:\s*/i, '')
            .replace(/\s*Lost your password\?\s*$/i, '')
            .trim();
          authError = cleanErr;
          console.log('WooCommerce login returned error notice:', authError);
        }
      }

      // Login is ONLY successful if WordPress set authenticated cookies or returned verified My-Account screen without error
      const hasAuthCookie = allCookies.includes('wordpress_logged_in_');
      const hasDashboardHtml =
        (loginHtml.includes('customer-logout') ||
         loginHtml.includes('action=logout') ||
         loginHtml.includes('woocommerce-MyAccount-navigation-link--customer-logout')) &&
        !loginHtml.includes('woocommerce-error');

      const isLoginSuccess = (hasAuthCookie || hasDashboardHtml) && !errorMatch && !loginHtml.includes('woocommerce-error');

      if (isLoginSuccess) {
        const username = cleanId.includes('@') ? cleanId.split('@')[0] : cleanId;
        const displayName = username.charAt(0).toUpperCase() + username.slice(1);
        const resolvedTargetEmail = cleanId.includes('@') ? cleanId.toLowerCase() : `${cleanId.toLowerCase()}@whiteswantvnews.com`;

        // Fetch user's address & profile details from WordPress
        const wpData = await fetchWordPressAddressAndProfile(allCookies, {
          email: cleanId.includes('@') ? cleanId : '',
          username: username,
        });

        // Also query WooCommerce REST customer endpoint for enriched profile if available
        let wcCustomer = null;
        try {
          const restHeaders = getWcRestAuthHeaders();
          if (restHeaders) {
            const isEmail = cleanId.includes('@');
            const param = isEmail ? `email=${encodeURIComponent(cleanId)}` : `search=${encodeURIComponent(cleanId)}`;
            const wcRes = await fetch(`${WP_SITE_URL}/wp-json/wc/v3/customers?${param}`, {
              headers: restHeaders,
            });
            if (wcRes.ok) {
              const list = await wcRes.json();
              if (Array.isArray(list) && list.length > 0) {
                wcCustomer = list[0];
              }
            }
          }
        } catch (e) {}

        // Check custom avatar, phone, address
        const emailKey = wpData?.email ? wpData.email.toLowerCase() : (wcCustomer?.email ? wcCustomer.email.toLowerCase() : resolvedTargetEmail);
        const savedAvatar = await AsyncStorage.getItem(`@whiteswan_avatar_${emailKey}`);
        const savedPhone = await AsyncStorage.getItem(`@whiteswan_phone_${emailKey}`);
        let savedAddressObj = null;
        try {
          const rawSavedAddr = await AsyncStorage.getItem(`@whiteswan_address_${emailKey}`);
          if (rawSavedAddr) savedAddressObj = JSON.parse(rawSavedAddr);
        } catch (e) {}

        const wpAddr = wpData?.address || {};
        const wcBilling = wcCustomer?.billing || {};
        const savedAddr = savedAddressObj || {};
        const resolvedStreet = (wpAddr.street && wpAddr.street.trim()) || wcBilling.address_1 || savedAddr.street || '';
        const resolvedStreet2 = (wpAddr.street2 && wpAddr.street2.trim()) || wcBilling.address_2 || savedAddr.street2 || '';
        const resolvedCity = (wpAddr.city && wpAddr.city.trim()) || wcBilling.city || savedAddr.city || '';
        const resolvedDistrict = (wpAddr.district && wpAddr.district.trim()) || (wpAddr.city && wpAddr.city.trim()) || wcBilling.city || savedAddr.district || savedAddr.city || '';
        const resolvedPincode = (wpAddr.pincode && wpAddr.pincode.trim()) || wcBilling.postcode || savedAddr.pincode || '';
        const resolvedState = getStateName(wpAddr.state || wcBilling.state || savedAddr.state || 'Kerala');
        const resolvedCountry = getCountryName(wpAddr.country || wcBilling.country || savedAddr.country || 'India');
        const resolvedPhone = (wpAddr.phone && wpAddr.phone.trim()) || wcBilling.phone || wpData?.phone || savedAddr.phone || savedPhone || null;
        const resolvedBillingEmail = (wpAddr.email && wpAddr.email.trim()) || wcBilling.email || wpData?.billingEmail || wpData?.email || savedAddr.email || emailKey;
        const resolvedFirst = wpData?.firstName || wcCustomer?.first_name || wpAddr.firstName || savedAddr.firstName || '';
        const resolvedLast = wpData?.lastName || wcCustomer?.last_name || wpAddr.lastName || savedAddr.lastName || '';
        const resolvedName = wpData?.name || (resolvedFirst ? `${resolvedFirst} ${resolvedLast}`.trim() : displayName);

        const mergedAddress = {
          firstName: resolvedFirst,
          lastName: resolvedLast,
          name: resolvedName,
          country: resolvedCountry,
          street: resolvedStreet,
          street2: resolvedStreet2,
          city: resolvedCity,
          district: resolvedDistrict,
          pincode: resolvedPincode,
          state: resolvedState,
          phone: resolvedPhone,
          email: resolvedBillingEmail,
        };

        return {
          user: {
            id: wcCustomer?.id ? `wp_${wcCustomer.id}` : `wp_${Date.now()}`,
            name: resolvedName,
            firstName: resolvedFirst,
            lastName: resolvedLast,
            username: wcCustomer?.username || username,
            email: wcCustomer?.email || wpData?.email || emailKey,
            avatar: savedAvatar || wcCustomer?.avatar_url || wpData?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedName)}&background=00A3E8&color=fff&bold=true`,
            joinedDate: wcCustomer?.date_created || new Date().toISOString(),
            role: 'Free Member',
            isPremium: false,
            source: 'wordpress_website',
            password: cleanPwd,
            wpCookies: allCookies,
            address: mergedAddress,
            country: resolvedCountry,
            street: resolvedStreet,
            street2: resolvedStreet2,
            city: resolvedCity,
            district: resolvedDistrict,
            pincode: resolvedPincode,
            state: resolvedState,
            phone: resolvedPhone,
          },
          error: null,
        };
      }
    } catch (e) {
      console.log('WooCommerce form auth note:', e.message);
    }

    // --- Strategy 2: XML-RPC Authentication ---
    try {
      const safeId = escapeXml(cleanId);
      const safePwd = escapeXml(cleanPwd);

      const profileXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>wp.getProfile</methodName>
  <params>
    <param><value><string>1</string></value></param>
    <param><value><string>${safeId}</string></value></param>
    <param><value><string>${safePwd}</string></value></param>
  </params>
</methodCall>`;

      const xmlRes = await fetch(`${WP_SITE_URL}/xmlrpc.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'User-Agent': 'WhiteswanTVNewsApp/1.0',
        },
        body: profileXml,
      });

      if (xmlRes.ok) {
        const xmlText = await xmlRes.text();
        const isFault = xmlText.includes('<fault>') || xmlText.includes('faultCode');

        if (isFault) {
          const faultMatch = xmlText.match(/<name>faultString<\/name>\s*<value>\s*<string>([\s\S]*?)<\/string>/i);
          if (faultMatch && faultMatch[1]) {
            const faultString = faultMatch[1].trim();
            if (faultString && !authError) {
              console.log('XML-RPC auth fault:', faultString);
              if (faultString.toLowerCase().includes('incorrect') || faultString.toLowerCase().includes('password')) {
                authError = 'The password you entered is incorrect. Please check your password and try again.';
              }
            }
          }
        } else if (xmlText.includes('<methodResponse>')) {
          const userId = extractXmlVal(xmlText, 'user_id') || `wp_${Date.now()}`;
          const username = extractXmlVal(xmlText, 'username') || cleanId;
          const displayName = extractXmlVal(xmlText, 'display_name') || extractXmlVal(xmlText, 'first_name') || username;
          const userEmail = extractXmlVal(xmlText, 'email') || (cleanId.includes('@') ? cleanId : `${cleanId}@whiteswantvnews.com`);

          const emailKey = userEmail.toLowerCase();
          const savedAvatar = await AsyncStorage.getItem(`@whiteswan_avatar_${emailKey}`);
          const savedPhone = await AsyncStorage.getItem(`@whiteswan_phone_${emailKey}`);
          let savedAddressObj = null;
          try {
            const rawSavedAddr = await AsyncStorage.getItem(`@whiteswan_address_${emailKey}`);
            if (rawSavedAddr) savedAddressObj = JSON.parse(rawSavedAddr);
          } catch (e) {}

          let sessionCookies = '';
          let wpData = null;
          try {
            sessionCookies = await getAuthenticatedWordPressCookies({
              username: username,
              email: userEmail,
              password: cleanPwd,
            });
            if (sessionCookies) {
              wpData = await fetchWordPressAddressAndProfile(sessionCookies, {
                email: userEmail,
                username: username,
                id: userId,
              });
            }
          } catch (e) {}

          const wpAddr = wpData?.address || {};
          const savedAddr = savedAddressObj || {};
          const resolvedStreet = (wpAddr.street && wpAddr.street.trim()) || savedAddr.street || '';
          const resolvedStreet2 = (wpAddr.street2 && wpAddr.street2.trim()) || savedAddr.street2 || '';
          const resolvedCity = (wpAddr.city && wpAddr.city.trim()) || savedAddr.city || '';
          const resolvedDistrict = (wpAddr.district && wpAddr.district.trim()) || (wpAddr.city && wpAddr.city.trim()) || savedAddr.district || savedAddr.city || '';
          const resolvedPincode = (wpAddr.pincode && wpAddr.pincode.trim()) || savedAddr.pincode || '';
          const resolvedState = getStateName(wpAddr.state || savedAddr.state || 'Kerala');
          const resolvedCountry = getCountryName(wpAddr.country || savedAddr.country || 'India');
          const resolvedPhone = (wpAddr.phone && wpAddr.phone.trim()) || wpData?.phone || savedAddr.phone || savedPhone || null;
          const resolvedBillingEmail = (wpAddr.email && wpAddr.email.trim()) || wpData?.billingEmail || wpData?.email || savedAddr.email || userEmail;
          const resolvedFirst = wpData?.firstName || wpAddr.firstName || savedAddr.firstName || '';
          const resolvedLast = wpData?.lastName || wpAddr.lastName || savedAddr.lastName || '';
          const resolvedName = wpData?.name || (resolvedFirst ? `${resolvedFirst} ${resolvedLast}`.trim() : displayName);

          const mergedAddress = {
            firstName: resolvedFirst,
            lastName: resolvedLast,
            name: resolvedName,
            country: resolvedCountry,
            street: resolvedStreet,
            street2: resolvedStreet2,
            city: resolvedCity,
            district: resolvedDistrict,
            pincode: resolvedPincode,
            state: resolvedState,
            phone: resolvedPhone,
            email: resolvedBillingEmail,
          };

          return {
            user: {
              id: `wp_${userId}`,
              name: resolvedName,
              firstName: resolvedFirst,
              lastName: resolvedLast,
              username: username,
              email: userEmail,
              avatar: savedAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedName)}&background=00A3E8&color=fff&bold=true`,
              joinedDate: new Date().toISOString(),
              role: 'Free Member',
              isPremium: false,
              source: 'wordpress_website',
              password: cleanPwd,
              wpCookies: sessionCookies || '',
              address: mergedAddress,
              country: resolvedCountry,
              street: resolvedStreet,
              street2: resolvedStreet2,
              city: resolvedCity,
              district: resolvedDistrict,
              pincode: resolvedPincode,
              state: resolvedState,
              phone: resolvedPhone,
            },
            error: null,
          };
        }
      }
    } catch (e) {
      console.log('XML-RPC auth note:', e.message);
    }

    // --- Strategy 3: REST API customer lookup fallback to provide exact error message ---
    if (!authError) {
      try {
        const restHeaders = getWcRestAuthHeaders();
        if (restHeaders) {
          const isEmail = cleanId.includes('@');
          const param = isEmail ? `email=${encodeURIComponent(cleanId)}` : `search=${encodeURIComponent(cleanId)}`;
          const wcRes = await fetch(`${WP_SITE_URL}/wp-json/wc/v3/customers?${param}`, {
            headers: restHeaders,
          });
          if (wcRes.ok) {
            const customers = await wcRes.json();
            if (Array.isArray(customers) && customers.length > 0) {
              authError = 'The password you entered is incorrect. Please check your password and try again.';
            } else {
              authError = 'This username or email address is not registered. Please check your credentials or register a new account.';
            }
          }
        }
      } catch (e) {}
    }

    return { user: null, error: authError || 'Unknown username/email or incorrect password. Please check your credentials or register a new account.' };
  };

  /**
   * Real Login function
   */
  const login = async (identifier, password) => {
    isLoggedOutRef.current = false;
    const rawId = (identifier || '').trim();
    const normalizedEmailOrUser = rawId.toLowerCase();

    if (!rawId) {
      throw new Error('Please enter your WordPress username or email address.');
    }

    if (!password) {
      throw new Error('Please enter your password.');
    }

    // 1. Try WordPress Live Authentication first
    const { user: wpUser, error: wpError } = await authenticateWithWordPressSite(rawId, password);
    if (wpUser) {
      // Check if we have locally cached premium status or stored address/photo details
      const users = await getRegisteredUsers();
      const localMatched = users.find(
        (u) =>
          (u.email && wpUser.email && u.email.toLowerCase() === wpUser.email.toLowerCase()) ||
          (u.username && wpUser.username && u.username.toLowerCase() === wpUser.username.toLowerCase())
      );

      const emailKey = wpUser.email ? wpUser.email.toLowerCase() : '';
      let savedAddressObj = null;
      if (emailKey) {
        try {
          const rawSavedAddr = await AsyncStorage.getItem(`@whiteswan_address_${emailKey}`);
          if (rawSavedAddr) savedAddressObj = JSON.parse(rawSavedAddr);
        } catch (e) {}
      }

      const wpAddr = wpUser.address || {};
      const savedAddr = savedAddressObj || {};
      const localAddr = localMatched?.address || {};

      const resolvedStreet = (wpAddr.street && wpAddr.street.trim()) || savedAddr.street || localAddr.street || localMatched?.street || '';
      const resolvedStreet2 = (wpAddr.street2 && wpAddr.street2.trim()) || savedAddr.street2 || localAddr.street2 || localMatched?.street2 || '';
      const resolvedCity = (wpAddr.city && wpAddr.city.trim()) || savedAddr.city || localAddr.city || localMatched?.city || '';
      const resolvedDistrict = (wpAddr.district && wpAddr.district.trim()) || (wpAddr.city && wpAddr.city.trim()) || savedAddr.district || localAddr.district || localMatched?.district || resolvedCity || '';
      const resolvedPincode = (wpAddr.pincode && wpAddr.pincode.trim()) || savedAddr.pincode || localAddr.pincode || localMatched?.pincode || '';
      const resolvedState = getStateName(wpAddr.state || savedAddr.state || localAddr.state || localMatched?.state || 'Kerala');
      const resolvedCountry = getCountryName(wpAddr.country || savedAddr.country || localAddr.country || localMatched?.country || 'India');
      const resolvedFirst = wpUser.firstName || wpAddr.firstName || savedAddr.firstName || localMatched?.firstName || '';
      const resolvedLast = wpUser.lastName || wpAddr.lastName || savedAddr.lastName || localMatched?.lastName || '';
      const resolvedName = (resolvedFirst ? `${resolvedFirst} ${resolvedLast}`.trim() : '') || wpUser.name || localMatched?.name || 'Member';
      const resolvedPhone = (wpAddr.phone && wpAddr.phone.trim()) || wpUser.phone || savedAddr.phone || localMatched?.phone || null;
      const resolvedBillingEmail = (wpAddr.email && wpAddr.email.trim()) || wpUser.billingEmail || wpUser.email || savedAddr.email || '';

      const mergedAddress = {
        firstName: resolvedFirst,
        lastName: resolvedLast,
        name: resolvedName,
        country: resolvedCountry,
        street: resolvedStreet,
        street2: resolvedStreet2,
        city: resolvedCity,
        district: resolvedDistrict,
        pincode: resolvedPincode,
        state: resolvedState,
        phone: resolvedPhone,
        email: resolvedBillingEmail,
      };

      const finalUser = {
        ...wpUser,
        ...(localMatched
          ? {
              isPremium: !!(
                (localMatched.isPremium && localMatched.expiresAt && new Date(localMatched.expiresAt).getTime() > Date.now()) ||
                wpUser.isPremium
              ),
              premiumPlan: localMatched.premiumPlan || wpUser.premiumPlan || null,
              planPrice: localMatched.planPrice || wpUser.planPrice || null,
              subscribedAt: localMatched.subscribedAt || wpUser.subscribedAt || null,
              expiresAt: localMatched.expiresAt || wpUser.expiresAt || null,
              avatar: localMatched.avatar || wpUser.avatar,
            }
          : {}),
        name: resolvedName,
        firstName: resolvedFirst,
        lastName: resolvedLast,
        country: resolvedCountry,
        street: resolvedStreet,
        street2: resolvedStreet2,
        city: resolvedCity,
        district: resolvedDistrict,
        pincode: resolvedPincode,
        state: resolvedState,
        phone: resolvedPhone,
        billingEmail: resolvedBillingEmail,
        address: mergedAddress,
        password: password,
        wpCookies: wpUser.wpCookies,
      };

      await persistUserToMobileDatabase(finalUser);
      setUser(finalUser);

      // Automatically sync WordPress subscriptions in background
      refreshWordPressProfile(finalUser).catch(() => {});
      syncUserSubscription(finalUser).catch(() => {});

      return finalUser;
    }

    // 2. Try App Registered Users Database (offline / mobile registered account fallback)
    const users = await getRegisteredUsers();
    const matchedUser = users.find(
      (u) =>
        (u.email && u.email.toLowerCase() === normalizedEmailOrUser) ||
        (u.username && u.username.toLowerCase() === normalizedEmailOrUser)
    );

    if (matchedUser) {
      if (matchedUser.password && matchedUser.password !== password) {
        throw new Error('The password you entered is incorrect. Please check your password and try again.');
      }

      // If WordPress rejected due to incorrect password, show WordPress live error
      if (wpError && (wpError.toLowerCase().includes('password') || wpError.toLowerCase().includes('incorrect'))) {
        throw new Error(wpError);
      }

      const emailKey = matchedUser.email.toLowerCase();
      const savedAvatar = await AsyncStorage.getItem(`@whiteswan_avatar_${emailKey}`);
      const savedPhone = await AsyncStorage.getItem(`@whiteswan_phone_${emailKey}`);
      let savedAddressObj = null;
      try {
        const rawSavedAddr = await AsyncStorage.getItem(`@whiteswan_address_${emailKey}`);
        if (rawSavedAddr) savedAddressObj = JSON.parse(rawSavedAddr);
      } catch (e) {}

      const mergedAddress = {
        ...(matchedUser.address || {}),
        ...(savedAddressObj || {}),
      };

      const sessionData = {
        id: matchedUser.id,
        name: matchedUser.name,
        email: matchedUser.email,
        username: matchedUser.username || matchedUser.email.split('@')[0],
        avatar: savedAvatar || matchedUser.avatar,
        joinedDate: matchedUser.joinedDate,
        role: matchedUser.isPremium ? 'Premium VIP' : (matchedUser.role || 'Free Member'),
        isPremium: !!matchedUser.isPremium,
        premiumPlan: matchedUser.premiumPlan || null,
        planPrice: matchedUser.planPrice || null,
        subscribedAt: matchedUser.subscribedAt || null,
        expiresAt: matchedUser.expiresAt || null,
        address: mergedAddress,
        street: mergedAddress.street || matchedUser.street || '',
        city: mergedAddress.city || matchedUser.city || '',
        district: mergedAddress.district || matchedUser.district || '',
        pincode: mergedAddress.pincode || matchedUser.pincode || '',
        state: mergedAddress.state || matchedUser.state || 'Kerala',
        phone: savedPhone || matchedUser.phone || matchedUser.address?.phone || null,
        password: password,
        source: 'app_account',
      };

      await persistUserToMobileDatabase(sessionData);
      setUser(sessionData);

      // Attempt background live WordPress sync/refresh
      refreshWordPressProfile(sessionData).catch(() => {});

      return sessionData;
    }

    // If WordPress provided a specific error reason (e.g. unknown user, incorrect password), throw exact message
    if (wpError) {
      throw new Error(wpError);
    }

    // Neither live WordPress nor local match found
    throw new Error(
      'Unknown username or email address. Please check your credentials or register a new account.'
    );
  };

  /**
   * Real Register function:
   * Creates the user account on live WordPress site (whiteswantvnews.com) + local storage
   */
  const register = async (nameOrFirst, emailOrLast, passwordOrEmail, maybePassword) => {
    isLoggedOutRef.current = false;
    let firstName = '';
    let lastName = '';
    let email = '';
    let password = '';

    if (maybePassword !== undefined) {
      // Called with 4 arguments: (firstName, lastName, email, password)
      firstName = (nameOrFirst || '').trim();
      lastName = (emailOrLast || '').trim();
      email = (passwordOrEmail || '').trim().toLowerCase();
      password = maybePassword;
    } else {
      // Called with 3 arguments: (fullName, email, password)
      const rawName = (nameOrFirst || '').trim();
      const parts = rawName.split(' ').filter(Boolean);
      firstName = parts[0] || '';
      lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
      email = (emailOrLast || '').trim().toLowerCase();
      password = passwordOrEmail;
    }

    const trimmedName = `${firstName} ${lastName}`.trim();

    if (!firstName || firstName.length < 2) {
      throw new Error('Please enter your first name (at least 2 characters).');
    }

    if (!lastName) {
      throw new Error('Please enter your last name.');
    }

    if (!email) {
      throw new Error('Please enter your email address.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Please enter a valid email address.');
    }

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    // 1. Create account on Live WordPress Website
    const wpRegResult = await registerUserOnWordPress(trimmedName, email, password, firstName, lastName);

    // 2. Set active user session and persist to mobile database
    const sessionData = {
      id: `wp_${Date.now()}`,
      name: trimmedName,
      firstName: wpRegResult.firstName || firstName,
      lastName: wpRegResult.lastName || lastName,
      country: 'India',
      email: email,
      username: email.split('@')[0],
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(trimmedName)}&background=00A3E8&color=fff&bold=true`,
      joinedDate: new Date().toISOString(),
      role: 'Free Member',
      isPremium: false,
      password: password,
      wpCookies: wpRegResult.wpCookies || '',
      source: 'wordpress_synced',
    };

    await persistUserToMobileDatabase(sessionData);
    setUser(sessionData);

    // 4. Immediately synchronize profile and name to live WordPress database
    syncProfileAndAddressToWordPress(sessionData, {
      firstName: wpRegResult.firstName || firstName,
      lastName: wpRegResult.lastName || lastName,
      name: trimmedName,
      country: 'India',
      email: email,
    }).catch(() => {});

    return sessionData;
  };

  /**
   * Update Profile & Address
   * Updates state/AsyncStorage immediately + synchronizes with WordPress live database
   */
  const updateProfile = async (updates) => {
    if (!user) return;
    const emailKey = user.email ? user.email.toLowerCase() : '';

    const cleanFirst = updates.firstName !== undefined ? updates.firstName : (updates.address?.firstName !== undefined ? updates.address.firstName : (user.firstName || user.address?.firstName || ''));
    const cleanLast = updates.lastName !== undefined ? updates.lastName : (updates.address?.lastName !== undefined ? updates.address.lastName : (user.lastName || user.address?.lastName || ''));
    const cleanCountry = updates.country !== undefined ? updates.country : (updates.address?.country !== undefined ? updates.address.country : (user.country || user.address?.country || 'India'));
    const cleanStreet = updates.street !== undefined ? updates.street : (updates.address?.street !== undefined ? updates.address.street : (user.street || user.address?.street || ''));
    const cleanStreet2 = updates.street2 !== undefined ? updates.street2 : (updates.address?.street2 !== undefined ? updates.address.street2 : (user.street2 || user.address?.street2 || ''));
    const cleanCity = updates.city !== undefined ? updates.city : (updates.address?.city !== undefined ? updates.address.city : (user.city || user.address?.city || ''));
    const cleanDistrict = updates.district !== undefined ? updates.district : (updates.address?.district !== undefined ? updates.address.district : (user.district || user.address?.district || cleanCity || ''));
    const cleanPincode = updates.pincode !== undefined ? updates.pincode : (updates.address?.pincode !== undefined ? updates.address.pincode : (user.pincode || user.address?.pincode || ''));
    const cleanState = updates.state !== undefined ? updates.state : (updates.address?.state !== undefined ? updates.address.state : (user.state || user.address?.state || 'Kerala'));
    const cleanPhone = updates.phone !== undefined ? updates.phone : (updates.address?.phone !== undefined ? updates.address.phone : (user.phone || user.address?.phone || ''));
    const cleanEmail = updates.billingEmail || updates.email || updates.address?.email || user.email || '';
    const cleanName = updates.name !== undefined ? updates.name : (cleanFirst ? `${cleanFirst} ${cleanLast}`.trim() : (user.name || 'Member'));

    const newAddress = {
      ...(user.address || {}),
      ...(updates.address || {}),
      firstName: cleanFirst,
      lastName: cleanLast,
      country: cleanCountry,
      street: cleanStreet,
      street2: cleanStreet2,
      city: cleanCity,
      district: cleanDistrict,
      pincode: cleanPincode,
      state: cleanState,
      phone: cleanPhone,
      email: cleanEmail,
      name: cleanName,
    };

    const updatedUser = {
      ...user,
      ...updates,
      name: cleanName,
      firstName: cleanFirst,
      lastName: cleanLast,
      country: cleanCountry,
      phone: cleanPhone,
      street: cleanStreet,
      street2: cleanStreet2,
      city: cleanCity,
      district: cleanDistrict,
      pincode: cleanPincode,
      state: cleanState,
      billingEmail: cleanEmail,
      address: newAddress,
      password: user.password,
      wpCookies: user.wpCookies,
      ...(updates.avatar ? { avatarUpdatedAt: Date.now() } : {}),
    };

    // If custom avatar or address is set, permanently persist per user email
    if (updates.avatar && emailKey) {
      await AsyncStorage.setItem(`@whiteswan_avatar_${emailKey}`, updates.avatar);
      try {
        const remoteUrl = await uploadAvatarToWordPress(updatedUser, updates.avatar, updates.avatarBase64 || null);
        if (remoteUrl && (remoteUrl.startsWith('http') || remoteUrl.startsWith('data:image'))) {
          await AsyncStorage.setItem(`@whiteswan_avatar_${emailKey}`, remoteUrl);
          updatedUser.avatar = remoteUrl;
          updatedUser.avatarUpdatedAt = Date.now();
          setUser((prev) => (prev ? { ...prev, avatar: remoteUrl, avatarUpdatedAt: Date.now() } : prev));
          const currentUsers = await getRegisteredUsers();
          const updatedWithRemoteAvatar = currentUsers.map((u) => {
            if ((u.id && user.id && u.id === user.id) || (u.email && u.email.toLowerCase() === emailKey)) {
              return { ...u, avatar: remoteUrl, avatarUpdatedAt: Date.now() };
            }
            return u;
          });
          await AsyncStorage.setItem(USERS_DB_KEY, JSON.stringify(updatedWithRemoteAvatar));
        }
      } catch (uploadErr) {
        console.log('Avatar upload error during updateProfile:', uploadErr.message);
      }
    }
    if (newAddress && emailKey) {
      await AsyncStorage.setItem(`@whiteswan_address_${emailKey}`, JSON.stringify(newAddress));
    }
    if (updatedUser.phone && emailKey) {
      await AsyncStorage.setItem(`@whiteswan_phone_${emailKey}`, updatedUser.phone);
    }

    // Update local state and mobile database immediately for instant UI responsiveness
    await persistUserToMobileDatabase(updatedUser);
    setUser(updatedUser);

    // Synchronize live with WordPress database (WooCommerce address & account details) if profile/address details changed
    const hasAddressOrNameChanges =
      updates.name ||
      updates.firstName ||
      updates.lastName ||
      updates.street ||
      updates.city ||
      updates.state ||
      updates.pincode ||
      updates.phone ||
      updates.address ||
      updates.billingEmail;

    if (hasAddressOrNameChanges) {
      try {
        await syncProfileAndAddressToWordPress(updatedUser, updates);
      } catch (syncErr) {
        console.log('WordPress background sync notification:', syncErr.message);
      }
    }
    return updatedUser;
  };

  /**
   * Explicit sync trigger
   */
  const syncWordPressData = async () => {
    if (!user) return;
    return await syncProfileAndAddressToWordPress(user, {});
  };

  /**
   * Explicit refresh trigger
   */
  const refreshUserData = async () => {
    if (!user) return;
    return await refreshWordPressProfile(user);
  };

  /**
   * Fetch Orders from live WooCommerce (/my-account/orders/)
   */
  const fetchUserOrders = async (activeUser) => {
    const targetUser = activeUser || user;
    if (!targetUser) return [];

    try {
      const emailKey = targetUser.email ? targetUser.email.toLowerCase() : '';
      let remoteOrders = [];

      // 0. Fetch orders directly via WooCommerce REST API if configured
      try {
        const restOrders = await fetchWcOrders(targetUser);
        if (restOrders && restOrders.length > 0) {
          remoteOrders = restOrders;
        }
      } catch (restErr) {
        console.log('REST API orders note:', restErr.message);
      }

      // If REST API didn't return orders, fetch via session cookies & HTML parsing
      if (remoteOrders.length === 0) {
        const cookies = await getAuthenticatedWordPressCookies(targetUser);
        if (cookies) {
          try {
            const res = await fetch(`${WP_SITE_URL}/my-account/orders/`, {
              headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'User-Agent': USER_AGENT,
                'Referer': `${WP_SITE_URL}/my-account/`,
                'Cookie': cookies,
              },
            });

          if (res.ok) {
            const html = await res.text();
            const rowRegex = /<tr[^>]*class=["'][^"']*woocommerce-orders-table__row[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi;
            let match;
            while ((match = rowRegex.exec(html)) !== null) {
              const rowHtml = match[1];
              const orderNumMatch =
                rowHtml.match(/woocommerce-orders-table__cell-order-number[^>]*>[\s\S]*?<a[^>]*href=["']([^"']*)["'][^>]*>#?(\d+)<\/a>/i) ||
                rowHtml.match(/data-title=["']Order["'][^>]*>[\s\S]*?#?(\d+)/i);
              const dateMatch =
                rowHtml.match(/<time[^>]*datetime=["']([^"']*)["'][^>]*>([^<]+)<\/time>/i) ||
                rowHtml.match(/woocommerce-orders-table__cell-order-date[^>]*>([^<]+)<\/td>/i);
              const statusMatch = rowHtml.match(/woocommerce-orders-table__cell-order-status[^>]*>([\s\S]*?)<\/td>/i);
              const totalMatch = rowHtml.match(/woocommerce-orders-table__cell-order-total[^>]*>([\s\S]*?)<\/td>/i);

              if (orderNumMatch) {
                const orderId = orderNumMatch[2] || orderNumMatch[1] || '';
                const viewUrl = orderNumMatch[1]?.startsWith('http')
                  ? orderNumMatch[1]
                  : `${WP_SITE_URL}/my-account/view-order/${orderId}/`;
                const rawDateStr = dateMatch ? (dateMatch[1] || dateMatch[2] || '').trim() : '';
                const parsedDateObj = parseSafeDate(rawDateStr);
                const orderDate = dateMatch ? (dateMatch[2] || dateMatch[1]).trim() : 'Recent';
                const timeStr = parsedDateObj.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                });
                const rawStatus = statusMatch ? statusMatch[1].replace(/<[^>]+>/g, '').trim() : 'Completed';
                const rawTotal = totalMatch ? totalMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';

                remoteOrders.push({
                  id: `#${orderId}`,
                  rawId: orderId,
                  date: orderDate,
                  time: timeStr,
                  dateTime: rawDateStr && rawDateStr.includes('T') ? `${orderDate}, ${timeStr}` : orderDate,
                  rawDate: rawDateStr,
                  status: rawStatus,
                  total: rawTotal || '₹299 for 1 item',
                  viewUrl: viewUrl,
                  source: 'woocommerce',
                });
              }
            }
          }
        } catch (fetchErr) {
          console.log('Orders fetch note:', fetchErr.message);
        }
      }
    }

      // Check locally cached/stored orders (e.g. PhonePe subscriptions or offline orders)
      let localOrders = [];
      if (emailKey) {
        try {
          const rawLocal = await AsyncStorage.getItem(`@whiteswan_orders_${emailKey}`);
          if (rawLocal) {
            const parsed = JSON.parse(rawLocal);
            if (Array.isArray(parsed)) {
              // Exclude dummy VIP placeholder orders
              localOrders = parsed.filter((o) => o && !String(o.id).startsWith('#VIP-'));
            }
          }
        } catch (e) {}
      }

      // Filter only valid, successful orders (Completed, Processing, Active, On-hold)
      const validRemote = remoteOrders.filter((ro) => {
        const st = (ro.status || '').toLowerCase();
        return !st.includes('cancel') && !st.includes('refund') && !st.includes('trash') && !st.includes('failed');
      });

      let merged = [...validRemote];

      // If no remote orders were found, check local verified orders
      if (merged.length === 0) {
        for (const lo of localOrders) {
          if (!merged.some((ro) => ro.id === lo.id || ro.rawId === lo.rawId)) {
            merged.push(lo);
          }
        }
      }

      if (emailKey) {
        await AsyncStorage.setItem(`@whiteswan_orders_${emailKey}`, JSON.stringify(merged));
      }

      return merged;
    } catch (e) {
      console.log('fetchUserOrders error:', e.message);
      return [];
    }
  };

  /**
   * Dedicated CRUD: Sync Billing Address directly to WooCommerce (/my-account/edit-address/billing/)
   */
  const syncBillingAddress = async (billingUpdates) => {
    if (!user) return false;
    try {
      const email = user.email || '';
      let pwd = user.password;
      const emailKey = email ? email.toLowerCase() : '';

      if (!pwd && emailKey) {
        try {
          pwd = await AsyncStorage.getItem(`@whiteswan_pwd_${emailKey}`);
        } catch (e) {}
      }

      let authCookies = await getAuthenticatedWordPressCookies(user);

      const targetName = billingUpdates.name || user.name || 'Member';
      const nameParts = targetName.trim().split(' ').filter(Boolean);
      const firstName =
        billingUpdates.firstName !== undefined
          ? billingUpdates.firstName
          : (user.address?.firstName || user.firstName || nameParts[0] || 'Member');
      const lastName =
        billingUpdates.lastName !== undefined
          ? billingUpdates.lastName
          : (user.address?.lastName || user.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''));
      const country = billingUpdates.country || user.address?.country || user.country || 'India';
      const countryCode = getCountryCode(country);
      const street = billingUpdates.street !== undefined ? billingUpdates.street : (user.address?.street !== undefined ? user.address.street : (user.street || ''));
      const street2 = billingUpdates.street2 !== undefined ? billingUpdates.street2 : (user.address?.street2 !== undefined ? user.address.street2 : (user.street2 || ''));
      const city = billingUpdates.city !== undefined ? billingUpdates.city : (user.address?.city !== undefined ? user.address.city : (user.city || ''));
      const district = billingUpdates.district !== undefined ? billingUpdates.district : (user.address?.district !== undefined ? user.address.district : city);
      const state = billingUpdates.state || user.address?.state || user.state || 'Kerala';
      const stateCode = getStateCode(state);
      const pincode = billingUpdates.pincode !== undefined ? billingUpdates.pincode : (user.address?.pincode !== undefined ? user.address.pincode : (user.pincode || ''));
      const phone = billingUpdates.phone !== undefined ? billingUpdates.phone : (user.address?.phone !== undefined ? user.address.phone : (user.phone || ''));
      const billingEmail = billingUpdates.billingEmail !== undefined ? billingUpdates.billingEmail : (billingUpdates.email !== undefined ? billingUpdates.email : (user.address?.email || user.email || email));

      const billingData = {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        country: getCountryName(country),
        street,
        street2,
        city,
        district,
        state: getStateName(state),
        pincode,
        phone,
        email: billingEmail,
      };

      const updatedUser = {
        ...user,
        name: `${firstName} ${lastName}`.trim() || user.name || 'Member',
        firstName,
        lastName,
        country: getCountryName(country),
        phone,
        street,
        street2,
        city,
        district,
        pincode,
        state: getStateName(state),
        billingEmail,
        address: billingData,
      };

      if (emailKey) {
        await AsyncStorage.setItem(`@whiteswan_address_${emailKey}`, JSON.stringify(billingData));
        if (phone) {
          await AsyncStorage.setItem(`@whiteswan_phone_${emailKey}`, phone);
        }
      }

      await persistUserToMobileDatabase(updatedUser);
      setUser(updatedUser);

      // REST API: Update billing address via WooCommerce REST API
      try {
        await updateWcCustomer(billingEmail || email || user?.email || user?.id, {
          first_name: firstName,
          last_name: lastName,
          billing: {
            first_name: firstName,
            last_name: lastName,
            address_1: street,
            address_2: street2,
            city: city || district,
            state: stateCode,
            postcode: pincode,
            country: countryCode,
            email: billingEmail,
            phone: phone,
          },
        });
      } catch (restErr) {
        console.log('REST API billing sync note:', restErr.message);
      }

      // Post to WooCommerce billing endpoint (/my-account/edit-address/billing/)
      let getRes = await fetch(`${WP_SITE_URL}/my-account/edit-address/billing/`, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': USER_AGENT,
          'Referer': `${WP_SITE_URL}/my-account/edit-address/`,
          'Cookie': authCookies,
        },
      });

      let pageHtml = await getRes.text();
      let hiddenFields = extractHiddenFields(pageHtml);
      let nonce =
        hiddenFields['woocommerce-edit-address-nonce'] ||
        extractInputValue(pageHtml, 'woocommerce-edit-address-nonce') ||
        hiddenFields['_wpnonce'];

      if (!nonce && pwd) {
        console.log('Session expired during billing sync, re-authenticating...');
        authCookies = await getAuthenticatedWordPressCookies({ ...user, password: pwd });
        getRes = await fetch(`${WP_SITE_URL}/my-account/edit-address/billing/`, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': USER_AGENT,
            'Referer': `${WP_SITE_URL}/my-account/edit-address/`,
            'Cookie': authCookies,
          },
        });
        pageHtml = await getRes.text();
        hiddenFields = extractHiddenFields(pageHtml);
        nonce =
          hiddenFields['woocommerce-edit-address-nonce'] ||
          extractInputValue(pageHtml, 'woocommerce-edit-address-nonce') ||
          hiddenFields['_wpnonce'];
      }

      const postParams = new URLSearchParams();
      for (const [hk, hv] of Object.entries(hiddenFields)) {
        postParams.append(hk, hv);
      }
      postParams.set('billing_first_name', firstName);
      postParams.set('billing_last_name', lastName);
      postParams.set('billing_company', '');
      postParams.set('billing_country', countryCode);
      postParams.set('billing_address_1', street);
      postParams.set('billing_address_2', street2);
      postParams.set('billing_city', city || district);
      postParams.set('billing_state', stateCode);
      postParams.set('billing_postcode', pincode);
      postParams.set('billing_phone', phone);
      postParams.set('billing_email', billingEmail);
      postParams.set('action', 'edit_address');
      postParams.set('save_address', 'Save address');
      postParams.set('_wp_http_referer', '/my-account/edit-address/billing/');
      if (nonce) {
        postParams.set('woocommerce-edit-address-nonce', nonce);
      }

      const postRes = await fetch(`${WP_SITE_URL}/my-account/edit-address/billing/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': USER_AGENT,
          'Referer': `${WP_SITE_URL}/my-account/edit-address/billing/`,
          'Origin': WP_SITE_URL,
          'Cookie': authCookies,
        },
        body: postParams.toString(),
      });

      const postCookies = extractCookiesFromResponse(postRes);
      if (postCookies && emailKey) {
        authCookies = cleanCookieString([authCookies, postCookies]);
        await AsyncStorage.setItem(`@whiteswan_cookies_${emailKey}`, authCookies);
        setUser((prev) => (prev ? { ...prev, wpCookies: authCookies } : prev));
      }

      // Also update core WordPress profile via XML-RPC
      editWordPressProfileViaXmlRpc(updatedUser, {
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`.trim(),
      }).catch(() => {});

      console.log('WordPress billing address sync status:', postRes.status);
      return postRes.ok || postRes.status === 302;
    } catch (e) {
      console.log('syncBillingAddress error:', e.message);
      return false;
    }
  };

  /**
   * Sync Shipping Address to WooCommerce (/my-account/edit-address/shipping/)
   */
  const syncShippingAddress = async (shippingUpdates) => {
    if (!user) return false;
    try {
      const email = user.email || '';
      let pwd = user.password;
      const emailKey = email ? email.toLowerCase() : '';

      if (!pwd && emailKey) {
        try {
          pwd = await AsyncStorage.getItem(`@whiteswan_pwd_${emailKey}`);
        } catch (e) {}
      }

      let authCookies = await getAuthenticatedWordPressCookies(user);

      const targetName = shippingUpdates.name || user.name || 'Member';
      const nameParts = targetName.trim().split(' ').filter(Boolean);
      const firstName =
        shippingUpdates.firstName !== undefined
          ? shippingUpdates.firstName
          : (user.shippingAddress?.firstName || user.firstName || nameParts[0] || 'Member');
      const lastName =
        shippingUpdates.lastName !== undefined
          ? shippingUpdates.lastName
          : (user.shippingAddress?.lastName || user.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''));
      const country = shippingUpdates.country || user.shippingAddress?.country || 'India';
      const countryCode = getCountryCode(country);
      const street = shippingUpdates.street !== undefined ? shippingUpdates.street : (user.shippingAddress?.street !== undefined ? user.shippingAddress.street : '');
      const street2 = shippingUpdates.street2 !== undefined ? shippingUpdates.street2 : (user.shippingAddress?.street2 !== undefined ? user.shippingAddress.street2 : '');
      const city = shippingUpdates.city !== undefined ? shippingUpdates.city : (user.shippingAddress?.city !== undefined ? user.shippingAddress.city : '');
      const state = shippingUpdates.state || user.shippingAddress?.state || 'Kerala';
      const stateCode = getStateCode(state);
      const pincode = shippingUpdates.pincode !== undefined ? shippingUpdates.pincode : (user.shippingAddress?.pincode !== undefined ? user.shippingAddress.pincode : '');

      const shippingData = {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        country: getCountryName(country),
        street,
        street2,
        city,
        state: getStateName(state),
        pincode,
      };

      const updatedUser = {
        ...user,
        shippingAddress: shippingData,
      };

      if (emailKey) {
        await AsyncStorage.setItem(`@whiteswan_shipping_${emailKey}`, JSON.stringify(shippingData));
      }

      await persistUserToMobileDatabase(updatedUser);
      setUser(updatedUser);

      // REST API: Update shipping address via WooCommerce REST API
      try {
        await updateWcCustomer(email || user?.email || user?.id, {
          shipping: {
            first_name: firstName,
            last_name: lastName,
            address_1: street,
            address_2: street2,
            city: city,
            state: stateCode,
            postcode: pincode,
            country: countryCode,
          },
        });
      } catch (restErr) {
        console.log('REST API shipping sync note:', restErr.message);
      }

      // Post to WooCommerce shipping endpoint with auto-recovery
      let getRes = await fetch(`${WP_SITE_URL}/my-account/edit-address/shipping/`, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': USER_AGENT,
          'Referer': `${WP_SITE_URL}/my-account/edit-address/`,
          'Cookie': authCookies,
        },
      });

      let pageHtml = await getRes.text();
      let hiddenFields = extractHiddenFields(pageHtml);
      let nonce =
        hiddenFields['woocommerce-edit-address-nonce'] ||
        extractInputValue(pageHtml, 'woocommerce-edit-address-nonce') ||
        hiddenFields['_wpnonce'];

      if (!nonce && pwd) {
        console.log('Session expired during shipping sync, re-authenticating...');
        authCookies = await getAuthenticatedWordPressCookies({ ...user, password: pwd });
        getRes = await fetch(`${WP_SITE_URL}/my-account/edit-address/shipping/`, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': USER_AGENT,
            'Referer': `${WP_SITE_URL}/my-account/edit-address/`,
            'Cookie': authCookies,
          },
        });
        pageHtml = await getRes.text();
        hiddenFields = extractHiddenFields(pageHtml);
        nonce =
          hiddenFields['woocommerce-edit-address-nonce'] ||
          extractInputValue(pageHtml, 'woocommerce-edit-address-nonce') ||
          hiddenFields['_wpnonce'];
      }

      const postParams = new URLSearchParams();
      for (const [hk, hv] of Object.entries(hiddenFields)) {
        postParams.append(hk, hv);
      }
      postParams.set('shipping_first_name', firstName);
      postParams.set('shipping_last_name', lastName);
      postParams.set('shipping_company', '');
      postParams.set('shipping_country', countryCode);
      postParams.set('shipping_address_1', street);
      postParams.set('shipping_address_2', street2);
      postParams.set('shipping_city', city);
      postParams.set('shipping_state', stateCode);
      postParams.set('shipping_postcode', pincode);
      postParams.set('action', 'edit_address');
      postParams.set('save_address', 'Save address');
      postParams.set('_wp_http_referer', '/my-account/edit-address/shipping/');
      if (nonce) {
        postParams.set('woocommerce-edit-address-nonce', nonce);
      }

      const postRes = await fetch(`${WP_SITE_URL}/my-account/edit-address/shipping/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': USER_AGENT,
          'Referer': `${WP_SITE_URL}/my-account/edit-address/shipping/`,
          'Origin': WP_SITE_URL,
          'Cookie': authCookies,
        },
        body: postParams.toString(),
      });

      const postCookies = extractCookiesFromResponse(postRes);
      if (postCookies && emailKey) {
        authCookies = cleanCookieString([authCookies, postCookies]);
        await AsyncStorage.setItem(`@whiteswan_cookies_${emailKey}`, authCookies);
        setUser((prev) => (prev ? { ...prev, wpCookies: authCookies } : prev));
      }

      console.log('WordPress shipping address sync status:', postRes.status);
      return postRes.ok || postRes.status === 302;
    } catch (e) {
      console.log('syncShippingAddress error:', e.message);
      return false;
    }
  };

  /**
   * Update Account Details & Password on WooCommerce (/my-account/edit-account/)
   */
  const updateAccountDetails = async ({
    firstName,
    lastName,
    displayName,
    email,
    currentPassword,
    newPassword,
    confirmPassword,
  }) => {
    if (!user) return false;
    try {
      const emailKey = user.email ? user.email.toLowerCase() : '';
      let pwd = user.password;
      if (!pwd && emailKey) {
        try {
          pwd = await AsyncStorage.getItem(`@whiteswan_pwd_${emailKey}`);
        } catch (e) {}
      }

      let authCookies = await getAuthenticatedWordPressCookies(user);

      const targetFirst = firstName || user.firstName || '';
      const targetLast = lastName || user.lastName || '';
      const targetDisplay = displayName || `${targetFirst} ${targetLast}`.trim() || user.name || 'Member';
      const targetEmail = email || user.email || '';

      // Validate password inputs if newPassword is provided
      if (newPassword) {
        if (!currentPassword) {
          throw new Error('Please enter your current password.');
        }
        if (confirmPassword && newPassword !== confirmPassword) {
          throw new Error('New passwords do not match.');
        }
      }

      // 1. Fetch WooCommerce edit-account form to obtain fresh nonces and hidden fields
      let getRes = await fetch(`${WP_SITE_URL}/my-account/edit-account/`, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': USER_AGENT,
          'Referer': `${WP_SITE_URL}/my-account/`,
          'Cookie': authCookies,
        },
      });

      let pageHtml = await getRes.text();
      let hiddenFields = extractHiddenFields(pageHtml);
      let nonce =
        hiddenFields['save-account-details-nonce'] ||
        extractInputValue(pageHtml, 'save-account-details-nonce') ||
        hiddenFields['_wpnonce'];

      if (!nonce && (currentPassword || pwd)) {
        console.log('Session expired during account sync, re-authenticating...');
        authCookies = await getAuthenticatedWordPressCookies({ ...user, password: currentPassword || pwd });
        getRes = await fetch(`${WP_SITE_URL}/my-account/edit-account/`, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': USER_AGENT,
            'Referer': `${WP_SITE_URL}/my-account/`,
            'Cookie': authCookies,
          },
        });
        pageHtml = await getRes.text();
        hiddenFields = extractHiddenFields(pageHtml);
        nonce =
          hiddenFields['save-account-details-nonce'] ||
          extractInputValue(pageHtml, 'save-account-details-nonce') ||
          hiddenFields['_wpnonce'];
      }

      const postParams = new URLSearchParams();
      for (const [hk, hv] of Object.entries(hiddenFields)) {
        postParams.append(hk, hv);
      }
      postParams.set('account_first_name', targetFirst);
      postParams.set('account_last_name', targetLast);
      postParams.set('account_display_name', targetDisplay);
      postParams.set('account_email', targetEmail);
      if (currentPassword && newPassword) {
        postParams.set('password_current', currentPassword);
        postParams.set('password_1', newPassword);
        postParams.set('password_2', confirmPassword || newPassword);
      }
      postParams.set('action', 'save_account_details');
      postParams.set('save_account_details', 'Save changes');
      postParams.set('_wp_http_referer', '/my-account/edit-account/');
      if (nonce) {
        postParams.set('save-account-details-nonce', nonce);
      }

      const postRes = await fetch(`${WP_SITE_URL}/my-account/edit-account/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': USER_AGENT,
          'Referer': `${WP_SITE_URL}/my-account/edit-account/`,
          'Origin': WP_SITE_URL,
          'Cookie': authCookies,
        },
        body: postParams.toString(),
      });

      const postHtml = await postRes.text();

      // Check for errors returned by WordPress/WooCommerce notice wrapper
      const errorMatch =
        postHtml.match(/<ul class=["']woocommerce-error["'][^>]*>([\s\S]*?)<\/ul>/i) ||
        postHtml.match(/<div class=["']woocommerce-error["'][^>]*>([\s\S]*?)<\/div>/i) ||
        postHtml.match(/<div class=["']woocommerce-NoticeGroup woocommerce-NoticeGroup-error["'][^>]*>([\s\S]*?)<\/div>/i);
      
      if (errorMatch) {
        const errorText = errorMatch[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&#039;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim();
        if (errorText) {
          throw new Error(errorText);
        }
      }

      // Update cookies if WordPress returned new auth cookies (e.g. after password change)
      const resCookies = extractCookiesFromResponse(postRes);
      const updatedCookies = cleanCookieString([authCookies, resCookies]);

      const oldEmailKey = emailKey;
      const newEmailKey = targetEmail.toLowerCase();

      if (updatedCookies) {
        if (newEmailKey) {
          await AsyncStorage.setItem(`@whiteswan_cookies_${newEmailKey}`, updatedCookies);
        }
        if (oldEmailKey && oldEmailKey !== newEmailKey) {
          await AsyncStorage.removeItem(`@whiteswan_cookies_${oldEmailKey}`).catch(() => {});
        }
      }

      if (newPassword) {
        if (newEmailKey) {
          await AsyncStorage.setItem(`@whiteswan_pwd_${newEmailKey}`, newPassword);
        }
        if (oldEmailKey && oldEmailKey !== newEmailKey) {
          await AsyncStorage.removeItem(`@whiteswan_pwd_${oldEmailKey}`).catch(() => {});
        }
      } else if (pwd && oldEmailKey && newEmailKey && oldEmailKey !== newEmailKey) {
        await AsyncStorage.setItem(`@whiteswan_pwd_${newEmailKey}`, pwd);
        await AsyncStorage.removeItem(`@whiteswan_pwd_${oldEmailKey}`).catch(() => {});
      }

      // Migrate billing address key if email changed
      if (oldEmailKey && newEmailKey && oldEmailKey !== newEmailKey) {
        try {
          const oldAddr = await AsyncStorage.getItem(`@whiteswan_address_${oldEmailKey}`);
          if (oldAddr) {
            await AsyncStorage.setItem(`@whiteswan_address_${newEmailKey}`, oldAddr);
            await AsyncStorage.removeItem(`@whiteswan_address_${oldEmailKey}`).catch(() => {});
          }
        } catch (e) {}
      }

      const updatedUser = {
        ...user,
        name: targetDisplay,
        firstName: targetFirst,
        lastName: targetLast,
        email: targetEmail,
        ...(newPassword ? { password: newPassword } : {}),
        ...(updatedCookies ? { wpCookies: updatedCookies } : {}),
      };

      await persistUserToMobileDatabase(updatedUser);
      setUser(updatedUser);

      // REST API: Update first_name, last_name, email & password in WooCommerce customer table
      try {
        const updatePayload = {
          first_name: targetFirst,
          last_name: targetLast,
          email: targetEmail,
        };
        if (newPassword) {
          updatePayload.password = newPassword;
        }
        await updateWcCustomer(targetEmail || user?.email || user?.id, updatePayload);
      } catch (restErr) {
        console.log('REST API account sync note:', restErr.message);
      }

      // Also update core WordPress profile via XML-RPC
      editWordPressProfileViaXmlRpc(updatedUser, {
        firstName: targetFirst,
        lastName: targetLast,
        displayName: targetDisplay,
      }).catch(() => {});

      return true;
    } catch (e) {
      console.log('updateAccountDetails error:', e.message);
      throw e;
    }
  };

  /**
   * Delete / Clear Billing Address
   */
  const deleteBillingAddress = async () => {
    const emailKey = user?.email ? user.email.toLowerCase() : '';
    if (emailKey) {
      try {
        await AsyncStorage.removeItem(`@whiteswan_address_${emailKey}`);
      } catch (e) {}
    }
    return await syncBillingAddress({
      street: '',
      street2: '',
      city: '',
      district: '',
      pincode: '',
      phone: '',
    });
  };

  /**
   * Delete / Clear Shipping Address
   */
  const deleteShippingAddress = async () => {
    const emailKey = user?.email ? user.email.toLowerCase() : '';
    if (emailKey) {
      try {
        await AsyncStorage.removeItem(`@whiteswan_shipping_${emailKey}`);
      } catch (e) {}
    }
    return await syncShippingAddress({
      street: '',
      street2: '',
      city: '',
      pincode: '',
    });
  };

  /**
   * Logout function
   */
  const logout = async () => {
    try {
      isLoggedOutRef.current = true;
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      setUser(null);
    } catch (e) {
      console.error('Failed to logout:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        loading,
        login,
        register,
        logout,
        updateProfile,
        syncWordPressData,
        refreshUserData,
        fetchUserOrders,
        syncBillingAddress,
        syncShippingAddress,
        deleteBillingAddress,
        deleteShippingAddress,
        updateAccountDetails,
        syncUserSubscription,
        fetchWcSubscriptions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

