import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Text,
  AppState,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { Header } from '../components/Header';
import { BreakingNewsTicker } from '../components/BreakingNewsTicker';
import { CategoryPills } from '../components/CategoryPills';
import { NewsCard } from '../components/NewsCard';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { NewsletterPopup } from '../components/NewsletterPopup';
import { fetchPosts, fetchBreakingNews } from '../services/wpApi';
import { COLORS, SPACING } from '../constants/theme';

export const HomeScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const { colors, isDarkMode } = useTheme();
  const isTablet = width >= 768;

  const [posts, setPosts] = useState([]);
  const [breakingNews, setBreakingNews] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const isFirstMount = useRef(true);
  const appState = useRef(AppState.currentState);

  // Silent background revalidation without screen flashing or scroll jumping
  const silentRevalidate = useCallback(async (catId = selectedCategory) => {
    try {
      const [newsData, breakingData] = await Promise.all([
        fetchPosts({ page: 1, perPage: 12, categoryId: catId, bypassCache: true }),
        fetchBreakingNews(8),
      ]);

      if (newsData && Array.isArray(newsData.posts) && newsData.posts.length > 0) {
        setPosts((prevPosts) => {
          // If category matches, check if posts differ
          const currentFirstId = prevPosts[0]?.id;
          const newFirstId = newsData.posts[0]?.id;
          if (currentFirstId !== newFirstId || prevPosts.length === 0) {
            return newsData.posts;
          }
          return prevPosts;
        });
        setTotalPages(newsData.totalPages);
      }

      if (Array.isArray(breakingData) && breakingData.length > 0) {
        setBreakingNews(breakingData);
      }
    } catch (e) {
      console.log('Silent revalidate error:', e.message);
    }
  }, [selectedCategory]);

  // Load initial data (Cache-First + Instant Background Update)
  const loadInitialData = async () => {
    const cacheKey = `@wp_posts_v6_c${selectedCategory || 'all'}_aall_p1`;
    try {
      setError(null);

      // 1. Show cached posts immediately if available for 0ms instant render
      if (isFirstMount.current) {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.posts) && parsed.posts.length > 0) {
            setPosts(parsed.posts);
            setTotalPages(parsed.totalPages || 1);
            setLoading(false);
          }
        }
      } else {
        setLoading(true);
      }

      // 2. Fetch fresh live posts from WordPress server
      const [newsData, breakingData] = await Promise.all([
        fetchPosts({ page: 1, perPage: 12, categoryId: selectedCategory, bypassCache: true }),
        fetchBreakingNews(8),
      ]);

      if (newsData && Array.isArray(newsData.posts)) {
        setPosts(newsData.posts);
        setTotalPages(newsData.totalPages);
        setPage(1);
      }
      if (Array.isArray(breakingData)) {
        setBreakingNews(breakingData);
      }
    } catch (err) {
      console.error('Home load error:', err);
      if (posts.length === 0) {
        setError('Unable to fetch latest news. Please check your connection.');
      }
    } finally {
      setLoading(false);
      isFirstMount.current = false;
    }
  };

  // Auto-Update on Screen Focus & 30-Second Polling Timer
  useFocusEffect(
    useCallback(() => {
      silentRevalidate();

      // Automatically check for new breaking updates every 30 seconds
      const interval = setInterval(() => {
        silentRevalidate();
      }, 30000);

      return () => clearInterval(interval);
    }, [silentRevalidate])
  );

  // Auto-Update when App returns from Background (Foreground Wakeup)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground -> fetch latest news immediately
        silentRevalidate();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [silentRevalidate]);

  // Pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [newsData, breakingData] = await Promise.all([
        fetchPosts({ page: 1, perPage: 12, categoryId: selectedCategory, bypassCache: true }),
        fetchBreakingNews(8),
      ]);
      setPosts(newsData.posts);
      setTotalPages(newsData.totalPages);
      setPage(1);
      setBreakingNews(breakingData);
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [selectedCategory]);

  // Load more pagination
  const loadMorePosts = async () => {
    if (loadingMore || loading || page >= totalPages) return;

    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const newsData = await fetchPosts({
        page: nextPage,
        perPage: 10,
        categoryId: selectedCategory,
      });

      // Filter duplicates by id
      const existingIds = new Set(posts.map((p) => p.id));
      const newUnique = newsData.posts.filter((p) => !existingIds.has(p.id));

      setPosts((prev) => [...prev, ...newUnique]);
      setPage(nextPage);
    } catch (err) {
      console.error('Load more error:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Category switch
  const handleSelectCategory = (catId) => {
    setSelectedCategory(catId);
  };

  useEffect(() => {
    loadInitialData();
  }, [selectedCategory]);

  const handlePostPress = (post) => {
    navigation.navigate('ArticleDetail', { post });
  };

  const handleSearchPress = () => {
    navigation.navigate('Search');
  };

  const handleLivePress = () => {
    navigation.navigate('LiveTV');
  };

  // Separate hero story from rest of the list
  const heroPost = posts.length > 0 ? posts[0] : null;
  const listPosts = posts.length > 1 ? posts.slice(1) : [];

  const renderHeader = () => (
    <View>
      {/* Top Gray Divider Line */}
      <View style={[styles.topDivider, { backgroundColor: colors.border }]} />

      {/* Breaking News Marquee */}
      {breakingNews.length > 0 && (
        <BreakingNewsTicker
          items={breakingNews}
          onPressItem={handlePostPress}
        />
      )}

      {/* Category Pills Bar */}
      <CategoryPills
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
      />

      {/* Hero Post */}
      {heroPost && (
        <NewsCard
          post={heroPost}
          onPress={handlePostPress}
          variant="hero"
        />
      )}

      {posts.length > 1 && (
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Latest Updates
          </Text>
        </View>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return <View style={{ height: 20 }} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          Loading more news...
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* App Header */}
      <Header
        onSearchPress={handleSearchPress}
        onProfilePress={() => navigation.navigate('Account')}
        onPremiumPress={() => navigation.navigate('PremiumPlans')}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <LoadingSkeleton type="hero" />
          <LoadingSkeleton count={3} />
        </View>
      ) : error && posts.length === 0 ? (
        <EmptyState
          title="No News Available"
          subtitle={error}
          onRetry={loadInitialData}
        />
      ) : (
        <FlatList
          data={listPosts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <NewsCard
              post={item}
              onPress={handlePostPress}
              variant="compact"
            />
          )}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          onEndReached={loadMorePosts}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            { paddingBottom: 20 },
            isTablet && { maxWidth: 760, alignSelf: 'center', width: '100%' },
          ]}
        />
      )}

      {/* Newsletter / Daily Digest Popup */}
      <NewsletterPopup autoTrigger delayMs={2500} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topDivider: {
    height: 1,
    width: '100%',
    marginBottom: 6,
  },
  loadingContainer: {
    paddingTop: 10,
  },
  sectionHeader: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
