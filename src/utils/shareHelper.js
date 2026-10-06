import { Share, Linking } from 'react-native';

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

  // Truncate to ~180 characters for optimal readability
  if (clean.length > 200) {
    return clean.slice(0, 195).trim() + '...';
  }
  return clean;
};

/**
 * Build rich share text including Title, Content summary, and Link
 */
export const buildWhatsAppShareText = (post) => {
  if (!post) return '';
  const title = post.title ? `*${post.title.trim()}*` : '*Whiteswan TV News*';
  const summary = getCleanSummary(post);
  const url = post.link || (post.id ? `https://whiteswantvnews.com/?p=${post.id}` : 'https://whiteswantvnews.com');

  let text = `${title}\n\n`;
  if (summary && summary.length > 10 && !summary.includes(post.title)) {
    text += `${summary}\n\n`;
  }
  text += `🔗 *കൂടുതൽ വായിക്കുക (Read Full Story):*\n${url}`;
  return text;
};

/**
 * Share article to WhatsApp (with content summary + direct link + rich preview)
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
 * Share article with Title + Summary + Live Link + Image Preview
 */
export const shareArticleWithImage = async (post) => {
  if (!post) return;

  const title = post.title || 'Whiteswan TV News';
  const url = post.link || (post.id ? `https://whiteswantvnews.com/?p=${post.id}` : 'https://whiteswantvnews.com');
  const shareMessage = buildWhatsAppShareText(post);

  try {
    await Share.share(
      {
        title,
        message: shareMessage,
        url,
      },
      {
        dialogTitle: `Share: ${title}`,
        subject: title,
      }
    );
  } catch (e) {
    console.error('Share error:', e);
  }
};

/**
 * Share article to Facebook
 */
export const shareToFacebook = async (post) => {
  if (!post) return;
  const url = post.link || (post.id ? `https://whiteswantvnews.com/?p=${post.id}` : 'https://whiteswantvnews.com');
  const fbAppUrl = `fb://facewebmodal/f?href=${encodeURIComponent(url)}`;
  const fbWebUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  try {
    const supported = await Linking.canOpenURL(fbAppUrl);
    if (supported) {
      await Linking.openURL(fbAppUrl);
      return;
    }
  } catch (e) {}

  try {
    const canOpenWeb = await Linking.canOpenURL(fbWebUrl);
    if (canOpenWeb) {
      await Linking.openURL(fbWebUrl);
      return;
    }
  } catch (e) {}

  await shareArticleWithImage(post);
};

/**
 * Share article to Twitter / X
 */
export const shareToTwitter = async (post) => {
  if (!post) return;
  const url = post.link || (post.id ? `https://whiteswantvnews.com/?p=${post.id}` : 'https://whiteswantvnews.com');
  const text = post.title ? post.title.trim() : 'Whiteswan TV News';
  const twitterAppUrl = `twitter://post?message=${encodeURIComponent(`${text}\n${url}`)}`;
  const twitterWebUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  try {
    const supported = await Linking.canOpenURL(twitterAppUrl);
    if (supported) {
      await Linking.openURL(twitterAppUrl);
      return;
    }
  } catch (e) {}

  try {
    const canOpenWeb = await Linking.canOpenURL(twitterWebUrl);
    if (canOpenWeb) {
      await Linking.openURL(twitterWebUrl);
      return;
    }
  } catch (e) {}

  await shareArticleWithImage(post);
};
