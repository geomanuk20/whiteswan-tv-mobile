import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Share,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useBookmarks } from '../context/BookmarkContext';
import { shareArticleWithImage } from '../utils/shareHelper';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const NewsCard = ({
  post,
  onPress,
  variant = 'compact', // 'hero' | 'compact' | 'grid'
}) => {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const { colors, isDarkMode } = useTheme();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const [imgError, setImgError] = React.useState(false);

  if (!post) return null;

  const fallbackImg = 'https://whiteswantvnews.com/wp-content/uploads/2025/12/download.png';
  const imageUri =
    !imgError && post.featuredImage && typeof post.featuredImage === 'string' && post.featuredImage.startsWith('http')
      ? post.featuredImage
      : fallbackImg;

  const isSmall = width < 360;
  const isTablet = width >= 768;
  const heroHeight = isTablet ? 320 : Math.max(180, Math.min(width * 0.55, 260));
  const compactImgWidth = isSmall ? 80 : Math.max(85, Math.min(width * 0.25, 115));
  const compactImgHeight = isSmall ? 75 : Math.max(80, Math.min(width * 0.23, 105));

  const bookmarked = isBookmarked(post.id);

  const handleAuthorPress = (e) => {
    e?.stopPropagation?.();
    if (navigation && (post.authorId || post.authorSlug || post.authorName)) {
      navigation.navigate('Author', {
        authorId: post.authorId,
        authorSlug: post.authorSlug,
        authorName: post.authorName,
        authorAvatar: post.authorAvatar,
        authorRole: 'News Editor',
        authorDescription: post.authorDescription,
      });
    }
  };

  const handleShare = async () => {
    await shareArticleWithImage(post);
  };

  // Hero Variant
  if (variant === 'hero') {
    return (
      <TouchableOpacity
        style={[
          styles.heroCard,
          { backgroundColor: colors.card, borderColor: colors.border },
          isTablet && styles.tabletContainer,
        ]}
        activeOpacity={0.9}
        onPress={() => onPress && onPress(post)}
      >
        <View style={[styles.heroImageContainer, { height: heroHeight }]}>
          <Image
            source={{ uri: imageUri }}
            style={styles.heroImage}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.88)']}
            style={styles.heroGradient}
          />
          <View style={[styles.heroBadge, post.isPremium && { backgroundColor: COLORS.primary }]}>
            <Text style={styles.heroBadgeText}>
              {post.isPremium ? 'PREMIUM' : post.categoryName}
            </Text>
          </View>
        </View>

        <View style={styles.heroContent}>
          <Text
            style={[
              styles.heroTitle,
              { fontSize: isSmall ? 14 : isTablet ? 19 : 16 },
            ]}
            numberOfLines={3}
          >
            {post.title}
          </Text>

          <View style={styles.heroFooter}>
            <TouchableOpacity
              style={styles.heroAuthorRow}
              onPress={handleAuthorPress}
              activeOpacity={0.7}
            >
              <Image
                source={{
                  uri:
                    post.authorAvatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName || 'Whiteswan')}&background=00A3E8&color=fff`,
                }}
                style={styles.heroAuthorAvatar}
              />
              <Text style={styles.heroAuthorText} numberOfLines={1}>
                {post.authorName || 'Whiteswan News'}
              </Text>
              <Text style={styles.heroDot}>•</Text>
              <Text style={styles.heroMetaText}>{post.timeAgo}</Text>
            </TouchableOpacity>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.iconCircle}
                onPress={() => toggleBookmark(post)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={16}
                  color={bookmarked ? COLORS.secondary : '#FFFFFF'}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconCircle}
                onPress={handleShare}
                activeOpacity={0.7}
              >
                <Ionicons name="share-social-outline" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // Grid Variant
  if (variant === 'grid') {
    return (
      <TouchableOpacity
        style={[
          styles.gridCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        activeOpacity={0.8}
        onPress={() => onPress && onPress(post)}
      >
        <Image
          source={{ uri: imageUri }}
          style={styles.gridImage}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
        <View style={styles.gridContent}>
          <View style={[styles.categoryPill, post.isPremium && { backgroundColor: COLORS.primary }]}>
            <Text style={styles.categoryPillText}>
              {post.isPremium ? 'PREMIUM' : post.categoryName}
            </Text>
          </View>
          <Text
            style={[styles.gridTitle, { color: colors.text }]}
            numberOfLines={2}
          >
            {post.title}
          </Text>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            {post.timeAgo}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Compact List Item Variant (Default)
  return (
    <TouchableOpacity
      style={[
        styles.compactCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        isTablet && styles.tabletContainer,
      ]}
      activeOpacity={0.8}
      onPress={() => onPress && onPress(post)}
    >
      <View style={styles.compactContent}>
        <View style={styles.compactHeaderRow}>
          <View
            style={[
              styles.categoryBadgeMini,
              { backgroundColor: post.isPremium ? COLORS.primary : colors.badgeBg },
            ]}
          >
            <Text
              style={[
                styles.categoryBadgeMiniText,
                { color: post.isPremium ? '#FFFFFF' : colors.badgeText },
              ]}
            >
              {post.isPremium ? 'PREMIUM' : post.categoryName}
            </Text>
          </View>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            {post.timeAgo}
          </Text>
        </View>

        <Text
          style={[
            styles.compactTitle,
            { color: colors.text, fontSize: isSmall ? 13 : isTablet ? 16 : 14.5 },
          ]}
          numberOfLines={3}
        >
          {post.title}
        </Text>

        <View style={styles.compactFooter}>
          <TouchableOpacity
            style={styles.authorRow}
            onPress={handleAuthorPress}
            activeOpacity={0.7}
          >
            <Image
              source={{
                uri:
                  post.authorAvatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName || 'Whiteswan')}&background=00A3E8&color=fff`,
              }}
              style={styles.authorAvatarMini}
            />
            <Text
              style={[styles.authorText, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {post.authorName || 'Whiteswan News'}
            </Text>
          </TouchableOpacity>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.compactActionBtn}
              onPress={() => toggleBookmark(post)}
              activeOpacity={0.6}
            >
              <Ionicons
                name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                size={17}
                color={bookmarked ? COLORS.primary : colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.compactActionBtn}
              onPress={handleShare}
              activeOpacity={0.6}
            >
              <Ionicons
                name="share-social-outline"
                size={17}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Image
        source={{ uri: imageUri }}
        style={[
          styles.compactImage,
          { width: compactImgWidth, height: compactImgHeight },
        ]}
        resizeMode="cover"
        onError={() => setImgError(true)}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Hero Styles
  heroCard: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  heroImageContainer: {
    width: '100%',
    height: 210,
    position: 'relative',
    backgroundColor: '#000000',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '80%',
  },
  heroBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  heroAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '68%',
  },
  heroAuthorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    marginRight: 6,
  },
  heroAuthorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  heroDot: {
    color: 'rgba(255,255,255,0.6)',
    marginHorizontal: 5,
    fontSize: 11,
  },
  heroMetaText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '500',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Compact List Styles
  compactCard: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginVertical: 6,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 12,
    alignItems: 'center',
  },
  compactContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  compactHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  categoryBadgeMini: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeMiniText: {
    fontSize: 10,
    fontWeight: '700',
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 6,
  },
  compactFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '65%',
  },
  authorAvatarMini: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
  },
  authorText: {
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 1,
  },
  compactImage: {
    width: 95,
    height: 90,
    borderRadius: RADIUS.md,
    backgroundColor: '#E2E8F0',
  },
  compactActionBtn: {
    padding: 4,
  },

  // Grid Styles
  gridCard: {
    width: '48%',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  gridImage: {
    width: '100%',
    height: 110,
  },
  gridContent: {
    padding: SPACING.sm,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginBottom: 4,
  },
  categoryPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  gridTitle: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginBottom: 4,
  },

  tabletContainer: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
