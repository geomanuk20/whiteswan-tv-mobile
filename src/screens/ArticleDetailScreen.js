import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  Share,
  useWindowDimensions,
  Linking,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HtmlReader } from '../components/HtmlReader';
import { useTheme } from '../context/ThemeContext';
import { useBookmarks } from '../context/BookmarkContext';
import { useAuth } from '../context/AuthContext';
import { NewsCard } from '../components/NewsCard';
import { CommentSection } from '../components/CommentSection';
import { fetchPostById, fetchPostBySlug, fetchPosts, fetchAuthorPosts } from '../services/wpApi';
import { shareArticleWithImage, shareToWhatsApp } from '../utils/shareHelper';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const ArticleDetailScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { post: initialPost, postId, slug, postUrl } = route.params || {};
  const { colors, isDarkMode } = useTheme();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const { user, isLoggedIn } = useAuth();
  const { width } = useWindowDimensions();

  const targetPostId = initialPost?.id || (postId ? parseInt(postId, 10) : null);
  const [post, setPost] = useState(initialPost || (targetPostId ? { id: targetPostId } : null));
  const [loading, setLoading] = useState(!initialPost);
  const [fontSizeOffset, setFontSizeOffset] = useState(0); // -2, 0, +2, +4
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [authorPosts, setAuthorPosts] = useState([]);
  const [imgError, setImgError] = useState(false);

  const isVipUser = !!(
    user?.isPremium ||
    user?.role === 'Premium VIP' ||
    user?.role === 'administrator' ||
    user?.is_vip ||
    user?.subscription_status === 'active'
  );
  const bookmarked = post?.id ? isBookmarked(post.id) : false;

  // Fetch complete details, related posts, and author posts
  useEffect(() => {
    if (targetPostId || slug || postUrl) {
      loadFullDetails();
    }
  }, [targetPostId, slug, postUrl]);

  const loadFullDetails = async () => {
    try {
      setLoading(true);
      let fullPost = null;
      if (targetPostId) {
        fullPost = await fetchPostById(targetPostId);
      } else if (slug) {
        fullPost = await fetchPostBySlug(slug);
      } else if (postUrl) {
        // Extract slug from URL
        const clean = postUrl.split('?')[0].split('#')[0].replace(/\/+$/, '');
        const extractedSlug = clean.split('/').pop();
        if (extractedSlug) {
          fullPost = await fetchPostBySlug(extractedSlug);
        }
      }

      if (fullPost) {
        setPost(fullPost);
      }

      const activeAuthorId = fullPost?.authorId || post?.authorId;
      const catId = (fullPost?.categories || post?.categories)?.[0]?.id || null;

      // Parallel fetch related posts and author posts
      const [relatedRes, authorRes] = await Promise.allSettled([
        fetchPosts({ page: 1, perPage: 4, categoryId: catId }),
        activeAuthorId ? fetchAuthorPosts({ authorId: activeAuthorId, page: 1, perPage: 4 }) : Promise.resolve(null),
      ]);

      if (relatedRes.status === 'fulfilled' && relatedRes.value?.posts) {
        setRelatedPosts(relatedRes.value.posts.filter((p) => p.id !== (fullPost?.id || post?.id)));
      }

      if (authorRes.status === 'fulfilled' && authorRes.value?.posts) {
        setAuthorPosts(authorRes.value.posts.filter((p) => p.id !== (fullPost?.id || post?.id)).slice(0, 3));
      }
    } catch (e) {
      console.error('Error fetching full post:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorPress = () => {
    navigation.push('Author', {
      authorId: post.authorId,
      authorSlug: post.authorSlug,
      authorName: post.authorName,
      authorAvatar: post.authorAvatar,
      authorRole: 'News Editor',
      authorDescription: post.authorDescription,
    });
  };

  const handleShare = async () => {
    await shareArticleWithImage(post);
  };

  const handleWhatsAppShare = async () => {
    await shareToWhatsApp(post);
  };

  const getPreviewHtml = () => {
    if (post.content) {
      const paragraphs = post.content.match(/<p[\s\S]*?<\/p>/gi);
      if (paragraphs && paragraphs.length > 0) {
        return paragraphs.slice(0, 2).join('');
      }
      return `<p>${post.content.slice(0, 450)}</p>`;
    }
    if (post.excerpt) {
      const cleanExcerpt = post.excerpt
        .replace(/\[&hellip;\]|\[\.\.\.\]|&hellip;|\.\.\./g, '')
        .trim();
      return `<p>${cleanExcerpt}</p><p>ഈ വാർത്തയുടെ കൂടുതൽ വിശദാംശങ്ങളും വിശകലനങ്ങളും തുടർന്ന് വായിക്കുന്നതിനായി...</p>`;
    }
    return '<p>Exclusive investigative report from Whiteswan TV News.</p>';
  };

  const isSmall = width < 360;
  const isTablet = width >= 768;
  const imageHeight = isTablet ? 360 : Math.max(200, Math.min(width * 0.58, 280));
  const baseFontSize = (isSmall ? 15 : isTablet ? 18 : 16) + fontSizeOffset;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Navigation Top Bar */}
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
          style={styles.navButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.navActions}>
          {/* Font Size Adjusters */}
          <View style={[styles.fontControls, { backgroundColor: colors.inputBg }]}>
            <TouchableOpacity
              onPress={() => setFontSizeOffset((prev) => Math.max(prev - 2, -4))}
              style={styles.fontBtn}
              activeOpacity={0.7}
            >
              <Text style={[styles.fontBtnText, { color: colors.text }]}>A-</Text>
            </TouchableOpacity>
            <View style={[styles.fontDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              onPress={() => setFontSizeOffset((prev) => Math.min(prev + 2, 8))}
              style={styles.fontBtn}
              activeOpacity={0.7}
            >
              <Text style={[styles.fontBtnText, { color: colors.text }]}>A+</Text>
            </TouchableOpacity>
          </View>

          {/* Bookmark */}
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.inputBg }]}
            onPress={() => toggleBookmark(post, navigation)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={bookmarked ? COLORS.primary : colors.text}
            />
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.inputBg }]}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Ionicons name="share-social-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, isTablet && styles.tabletContent]}
      >
        {/* Featured Image */}
        <View style={[styles.imageContainer, { height: imageHeight }]}>
          <Image
            source={{
              uri:
                !imgError && post.featuredImage && typeof post.featuredImage === 'string' && post.featuredImage.startsWith('http')
                  ? post.featuredImage
                  : 'https://whiteswantvnews.com/wp-content/uploads/2025/12/download.png',
            }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
          <View
            style={[
              styles.categoryBadge,
              post.isPremium && { backgroundColor: COLORS.primary },
            ]}
          >
            <Text style={styles.categoryBadgeText}>
              {post.isPremium ? 'PREMIUM' : post.categoryName}
            </Text>
          </View>
        </View>

        {/* Content Wrapper */}
        <View style={styles.contentPadding}>
          {/* Headline */}
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
                fontSize: isSmall ? 18 : isTablet ? 25 : 21,
                lineHeight: isSmall ? 25 : isTablet ? 34 : 29,
              },
            ]}
          >
            {post.title}
          </Text>

          {/* Meta Information */}
          <View style={[styles.metaContainer, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={styles.authorBadge}
              onPress={handleAuthorPress}
              activeOpacity={0.7}
            >
              <Image
                source={{
                  uri:
                    post.authorAvatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName || 'Whiteswan Desk')}&background=00A3E8&color=fff&bold=true`,
                }}
                style={styles.authorAvatar}
              />
              <Text style={[styles.authorName, { color: colors.text }]}>
                {post.authorName || 'Whiteswan Desk'}
              </Text>
              <Ionicons name="chevron-forward" size={13} color={colors.textSecondary} style={{ marginLeft: -2 }} />
            </TouchableOpacity>

            <View style={styles.dateBadge}>
              <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                {post.timeAgo}
              </Text>
            </View>
          </View>

          {/* Quick Social Share Bar */}
          <View style={[styles.shareBar, { backgroundColor: colors.inputBg }]}>
            <Text style={[styles.shareBarLabel, { color: colors.textSecondary }]}>
              Share:
            </Text>

            <TouchableOpacity
              style={styles.whatsappBtn}
              onPress={handleWhatsAppShare}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
              <Text style={styles.whatsappBtnText}>WhatsApp</Text>
            </TouchableOpacity>
          </View>

          {/* HTML Article Content / Paywall Gating */}
          {post.isPremium && !isVipUser ? (
            /* --- Paywall Gate: Free / Guest Reader --- */
            <View style={styles.paywallWrapper}>
              {/* Preview 1st paragraph showing with blur fade overlay over the bottom lines */}
              <View style={styles.previewContainer}>
                <View style={styles.previewContent}>
                  <HtmlReader
                    html={getPreviewHtml()}
                    fontSize={baseFontSize}
                  />
                </View>
                {/* Smooth Fade / Blur Gradient Overlay into Background */}
                <LinearGradient
                  colors={[
                    isDarkMode ? 'rgba(0, 0, 0, 0)' : 'rgba(244, 248, 252, 0)',
                    isDarkMode ? 'rgba(0, 0, 0, 0.65)' : 'rgba(244, 248, 252, 0.75)',
                    isDarkMode ? 'rgba(0, 0, 0, 0.95)' : 'rgba(244, 248, 252, 0.95)',
                    isDarkMode ? '#000000' : '#F4F8FC',
                  ]}
                  style={styles.previewGradientOverlay}
                  pointerEvents="none"
                />
              </View>

              {/* Paywall Lock Card */}
              <View
                style={[
                  styles.paywallCard,
                  {
                    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                    borderColor: COLORS.primary,
                  },
                ]}
              >
                <View style={styles.paywallIconBadge}>
                  <Ionicons name="lock-closed" size={26} color={COLORS.primary} />
                </View>

                <View style={styles.paywallTagBadge}>
                  <Text style={styles.paywallTagText}>PREMIUM STORY</Text>
                </View>

                <Text style={[styles.paywallTitle, { color: colors.text }]}>
                  പ്രീമിയം വരിക്കാർക്ക് മാത്രം
                </Text>

                <Text style={[styles.paywallSubtitle, { color: colors.textSecondary }]}>
                  ഈ സമ്പൂർണ്ണ അന്വേഷണാത്മക വാർത്ത വൈറ്റ്സ്വാൻ ടിവി വിഐപി വരിക്കാർക്കായി മാത്രം ലഭ്യമായതാണ്. മൊബൈൽ ആപ്പിലും വെബ്സൈറ്റിലും പൂർണ്ണമായി വായിക്കാൻ ഇപ്പോൾ തന്നെ സബ്‌സ്‌ക്രൈബ് ചെയ്യുക.
                </Text>

                <TouchableOpacity
                  style={styles.paywallSubscribeBtn}
                  onPress={() => navigation.navigate('PremiumPlans')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.paywallSubscribeBtnText}>
                    Unlock Full Story
                  </Text>
                </TouchableOpacity>

                {!isLoggedIn && (
                  <View style={styles.paywallFooterLinks}>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('Login')}
                      style={styles.paywallRestoreBtn}
                    >
                      <Text style={[styles.paywallRestoreBtnText, { color: COLORS.primary }]}>
                        Already a Premium Member? Sign In →
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ) : (
            /* --- Full Content: Regular Posts or Subscribed VIP Users --- */
            <View style={styles.htmlWrapper}>
              {loading && !post.content ? (
                <ActivityIndicator
                  size="large"
                  color={COLORS.primary}
                  style={{ marginVertical: 30 }}
                />
              ) : (
                <HtmlReader
                  html={post.content || `<p>${post.excerpt}</p>`}
                  fontSize={baseFontSize}
                />
              )}
            </View>
          )}

          {/* Premium VIP Patron Banner (for non-premium articles) */}
          {!post.isPremium && !isVipUser && (
            <TouchableOpacity
              style={[
                styles.articlePremiumBox,
                {
                  backgroundColor: isDarkMode ? 'rgba(0, 163, 232, 0.12)' : 'rgba(0, 163, 232, 0.08)',
                  borderColor: '#00A3E8',
                },
              ]}
              onPress={() => navigation.navigate('PremiumPlans')}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.articlePremiumLogoContainer,
                  { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' },
                ]}
              >
                <Image
                  source={require('../../assets/logo.png')}
                  style={styles.articlePremiumLogo}
                  resizeMode="contain"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.articlePremiumTitle, { color: colors.text }]}>
                  Support Quality Journalism
                </Text>
                <Text style={[styles.articlePremiumDesc, { color: colors.textSecondary }]}>
                  Get unlimited ad-free reading, exclusive investigative reports, and daily premium features.
                </Text>
              </View>
              <View style={styles.articlePremiumBtn}>
                <Text style={styles.articlePremiumBtnText}>Plans →</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Author Profile & All Posts Box */}
          <View
            style={[
              styles.authorBoxCard,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.authorBoxTop}>
              <Image
                source={{
                  uri:
                    post.authorAvatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName || 'Whiteswan Desk')}&background=00A3E8&color=fff&bold=true`,
                }}
                style={styles.authorBoxAvatar}
              />
              <View style={styles.authorBoxInfo}>
                <View style={styles.authorBoxTitleRow}>
                  <Text style={[styles.authorBoxName, { color: colors.text }]}>
                    {post.authorName || 'Whiteswan Desk'}
                  </Text>
                  <View style={styles.verifiedMiniBadge}>
                    <Ionicons name="checkmark-sharp" size={9} color="#FFFFFF" />
                  </View>
                </View>
                <View style={styles.authorBoxRoleRow}>
                  <Image
                    source={require('../../assets/logo.png')}
                    style={styles.authorBoxLogo}
                    resizeMode="contain"
                  />
                  <Text style={[styles.authorBoxRole, { color: colors.textSecondary }]}>
                    Whiteswan TV News Editor
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.allPostsBtn}
                onPress={handleAuthorPress}
                activeOpacity={0.8}
              >
                <Text style={styles.allPostsBtnText}>All Posts</Text>
                <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {authorPosts.length > 0 && (
              <View style={styles.authorStoriesList}>
                <Text style={[styles.moreByAuthorTitle, { color: colors.textSecondary }]}>
                  More stories by {post.authorName || 'this author'}:
                </Text>
                {authorPosts.map((item) => (
                  <TouchableOpacity
                    key={`author_story_${item.id}`}
                    style={[styles.authorStoryItem, { borderTopColor: colors.border }]}
                    onPress={() => navigation.push('ArticleDetail', { post: item })}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="newspaper-outline" size={14} color="#00A3E8" />
                    <Text style={[styles.authorStoryTitle, { color: colors.text }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* WordPress Comment Section */}
          {post?.id && (
            <CommentSection postId={post.id} postTitle={post.title} />
          )}

          {/* Related Articles Section */}
          {relatedPosts.length > 0 && (
            <View style={styles.relatedSection}>
              <View style={styles.relatedHeader}>
                <View style={styles.redLine} />
                <Text style={[styles.relatedTitle, { color: colors.text }]}>
                  Related News
                </Text>
              </View>

              {relatedPosts.map((item) => (
                <NewsCard
                  key={item.id}
                  post={item}
                  onPress={(selected) => navigation.push('ArticleDetail', { post: selected })}
                  variant="compact"
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  tabletContent: {
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  navButton: {
    padding: 6,
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fontControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  fontBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  fontBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fontDivider: {
    width: 1,
    height: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: '100%',
    height: 240,
    position: 'relative',
    backgroundColor: '#000000',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  contentPadding: {
    padding: SPACING.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 12,
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 14,
  },
  authorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
  },
  authorName: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '500',
  },
  shareBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    gap: 10,
    marginBottom: 16,
  },
  shareBarLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  whatsappBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  htmlWrapper: {
    marginTop: 4,
  },
  articlePremiumBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    marginTop: 20,
    gap: 12,
  },
  articlePremiumLogoContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 232, 0.25)',
  },
  articlePremiumLogo: {
    width: 32,
    height: 32,
  },
  articlePremiumTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    marginBottom: 2,
  },
  articlePremiumDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  articlePremiumBtn: {
    backgroundColor: '#00A3E8',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  articlePremiumBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  relatedSection: {
    marginTop: 28,
  },
  relatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  redLine: {
    width: 4,
    height: 18,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  relatedTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  paywallWrapper: {
    marginTop: 4,
  },
  previewContainer: {
    position: 'relative',
    maxHeight: 140,
    overflow: 'hidden',
    marginBottom: 4,
  },
  previewContent: {
    opacity: 0.95,
  },
  previewGradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
  },
  paywallCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    padding: SPACING.lg,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  paywallIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  paywallTagBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    marginBottom: 12,
  },
  paywallTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  paywallTitle: {
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 26,
  },
  paywallSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  paywallSubscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: RADIUS.full,
    width: '100%',
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  paywallSubscribeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  paywallFooterLinks: {
    marginTop: 16,
    alignItems: 'center',
  },
  paywallRestoreBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  paywallRestoreBtnText: {
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  // Author Profile & All Posts Box Styles
  authorBoxCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  authorBoxTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authorBoxAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
  },
  authorBoxInfo: {
    flex: 1,
  },
  authorBoxTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorBoxName: {
    fontSize: 15,
    fontWeight: '700',
  },
  verifiedMiniBadge: {
    backgroundColor: '#00A3E8',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorBoxRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  authorBoxLogo: {
    width: 38,
    height: 14,
  },
  authorBoxRole: {
    fontSize: 11,
    fontWeight: '600',
  },
  allPostsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  allPostsBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  authorStoriesList: {
    marginTop: 12,
    paddingTop: 10,
  },
  moreByAuthorTitle: {
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  authorStoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  authorStoryTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    flex: 1,
  },
});
