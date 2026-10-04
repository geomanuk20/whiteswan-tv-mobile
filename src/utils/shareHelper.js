import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Share, Linking, Platform } from 'react-native';
import { normalizeImageUrl } from '../services/wpApi';

/**
 * Extract clean readable summary text from post excerpt or content
 */
export const getCleanSummary = (post) => {
  if (!post) return '';
  let raw = '';
  if (post.excerpt) {
    raw = post.excerpt;
  } else if (post.content) {
    raw = post.content;
  }

  // Strip all HTML tags, linebreaks, and encoded HTML entities
  const clean = String(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\[&hellip;\]|\[\.\.\.\]|&hellip;|\.\.\./g, '...')
    .replace(/\s+/g, ' ')
    .trim();

  // Truncate to ~180 characters for optimal WhatsApp readability
  if (clean.length > 200) {
    return clean.slice(0, 195).trim() + '...';
  }
  return clean;
};

/**
 * Build rich WhatsApp share text including Title, Content summary, and Link
 */
export const buildWhatsAppShareText = (post) => {
  if (!post) return '';
  const title = post.title ? `*${post.title.trim()}*` : '*Whiteswan TV News*';
  const summary = getCleanSummary(post);
  const url = post.link || 'https://whiteswantvnews.com';

  if (summary && summary.length > 10 && !summary.includes(post.title)) {
    return `${title}\n\n${summary}\n\n🔗 *കൂടുതൽ വായിക്കുക (Read Full Story):*\n${url}`;
  }

  return `${title}\n\n🔗 *കൂടുതൽ വായിക്കുക (Read Full Story):*\n${url}`;
};

/**
 * Share article to WhatsApp (with content summary + direct link + image fallback)
 */
export const shareToWhatsApp = async (post) => {
  if (!post) return;

  const shareText = buildWhatsAppShareText(post);
  const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareText)}`;

  try {
    const supported = await Linking.canOpenURL(whatsappUrl);
    if (supported) {
      await Linking.openURL(whatsappUrl);
      return;
    }
  } catch (e) {}

  // Fallback to web WhatsApp URL scheme
  try {
    const webWhatsApp = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    const webSupported = await Linking.canOpenURL(webWhatsApp);
    if (webSupported) {
      await Linking.openURL(webWhatsApp);
      return;
    }
  } catch (e) {}

  // Fallback to native system share
  await shareArticleWithImage(post);
};

/**
 * Share article with high-quality news image attached (WhatsApp, Telegram, etc.)
 */
export const shareArticleWithImage = async (post) => {
  if (!post) return;

  const title = post.title || 'Whiteswan TV News';
  const url = post.link || 'https://whiteswantvnews.com';
  const shareMessage = buildWhatsAppShareText(post);

  let localFileUri = null;

  try {
    const rawImage =
      post.featuredImage ||
      'https://whiteswantvnews.com/wp-content/uploads/2025/12/download.png';
    const validImageUrl = normalizeImageUrl(rawImage);

    if (
      validImageUrl &&
      typeof validImageUrl === 'string' &&
      validImageUrl.startsWith('http')
    ) {
      const sanitizedId = String(post.id || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `news_${sanitizedId}_share.jpg`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        const downloadRes = await FileSystem.downloadAsync(validImageUrl, fileUri);
        if (downloadRes.status === 200) {
          localFileUri = downloadRes.uri;
        }
      } else {
        localFileUri = fileUri;
      }
    }
  } catch (err) {
    console.log('Image download for share error:', err.message);
  }

  // If local image is cached and expo-sharing is available, share image directly
  if (localFileUri && (await Sharing.isAvailableAsync())) {
    try {
      await Sharing.shareAsync(localFileUri, {
        mimeType: 'image/jpeg',
        dialogTitle: title,
        UTI: 'public.jpeg',
      });
      return;
    } catch (shareErr) {
      console.log('Sharing.shareAsync fallback:', shareErr.message);
    }
  }

  // Standard fallback
  try {
    await Share.share({
      title,
      message: shareMessage,
      url,
    });
  } catch (e) {
    console.error('Standard share error:', e);
  }
};
