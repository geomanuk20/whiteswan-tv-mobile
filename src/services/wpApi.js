import AsyncStorage from '@react-native-async-storage/async-storage';

const WP_BASE_URL = 'https://whiteswantvnews.com/wp-json/wp/v2';

// Standard browser headers to bypass Hostinger / CDN firewall 403 blocks
const HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  'Referer': 'https://whiteswantvnews.com/',
  'Origin': 'https://whiteswantvnews.com',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

// Auto-purge legacy cached posts on startup so fresh WordPress settings take effect immediately
(async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const oldPostKeys = keys.filter(
      (k) => k.startsWith('@wp_posts_') && !k.startsWith('@wp_posts_v6_')
    );
    if (oldPostKeys.length > 0) {
      await AsyncStorage.multiRemove(oldPostKeys);
    }
  } catch (e) {}
})();

// Helper: Decode basic HTML entities commonly found in WP titles
export const decodeHtmlEntities = (text) => {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, '’')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&hellip;/g, '...')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '') // strip HTML tags
    .trim();
};

export const timeAgo = (dateString) => {
  try {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return past.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch (e) {
    return '';
  }
};

export const DEFAULT_NEWS_IMAGE = 'https://whiteswantvnews.com/wp-content/uploads/2025/12/download.png';

/**
 * Normalizes image URLs for cross-platform mobile compatibility.
 * Standard React Native Fresco lacks AVIF decoding support on many Android/iOS builds.
 * When an .avif image is encountered, route it through WordPress Photon CDN (i0.wp.com)
 * which instantly delivers a crisp, optimized JPEG to the device.
 */
export const normalizeImageUrl = (url) => {
  if (!url || typeof url !== 'string') return DEFAULT_NEWS_IMAGE;
  const clean = url.replace(/&amp;/g, '&').trim();
  if (!clean.startsWith('http')) return clean;

  if (clean.toLowerCase().includes('.avif')) {
    const withoutProtocol = clean.replace(/^https?:\/\//, '');
    return `https://i0.wp.com/${withoutProtocol}`;
  }

  return clean;
};

// Extract image URL from embedded media, Jetpack, SEO plugins, or content fallback
export const extractFeaturedImage = (post) => {
  if (!post) return DEFAULT_NEWS_IMAGE;

  try {
    // 1. Check embedded wp:featuredmedia
    if (
      post._embedded &&
      post._embedded['wp:featuredmedia'] &&
      Array.isArray(post._embedded['wp:featuredmedia']) &&
      post._embedded['wp:featuredmedia'][0]
    ) {
      const media = post._embedded['wp:featuredmedia'][0];
      if (media.source_url && typeof media.source_url === 'string' && media.source_url.startsWith('http')) {
        return normalizeImageUrl(media.source_url);
      }
      if (media.media_details && media.media_details.sizes) {
        const sizes = media.media_details.sizes;
        const candidate =
          sizes.full?.source_url ||
          sizes.large?.source_url ||
          sizes.medium_large?.source_url ||
          sizes.woocommerce_single?.source_url ||
          sizes.medium?.source_url ||
          sizes.thumbnail?.source_url;
        if (candidate && typeof candidate === 'string' && candidate.startsWith('http')) {
          return normalizeImageUrl(candidate);
        }
      }
    }
  } catch (e) {}

  // 2. Direct post properties from Jetpack, REST plugins or WP themes
  if (post.jetpack_featured_media_url && typeof post.jetpack_featured_media_url === 'string' && post.jetpack_featured_media_url.startsWith('http')) {
    return normalizeImageUrl(post.jetpack_featured_media_url);
  }
  if (post.featured_media_src_url && typeof post.featured_media_src_url === 'string' && post.featured_media_src_url.startsWith('http')) {
    return normalizeImageUrl(post.featured_media_src_url);
  }
  if (post.featured_image_url && typeof post.featured_image_url === 'string' && post.featured_image_url.startsWith('http')) {
    return normalizeImageUrl(post.featured_image_url);
  }

  // 3. Check All in One SEO (AIOSEO) or Yoast OpenGraph image metadata
  try {
    const aioseoImg = post.aioseo_head_json?.['og:image'] || post.aioseo_head_json?.['twitter:image'];
    if (aioseoImg && typeof aioseoImg === 'string' && aioseoImg.startsWith('http')) {
      return normalizeImageUrl(aioseoImg);
    }
    const yoastImg =
      post.yoast_head_json?.og_image?.[0]?.url ||
      post.yoast_head_json?.schema?.['@graph']?.find((g) => g['@type'] === 'ImageObject')?.url;
    if (yoastImg && typeof yoastImg === 'string' && yoastImg.startsWith('http')) {
      return normalizeImageUrl(yoastImg);
    }
  } catch (e) {}

  // 4. Fallback: look for <img src="..." /> inside content.rendered
  if (post.content && post.content.rendered) {
    const match = post.content.rendered.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match && match[1] && match[1].startsWith('http')) {
      return normalizeImageUrl(match[1]);
    }
  }

  // 5. Fallback default news placeholder image
  return DEFAULT_NEWS_IMAGE;
};

// Formatter to standardize post objects
export const formatPost = (post) => {
  if (!post) return null;

  let categories = [];
  try {
    if (post._embedded && post._embedded['wp:term'] && post._embedded['wp:term'][0]) {
      categories = post._embedded['wp:term'][0].map((term) => ({
        id: term.id,
        name: decodeHtmlEntities(term.name),
        slug: term.slug,
      }));
    } else if (Array.isArray(post.categories)) {
      categories = post.categories.map((cat) => {
        if (typeof cat === 'object' && cat !== null) {
          return {
            id: cat.id,
            name: decodeHtmlEntities(cat.name || ''),
            slug: cat.slug || '',
          };
        }
        return {
          id: cat,
          name: cat === 19807 ? 'Premium' : cat === 18314 ? 'Whiteswan Exclusive' : '',
          slug: cat === 19807 ? 'premiums' : cat === 18314 ? 'whiteswan-exclusive' : '',
        };
      });
    }
  } catch (e) {
    categories = [];
  }

  const categoryIds = Array.isArray(post.categories)
    ? post.categories.map((c) => (typeof c === 'object' && c !== null ? c.id : c))
    : categories.map((c) => c.id);

  let authorName = 'Whiteswan Desk';
  let authorAvatar = 'https://ui-avatars.com/api/?name=Whiteswan+Desk&background=00A3E8&color=fff&bold=true';
  try {
    if (
      post._embedded &&
      post._embedded['author'] &&
      post._embedded['author'][0]
    ) {
      const authorObj = post._embedded['author'][0];
      if (authorObj.name) {
        authorName = decodeHtmlEntities(authorObj.name);
      }
      if (authorObj.avatar_urls) {
        authorAvatar = authorObj.avatar_urls['96'] || authorObj.avatar_urls['48'] || authorObj.avatar_urls['24'];
      } else {
        authorAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=00A3E8&color=fff&bold=true`;
      }
    } else {
      authorAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=00A3E8&color=fff&bold=true`;
    }
  } catch (e) {
    authorName = 'Whiteswan Desk';
    authorAvatar = 'https://ui-avatars.com/api/?name=Whiteswan+Desk&background=00A3E8&color=fff&bold=true';
  }

  // Determine if post is genuinely paywalled / locked by WordPress (wsbn-premium-gate or Paid Member Subscriptions)
  const isWordPressRestricted =
    post.is_premium === true ||
    post.wsbn_is_premium === true ||
    post.wsbn_paywall?.is_premium === true ||
    post.wsbn_paywall?.is_locked === true ||
    post.meta?.is_premium === true ||
    post.meta?.wsbn_is_premium === true ||
    post.meta?.wsbn_paywalled === true ||
    post.meta?.pms_is_post_restricted === '1' ||
    post.meta?.pms_is_post_restricted === true ||
    (Array.isArray(post.meta?._members_access_role) && post.meta._members_access_role.length > 0) ||
    (typeof post.meta?._members_access_error === 'string' && post.meta._members_access_error.trim().length > 0) ||
    post.content?.protected === true ||
    (post.content?.rendered &&
      (post.content.rendered.includes('wsbn-premium-blur-wrapper') ||
        post.content.rendered.includes('wsbn-premium-overlay') ||
        post.content.rendered.includes('wsbn-locked-content') ||
        post.content.rendered.includes('wsbn-paywall') ||
        post.content.rendered.includes('pms-locked-content') ||
        post.content.rendered.includes('pms_paywall') ||
        post.content.rendered.includes('pms-paywall') ||
        post.content.rendered.includes('restricted-content') ||
        post.content.rendered.includes('ihc-hide-content') ||
        post.content.rendered.includes('wpmem_logged_in') ||
        post.content.rendered.includes('members-access-error')));

  const isPremium = !!isWordPressRestricted;

  const authorId = post.author || (post._embedded?.['author']?.[0]?.id ? Number(post._embedded['author'][0].id) : null);
  const authorSlug = post._embedded?.['author']?.[0]?.slug || '';
  const authorDescription = post._embedded?.['author']?.[0]?.description || '';

  return {
    id: post.id,
    title: decodeHtmlEntities(post.title ? post.title.rendered : ''),
    rawTitle: post.title ? post.title.rendered : '',
    excerpt: decodeHtmlEntities(post.excerpt ? post.excerpt.rendered : ''),
    content: post.content ? post.content.rendered : '',
    featuredImage: extractFeaturedImage(post),
    date: post.date,
    timeAgo: timeAgo(post.date),
    link: post.link,
    authorId,
    authorSlug,
    authorName,
    authorAvatar,
    authorDescription,
    categories,
    categoryName: categories.find((c) => c.name && c.name.trim().length > 0)?.name || 'News',
    isPremium: !!isPremium,
  };
};

/**
 * Fetch latest posts with pagination, category filter, author filter and search
 */
export const fetchPosts = async ({
  page = 1,
  perPage = 10,
  categoryId = null,
  authorId = null,
  search = null,
  bypassCache = true,
} = {}) => {
  const cacheKey = `@wp_posts_v6_c${categoryId || 'all'}_a${authorId || 'all'}_p${page}`;

  try {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      _embed: '1',
      status: 'publish',
    });

    if (categoryId) {
      params.append('categories', categoryId.toString());
    }

    if (authorId) {
      params.append('author', authorId.toString());
    }

    if (search && search.trim().length > 0) {
      params.append('search', search.trim());
    }

    if (bypassCache) {
      params.append('_t', Date.now().toString());
    }

    const response = await fetch(`${WP_BASE_URL}/posts?${params.toString()}`, {
      headers: HEADERS,
    });

    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }

    const totalPages = parseInt(response.headers.get('x-wp-totalpages') || '1', 10);
    const totalPosts = parseInt(response.headers.get('x-wp-total') || '0', 10);
    const rawPosts = await response.json();
    const formatted = rawPosts.map(formatPost).filter(Boolean);

    const result = {
      posts: formatted,
      totalPages,
      totalPosts,
    };

    // Cache initial page
    if (page === 1 && !search && !authorId) {
      AsyncStorage.setItem(cacheKey, JSON.stringify(result)).catch(() => {});
    }

    return result;
  } catch (error) {
    console.error('Error fetching posts:', error);

    // Try reading from cache on failure
    if (page === 1 && !search && !authorId) {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (cacheErr) {}
    }

    return { posts: [], totalPages: 1, totalPosts: 0 };
  }
};

