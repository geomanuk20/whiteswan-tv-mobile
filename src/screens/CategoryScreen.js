import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  Image,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { NewsCard } from '../components/NewsCard';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { fetchPosts } from '../services/wpApi';
import { DEFAULT_CATEGORIES, KERALA_DISTRICTS } from '../constants/categories';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const CategoryScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDarkMode } = useTheme();

  const isTablet = width >= 768;
  const initialCategoryParam = route.params?.categoryId;

  // View state: 'grid' (3-column box overview) or 'detail' (articles for selected category)
  const [activeView, setActiveView] = useState(
    initialCategoryParam !== undefined ? 'detail' : 'grid'
  );
  const [selectedCatId, setSelectedCatId] = useState(
    initialCategoryParam !== undefined ? initialCategoryParam : null
  );
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // District dropdown modal state
  const [districtModalVisible, setDistrictModalVisible] = useState(false);

  // Check if current category is Kerala or any of its districts
  const isKeralaCategory =
    selectedCatId === 45 || KERALA_DISTRICTS.some((d) => d.id === selectedCatId);
  const currentDistrict =
    KERALA_DISTRICTS.find((d) => d.id === selectedCatId) || KERALA_DISTRICTS[0];

  // Sync route params when navigated with a category
  useEffect(() => {
    if (route.params?.categoryId !== undefined) {
      setSelectedCatId(route.params.categoryId);
      setActiveView('detail');
    }
  }, [route.params?.categoryId]);

  useEffect(() => {
    if (activeView === 'detail') {
      loadCategoryPosts(selectedCatId, 1);
    }
  }, [selectedCatId, activeView]);

  const loadCategoryPosts = async (catId, pageNum = 1, bypassCache = true) => {
    try {
      if (pageNum === 1) setLoading(true);
      const data = await fetchPosts({
        page: pageNum,
        perPage: 10,
        categoryId: catId,
        bypassCache,
      });

      if (pageNum === 1) {
        setPosts(data.posts || []);
      } else {
        const existingIds = new Set(posts.map((p) => p.id));
        const newItems = (data.posts || []).filter((p) => !existingIds.has(p.id));
        setPosts((prev) => [...prev, ...newItems]);
      }
      setTotalPages(data.totalPages || 1);
      setPage(pageNum);
    } catch (e) {
      console.error('Failed to load category posts:', e);
      if (pageNum === 1) {
        setPosts([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadCategoryPosts(selectedCatId, 1, true);
  };

  const handleLoadMore = () => {
    if (loadingMore || loading || page >= totalPages) return;
    setLoadingMore(true);
    loadCategoryPosts(selectedCatId, page + 1);
  };

  const handleSelectCategoryBox = (catId) => {
    setSelectedCatId(catId);
    setActiveView('detail');
  };

  const handleBackToGrid = () => {
    setActiveView('grid');
    setPosts([]);
  };

  const handleSelectDistrict = (districtId) => {
    setDistrictModalVisible(false);
    setSelectedCatId(districtId);
    setActiveView('detail');
  };

  const selectedCategoryObj =
    DEFAULT_CATEGORIES.find((c) => c.id === selectedCatId) ||
    (isKeralaCategory
      ? { ...DEFAULT_CATEGORIES.find((c) => c.id === 45), name: currentDistrict.name }
      : DEFAULT_CATEGORIES[0]);

  // Grid layout calculations (3 columns)
  const numColumns = isTablet ? 4 : 3;
  const horizontalPadding = SPACING.md;
  const gridGap = SPACING.sm;
  const boxWidth =
    (Math.min(width, 800) - horizontalPadding * 2 - gridGap * (numColumns - 1)) / numColumns;

  // Filter categories for the grid
  const gridCategories = DEFAULT_CATEGORIES;

  // ==========================================
  // RENDER: 3-COLUMN BOX GRID OVERVIEW
  // ==========================================
  if (activeView === 'grid') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View
          style={[
            styles.headerBar,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
              paddingTop: Math.max(insets.top, 12) + 4,
            },
          ]}
        >
          <View style={styles.headerTitleRow}>
            <View style={styles.headerTextGroup}>
              <Text style={[styles.mainHeaderTitle, { color: colors.text }]}>Categories</Text>
              <Text style={[styles.mainHeaderSubtitle, { color: colors.textSecondary }]}>
                Explore all news topics
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.headerIconButton, { backgroundColor: colors.inputBg }]}
              onPress={() => navigation.navigate('Search')}
              activeOpacity={0.7}
            >
              <Ionicons name="search-outline" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 3-Column Box Grid */}
        <FlatList
          key={`grid-${numColumns}`}
          data={gridCategories}
          keyExtractor={(item) => (item.id !== null ? item.id.toString() : 'all')}
          numColumns={numColumns}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.gridContent,
            { paddingHorizontal: horizontalPadding, paddingVertical: SPACING.md },
            isTablet && { maxWidth: 800, alignSelf: 'center', width: '100%' },
          ]}
          columnWrapperStyle={{ gap: gridGap, marginBottom: gridGap }}
          renderItem={({ item }) => {
            const catColor = item.color || COLORS.primary;
            return (
              <TouchableOpacity
                style={[
                  styles.categoryBox,
                  {
                    width: boxWidth,
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                  },
                ]}
                onPress={() => handleSelectCategoryBox(item.id)}
                activeOpacity={0.82}
              >
                {/* Background Topic Image */}
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                  />
                ) : null}

                {/* Rich Dark Gradient Overlay for Contrast */}
                <LinearGradient
                  colors={[
                    'rgba(15, 23, 42, 0.25)',
                    'rgba(15, 23, 42, 0.65)',
                    'rgba(15, 23, 42, 0.94)',
                  ]}
                  style={StyleSheet.absoluteFillObject}
                />

                {/* Top Colored Category Accent Bar */}
                <View style={[styles.boxAccentBar, { backgroundColor: catColor }]} />

                {/* Category Icon Badge with Glassmorphic Backdrop */}
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor: `${catColor}35`,
                      borderColor: `${catColor}80`,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Ionicons name={item.icon} size={20} color="#FFFFFF" />
                </View>

                {/* English Category Title */}
                <Text
                  style={styles.boxTitleEn}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {item.name}
                </Text>

                {/* Malayalam Subtitle */}
                {item.nameMl ? (
                  <Text
                    style={styles.boxTitleMl}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.nameMl}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={<View style={{ height: 24 }} />}
        />
      </View>
    );
  }

  // ==========================================
  // RENDER: CATEGORY ARTICLES DETAIL VIEW
  // ==========================================
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Detail Top Bar with Back Button */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: Math.max(insets.top, 12) + 4,
          },
        ]}
      >
        <View style={styles.detailHeaderRow}>
          <TouchableOpacity
            style={[styles.backToGridBtn, { backgroundColor: colors.inputBg }]}
            onPress={handleBackToGrid}
            activeOpacity={0.7}
          >
            <Ionicons name="grid-outline" size={16} color={COLORS.primary} />
            <Text style={[styles.backToGridText, { color: COLORS.primary }]}>All Categories</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerIconButton, { backgroundColor: colors.inputBg }]}
            onPress={() => navigation.navigate('Search')}
            activeOpacity={0.7}
          >
            <Ionicons name="search-outline" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Horizontal Category Switcher Chips */}
        <FlatList
          horizontal
          data={DEFAULT_CATEGORIES}
          keyExtractor={(item) => (item.id !== null ? item.id.toString() : 'all')}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
          renderItem={({ item }) => {
            const isSelected =
              selectedCatId === item.id || (item.id === 45 && isKeralaCategory && selectedCatId === 45);
            const itemColor = item.color || COLORS.primary;
            return (
              <TouchableOpacity
                onPress={() => setSelectedCatId(item.id)}
                style={[
                  styles.chipItem,
                  {
                    backgroundColor: isSelected ? COLORS.primary : colors.inputBg,
                    borderColor: isSelected ? COLORS.primary : colors.border,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={item.icon}
                  size={13}
                  color={isSelected ? '#FFFFFF' : itemColor}
                />
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? '#FFFFFF' : colors.text,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Selected Category Banner with District Dropdown for Kerala */}
      <View
        style={[
          styles.categoryBanner,
          { borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' },
        ]}
      >
        {selectedCategoryObj.image ? (
          <Image
            source={{ uri: selectedCategoryObj.image }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        ) : null}
        <LinearGradient
          colors={[
            'rgba(15, 23, 42, 0.75)',
            'rgba(15, 23, 42, 0.92)',
          ]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.bannerMainRow}>
          <View
            style={[
              styles.bannerIconBox,
              {
                backgroundColor: `${selectedCategoryObj.color || COLORS.primary}35`,
                borderColor: `${selectedCategoryObj.color || COLORS.primary}80`,
                borderWidth: 1,
              },
            ]}
          >
            <Ionicons
              name={selectedCategoryObj.icon}
              size={20}
              color="#FFFFFF"
            />
          </View>
          <View style={styles.bannerTextGroup}>
            <Text style={[styles.bannerTitle, { color: '#FFFFFF' }]}>
              {selectedCategoryObj.name}
            </Text>
            <Text style={[styles.bannerSubtitle, { color: 'rgba(255, 255, 255, 0.8)' }]}>
              {selectedCategoryObj.nameMl ? `${selectedCategoryObj.nameMl} • ` : ''}Latest news & updates
            </Text>
          </View>

          {/* District Dropdown Trigger Button when viewing Kerala */}
          {isKeralaCategory && (
            <TouchableOpacity
              style={[
                styles.districtDropdownBtn,
                { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: 'rgba(255, 255, 255, 0.3)' },
              ]}
              onPress={() => setDistrictModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="location" size={14} color="#FFFFFF" />
              <Text
                style={[styles.districtDropdownBtnText, { color: '#FFFFFF' }]}
                numberOfLines={1}
              >
                {currentDistrict.name === 'All Kerala' ? 'District' : currentDistrict.name}
              </Text>
              <Ionicons name="chevron-down" size={14} color="rgba(255, 255, 255, 0.8)" />
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Horizontal District Filter Bar for Kerala */}
        {isKeralaCategory && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.districtChipsRow}
          >
            {KERALA_DISTRICTS.map((d) => {
              const isDistrictSelected = selectedCatId === d.id;
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    styles.districtChip,
                    {
                      backgroundColor: isDistrictSelected
                        ? COLORS.primary
                        : colors.badgeBg,
                      borderColor: isDistrictSelected
                        ? COLORS.primary
                        : colors.border,
                    },
                  ]}
                  onPress={() => handleSelectDistrict(d.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.districtChipText,
                      {
                        color: isDistrictSelected ? '#FFFFFF' : colors.text,
                        fontWeight: isDistrictSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {d.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Posts List */}
      {loading ? (
        <LoadingSkeleton count={5} />
      ) : posts.length === 0 ? (
        <EmptyState
          title={`No Articles in ${selectedCategoryObj.name}`}
          subtitle="Please select another district or category to view recent articles."
          onRetry={() => loadCategoryPosts(selectedCatId, 1)}
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <NewsCard
              post={item}
              onPress={(selected) => navigation.navigate('ArticleDetail', { post: selected })}
              variant="compact"
            />
          )}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : (
              <View style={{ height: 20 }} />
            )
          }
          contentContainerStyle={[
            { paddingBottom: 20 },
            isTablet && { maxWidth: 760, alignSelf: 'center', width: '100%' },
          ]}
        />
      )}

      {/* Kerala District Selection Dropdown Modal */}
      <Modal
        visible={districtModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDistrictModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDistrictModalVisible(false)}
        >
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.modalHeaderTitleGroup}>
                <Ionicons name="location" size={20} color={COLORS.primary} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Select District
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setDistrictModalVisible(false)}
                style={[styles.modalCloseBtn, { backgroundColor: colors.inputBg }]}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Districts List */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.districtsList}
            >
              {KERALA_DISTRICTS.map((district) => {
                const isSelected = selectedCatId === district.id;

                return (
                  <TouchableOpacity
                    key={district.id}
                    style={[
                      styles.districtItem,
                      {
                        backgroundColor: isSelected ? colors.badgeBg : 'transparent',
                        borderBottomColor: colors.border,
                      },
                    ]}
                    onPress={() => handleSelectDistrict(district.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.districtItemLeft}>
                      <Ionicons
                        name={district.icon}
                        size={18}
                        color={isSelected ? COLORS.primary : colors.textSecondary}
                      />
                      <View style={styles.districtItemNames}>
                        <Text
                          style={[
                            styles.districtItemNameEn,
                            {
                              color: isSelected ? COLORS.primary : colors.text,
                              fontWeight: isSelected ? '700' : '600',
                            },
                          ]}
                        >
                          {district.name}
                        </Text>
                      </View>
                    </View>

                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={COLORS.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    borderBottomWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  headerTextGroup: {
    flex: 1,
  },
  mainHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  mainHeaderSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContent: {
    flexGrow: 1,
  },
  // Three-column box card
  categoryBox: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: SPACING.md - 2,
    paddingHorizontal: SPACING.xs,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    height: 122,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
    backgroundColor: '#1E293B',
  },
  boxAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3.5,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  boxTitleEn: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    color: '#FFFFFF',
    lineHeight: 15,
    paddingHorizontal: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  boxTitleMl: {
    fontSize: 9.5,
    fontWeight: '500',
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 12,
    marginTop: 2,
    paddingHorizontal: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Detail View Header
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 8,
  },
  backToGridBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  backToGridText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  chipsContainer: {
    gap: 6,
    paddingVertical: 4,
  },
  chipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 5,
  },
  chipText: {
    fontSize: 11.5,
  },
  // Category Banner
  categoryBanner: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    padding: SPACING.sm + 4,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  bannerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextGroup: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  bannerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  districtDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    maxWidth: 130,
  },
  districtDropdownBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  districtChipsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  districtChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  districtChipText: {
    fontSize: 11,
  },
  footerLoading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  // District Modal Bottom Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    maxHeight: '75%',
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  modalHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  districtsList: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  districtItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.sm,
  },
  districtItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  districtItemNames: {
    flexDirection: 'column',
  },
  districtItemNameEn: {
    fontSize: 14,
  },
});
