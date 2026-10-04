import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Share,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { NewsCard } from '../components/NewsCard';
import { fetchAuthorPosts, fetchAuthorDetails, normalizeImageUrl } from '../services/wpApi';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const AuthorScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDarkMode } = useTheme();

  const {
    authorId,
    authorSlug,
    authorName: initialName = 'Author',
    authorAvatar: initialAvatar = '',
    authorRole: initialRole = 'News Editor',
    authorDescription: initialDesc = '',
  } = route.params || {};

  const [author, setAuthor] = useState({
    id: authorId,
    name: initialName,
    role: initialRole,
    avatar: initialAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(initialName)}&background=00A3E8&color=fff&bold=true`,
    description: initialDesc,
  });

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalPosts, setTotalPosts] = useState(0);
  const [imgError, setImgError] = useState(false);

  const isTablet = width >= 768;

  // Load author details and initial posts
  useEffect(() => {
    loadAuthorInfo();
    loadInitialPosts();
  }, [authorId, authorSlug]);

  const loadAuthorInfo = async () => {
    const target = authorId || authorSlug;
    if (!target) return;
    try {
      const details = await fetchAuthorDetails(target);
      if (details) {
        setAuthor((prev) => ({
          ...prev,
          id: details.id || prev.id,
          name: details.name || prev.name,
          role: details.role || prev.role || 'News Editor',
          avatar: details.avatar || prev.avatar,
          description: details.description || prev.description,
          link: details.link || '',
        }));
      }
    } catch (e) {
      console.log('Author details load note:', e.message);
    }
  };

  const loadInitialPosts = async () => {
    setLoading(true);
    try {
      const res = await fetchAuthorPosts({
        authorId: authorId || (author?.id ? author.id : null),
        page: 1,
        perPage: 12,
        bypassCache: true,
      });

      setPosts(res.posts || []);
      setTotalPosts(res.totalPosts || res.posts?.length || 0);
      setPage(1);
      setHasMore(1 < (res.totalPages || 1));
    } catch (e) {
      console.log('Initial author posts error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadAuthorInfo();
      const res = await fetchAuthorPosts({
        authorId: authorId || author?.id,
        page: 1,
        perPage: 12,
        bypassCache: true,
      });

      setPosts(res.posts || []);
      setTotalPosts(res.totalPosts || res.posts?.length || 0);
      setPage(1);
      setHasMore(1 < (res.totalPages || 1));
    } catch (e) {
      console.log('Refresh error:', e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || loading || refreshing) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await fetchAuthorPosts({
        authorId: authorId || author?.id,
        page: nextPage,
        perPage: 12,
        bypassCache: true,
      });

      if (res.posts && res.posts.length > 0) {
        setPosts((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          const fresh = res.posts.filter((p) => !ids.has(p.id));
          return [...prev, ...fresh];
        });
        setPage(nextPage);
        setHasMore(nextPage < (res.totalPages || 1));
      } else {
        setHasMore(false);
      }
    } catch (e) {
      console.log('Load more error:', e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleShareAuthor = async () => {
    try {
      const shareUrl = author?.link || `https://whiteswantvnews.com/author/${author?.slug || authorId}/`;
      await Share.share({
        title: `${author.name} - Whiteswan TV News`,
        message: `Read all articles by ${author.name} on Whiteswan TV News:\n${shareUrl}`,
        url: shareUrl,
      });
    } catch (e) {}
  };

  const authorAvatarUri =
    !imgError && author?.avatar
      ? normalizeImageUrl(author.avatar)
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(author?.name || 'Whiteswan')}&background=00A3E8&color=fff&bold=true`;

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Author Profile Card */}
      <View
        style={[
          styles.authorCard,
          {
            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.avatarWrapper}>
          <Image
            source={{ uri: authorAvatarUri }}
            style={styles.avatar}
            onError={() => setImgError(true)}
          />
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-sharp" size={11} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.authorInfo}>
          <View style={styles.authorHeaderRow}>
            <View style={styles.nameAndRole}>
              <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>
                {author.name || 'Whiteswan Editor'}
              </Text>
              <Text style={[styles.authorRoleText, { color: '#00A3E8' }]}>
                {author.role || 'News Editor'}
              </Text>
            </View>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.cardLogo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.badgeRow}>
            {totalPosts > 0 && (
              <View style={[styles.countBadge, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}>
                <Ionicons name="newspaper-outline" size={12} color="#00A3E8" style={{ marginRight: 4 }} />
                <Text style={[styles.countBadgeText, { color: colors.textSecondary }]}>
                  {totalPosts} {totalPosts === 1 ? 'Article' : 'Articles'}
                </Text>
              </View>
            )}
          </View>

          {author.description ? (
            <Text style={[styles.authorBio, { color: colors.textSecondary }]}>
              {author.description}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Section Divider */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.redLine} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Articles by {author.name || 'Author'}
        </Text>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return <View style={{ height: 30 }} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-text-outline" size={54} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Articles Found</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          No published articles by this author at the moment.
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={handleRefresh}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={16} color="#FFFFFF" />
          <Text style={styles.retryBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Navigation Bar */}
      <View
        style={[
          styles.navBar,
          {
            paddingTop: Math.max(insets.top, 12),
            backgroundColor: colors.headerBg,
            borderBottomColor: colors.border,
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

        <Text style={[styles.navTitle, { color: colors.text }]} numberOfLines={1}>
          Author Profile
        </Text>

        <TouchableOpacity
          style={styles.navButton}
          onPress={handleShareAuthor}
          activeOpacity={0.7}
        >
          <Ionicons name="share-social-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading author stories...
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => `author_post_${item.id}`}
          renderItem={({ item }) => (
            <NewsCard
              post={item}
              variant="compact"
              onPress={(selected) => navigation.push('ArticleDetail', { post: selected })}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            isTablet && styles.tabletContent,
          ]}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  navButton: {
    padding: 6,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    maxWidth: '70%',
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 40,
  },
  tabletContent: {
    maxWidth: 740,
    width: '100%',
    alignSelf: 'center',
  },
  headerContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  authorCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: SPACING.md,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E2E8F0',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#00A3E8',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  authorInfo: {
    flex: 1,
  },
  authorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  nameAndRole: {
    flex: 1,
  },
  authorName: {
    fontSize: 18,
    fontWeight: '800',
  },
  authorRoleText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  cardLogo: {
    width: 80,
    height: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 163, 232, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  roleBadgeText: {
    color: '#00A3E8',
    fontSize: 11,
    fontWeight: '700',
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  countBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  authorBio: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  redLine: {
    width: 4,
    height: 18,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  centerLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
  },
  footerLoader: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    marginTop: 6,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
});