/**
 * Fetch author details by author ID or slug
 */
export const fetchAuthorDetails = async (authorIdOrSlug) => {
  if (!authorIdOrSlug) return null;
  try {
    const isId = /^\d+$/.test(String(authorIdOrSlug));
    const url = isId
      ? `${WP_BASE_URL}/users/${authorIdOrSlug}`
      : `${WP_BASE_URL}/users?slug=${encodeURIComponent(authorIdOrSlug)}`;

    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    const userObj = Array.isArray(data) ? data[0] : data;
    if (!userObj) return null;

    const name = decodeHtmlEntities(userObj.name || 'Whiteswan Reporter');
    let avatar = userObj.avatar_urls?.['96'] || userObj.avatar_urls?.['48'] || userObj.avatar_urls?.['24'] || '';
    if (avatar) avatar = normalizeImageUrl(avatar);
    else avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00A3E8&color=fff&bold=true`;

    let role = 'News Editor';
    if (userObj.roles && Array.isArray(userObj.roles) && userObj.roles.length > 0) {
      const primaryRole = userObj.roles[0].toLowerCase();
      if (primaryRole === 'administrator') role = 'Administrator';
      else if (primaryRole === 'editor') role = 'News Editor';
      else if (primaryRole === 'author') role = 'Author';
      else if (primaryRole === 'contributor') role = 'Contributor';
      else role = primaryRole.charAt(0).toUpperCase() + primaryRole.slice(1);
    } else if (userObj.role) {
      role = String(userObj.role);
    }

    return {
      id: userObj.id,
      name,
      slug: userObj.slug || '',
      role,
      description: decodeHtmlEntities(userObj.description || ''),
      avatar,
      link: userObj.link || '',
    };
  } catch (e) {
    return null;
  }
};

/**
 * Fetch all posts by a specific author
 */
export const fetchAuthorPosts = async ({ authorId, page = 1, perPage = 10, bypassCache = true }) => {
  return fetchPosts({ page, perPage, authorId, bypassCache });
};

/**
 * Fetch a single post by ID with full details (always live with cache-buster)
 */
export const fetchPostById = async (id, { bypassCache = true } = {}) => {
  try {
    const ts = bypassCache ? `&_t=${Date.now()}` : '';
    const response = await fetch(`${WP_BASE_URL}/posts/${id}?_embed=1${ts}`, {
      headers: HEADERS,
    });

    if (!response.ok) {
      throw new Error(`Failed to load post ${id}: ${response.status}`);
    }

    const rawPost = await response.json();
    return formatPost(rawPost);
  } catch (error) {
    console.error(`Error fetching post ${id}:`, error);
    throw error;
  }
};

/**
 * Fetch a single post by slug with full details
 */
export const fetchPostBySlug = async (slug, { bypassCache = true } = {}) => {
  if (!slug) return null;
  try {
    const raw = String(slug).replace(/^\/+|\/+$/g, '');
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch (_) {}

    const cleanSlug = encodeURIComponent(decoded);
    const ts = bypassCache ? `&_t=${Date.now()}` : '';

    // 1. Try with properly encoded slug
    let response = await fetch(`${WP_BASE_URL}/posts?slug=${cleanSlug}&_embed=1${ts}`, {
      headers: HEADERS,
    });

    if (response.ok) {
      const rawPosts = await response.json();
      if (Array.isArray(rawPosts) && rawPosts.length > 0) {
        return formatPost(rawPosts[0]);
      }
    }

    // 2. If raw differs from cleanSlug, try raw
    if (raw !== cleanSlug) {
      response = await fetch(`${WP_BASE_URL}/posts?slug=${raw}&_embed=1${ts}`, {
        headers: HEADERS,
      });
      if (response.ok) {
        const rawPosts = await response.json();
        if (Array.isArray(rawPosts) && rawPosts.length > 0) {
          return formatPost(rawPosts[0]);
        }
      }
    }

    // 3. Fallback: search by decoded text/title
    if (decoded && decoded.length > 3) {
      response = await fetch(`${WP_BASE_URL}/posts?search=${encodeURIComponent(decoded)}&per_page=3&_embed=1${ts}`, {
        headers: HEADERS,
      });
      if (response.ok) {
        const rawPosts = await response.json();
        if (Array.isArray(rawPosts) && rawPosts.length > 0) {
          return formatPost(rawPosts[0]);
        }
      }
    }

    return null;
  } catch (error) {
    console.error(`Error fetching post by slug ${slug}:`, error);
    return null;
  }
};

/**
 * Helper: Check if post was published today (same calendar date or within 24 hours)
 */
export const isPostFromToday = (dateString) => {
  if (!dateString) return false;
  try {
    const postDate = new Date(dateString);
    const now = new Date();

    // Check same calendar day (local time)
    const isSameDay =
      postDate.getFullYear() === now.getFullYear() &&
      postDate.getMonth() === now.getMonth() &&
      postDate.getDate() === now.getDate();

    // Or published within the last 18 hours
    const diffHours = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60);

    return isSameDay || (diffHours >= 0 && diffHours <= 18);
  } catch (e) {
    return false;
  }
};

/**
 * Fetch breaking news ticker posts - Strictly today's news only
 */
export const fetchBreakingNews = async (limit = 10) => {
  try {
    // 1. Fetch latest news posts and category 70 breaking posts
    const [latestRes, categoryRes] = await Promise.all([
      fetchPosts({ page: 1, perPage: 15 }),
      fetchPosts({ page: 1, perPage: 15, categoryId: 70 }).catch(() => ({ posts: [] })),
    ]);

    const combined = [...(categoryRes.posts || []), ...(latestRes.posts || [])];

    // Remove duplicates by id
    const uniqueMap = new Map();
    combined.forEach((p) => {
      if (p && p.id && !uniqueMap.has(p.id)) {
        uniqueMap.set(p.id, p);
      }
    });

    const allPosts = Array.from(uniqueMap.values());

    // Filter strictly for TODAY'S news only
    const todayBreaking = allPosts.filter((p) => isPostFromToday(p.date));

    // Sort by latest publication time
    todayBreaking.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (todayBreaking.length > 0) {
      return todayBreaking.slice(0, limit);
    }

    // Fallback: If midnight / early morning, return the freshest recent posts within 24h
    const within24h = allPosts.filter((p) => {
      const diffHours = (Date.now() - new Date(p.date).getTime()) / (1000 * 60 * 60);
      return diffHours >= 0 && diffHours <= 24;
    });

    within24h.sort((a, b) => new Date(b.date) - new Date(a.date));
    return within24h.slice(0, limit);
  } catch (error) {
    console.error('Error fetching breaking news:', error);
    return [];
  }
};

/**
 * Fetch categories list from WordPress
 */
export const fetchCategories = async () => {
  try {
    const response = await fetch(`${WP_BASE_URL}/categories?per_page=50&hide_empty=true`, {
      headers: HEADERS,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.status}`);
    }

    const categories = await response.json();
    return categories.map((cat) => ({
      id: cat.id,
      name: decodeHtmlEntities(cat.name),
      slug: cat.slug,
      count: cat.count,
    }));
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
};

/**
 * Fetch static WordPress page by slug (e.g. privacy-policy, refund-policy, terms-of-service, advertise-with-us)
 */
export const fetchPageBySlug = async (slug) => {
  try {
    const response = await fetch(`${WP_BASE_URL}/pages?slug=${slug}&_embed=1`, {
      headers: HEADERS,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status}`);
    }

    const pages = await response.json();
    if (pages && pages.length > 0) {
      const p = pages[0];
      return {
        id: p.id,
        slug: p.slug,
        title: decodeHtmlEntities(p.title ? p.title.rendered : ''),
        content: p.content ? p.content.rendered : '',
        date: p.date,
        link: p.link,
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching page ${slug}:`, error);
    return null;
  }
};

