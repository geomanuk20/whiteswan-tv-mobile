import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Image,
  useWindowDimensions,
  Platform,
  UIManager,
  LayoutAnimation,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import {
  YOUTUBE_CHANNELS,
  FACEBOOK_PAGES,
  INSTAGRAM_PAGES,
} from '../constants/channels';
import { YouTubeVideoCard } from '../components/YouTubeVideoCard';
import { fetchLatestYouTubeVideos } from '../services/youtubeApi';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BRAND_LOGO = require('../../assets/logo.png');

export const LiveTVScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDarkMode } = useTheme();

  // Single active expanded section key: 'youtube' | 'facebook' | 'instagram' | null
  // Defaults to null so sections are collapsed by default and only open when clicked
  const [expandedSection, setExpandedSection] = useState(null);

  // YouTube live videos state
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Auto-update: load fresh videos on screen focus and every 60 seconds
  useFocusEffect(
    useCallback(() => {
      loadVideos(true);

      const interval = setInterval(() => {
        loadVideos(true);
      }, 60000); // 60s auto-refresh interval

      return () => clearInterval(interval);
    }, [])
  );

  const loadVideos = async (bypassCache = false) => {
    try {
      if (!bypassCache) setLoadingVideos(true);
      const list = await fetchLatestYouTubeVideos({ bypassCache });
      if (Array.isArray(list) && list.length > 0) {
        setVideos(list);
      }
    } catch (e) {
      console.log('Error loading YouTube videos:', e.message);
    } finally {
      setLoadingVideos(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadVideos(true);
  };

  const toggleSection = (key) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSection((prev) => (prev === key ? null : key));
  };

  const isTablet = width >= 768;
  const horizontalPadding = SPACING.md;

  const handleOpenChannel = (url) => {
    if (url) {
      Linking.openURL(url).catch((err) =>
        console.error('Failed to open link:', err)
      );
    }
  };

  // Only Today's videos (Strict filter: Never show yesterday's or older videos)
  const displayedVideos = videos.filter((v) => v.isToday === true);

  // Define the platform sections
  const SECTIONS = [
    {
      key: 'youtube',
      title: 'YouTube Channels',
      titleMl: 'യൂട്യൂബ് ചാനലുകൾ',
      subtitle: 'Live Stream & Video Bulletins',
      icon: 'logo-youtube',
      color: '#E50914',
      actionLabel: 'Visit',
      actionFullLabel: 'Visit Channel',
      items: YOUTUBE_CHANNELS.map((ch) => ({ ...ch, platform: 'youtube' })),
    },
    {
      key: 'facebook',
      title: 'Facebook Pages',
      titleMl: 'ഫേസ്ബുക്ക് പേജുകൾ',
      subtitle: 'Official Pages & Breaking News',
      icon: 'logo-facebook',
      color: '#1877F2',
      actionLabel: 'Visit',
      actionFullLabel: 'Visit Page',
      items: FACEBOOK_PAGES.map((ch) => ({ ...ch, platform: 'facebook' })),
    },
    {
      key: 'instagram',
      title: 'Instagram Pages',
      titleMl: 'ഇൻസ്റ്റാഗ്രാം പേജുകൾ',
      subtitle: 'Visual Stories & News Reels',
      icon: 'logo-instagram',
      color: '#E1306C',
      actionLabel: 'Open',
      actionFullLabel: 'Open Instagram',
      items: INSTAGRAM_PAGES.map((ch) => ({ ...ch, platform: 'instagram' })),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header Bar */}
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
          <Text style={[styles.mainHeaderTitle, { color: colors.text }]}>Channels</Text>
          {navigation && (
            <TouchableOpacity
              style={[styles.headerIconButton, { backgroundColor: colors.inputBg }]}
              onPress={() => navigation.navigate('Search')}
              activeOpacity={0.7}
            >
              <Ionicons name="search-outline" size={18} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main Content with Single-Row Collapsible Dropdown Sections */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontalPadding, paddingVertical: SPACING.md },
          isTablet && { maxWidth: 800, alignSelf: 'center', width: '100%' },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#E50914']}
            tintColor="#E50914"
          />
        }
      >
        {SECTIONS.map((section) => {
          const isExpanded = expandedSection === section.key;

          return (
            <View key={section.key} style={styles.sectionWrapper}>
              {/* Single Row Header with Drop Down Toggle */}
              <TouchableOpacity
                style={[
                  styles.sectionHeaderRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: isExpanded
                      ? isDarkMode
                        ? 'rgba(255, 255, 255, 0.16)'
                        : colors.border
                      : colors.border,
                    borderBottomLeftRadius: isExpanded ? 0 : RADIUS.lg,
                    borderBottomRightRadius: isExpanded ? 0 : RADIUS.lg,
                  },
                ]}
                onPress={() => toggleSection(section.key)}
                activeOpacity={0.75}
              >
                {/* Left side: Platform Icon Badge + Titles */}
                <View style={styles.sectionHeaderLeft}>
                  <View
                    style={[
                      styles.platformIconBadge,
                      { backgroundColor: section.color },
                    ]}
                  >
                    <Ionicons name={section.icon} size={20} color="#FFFFFF" />
                  </View>

                  <View style={styles.sectionHeaderTextCol}>
                    <View style={styles.sectionHeaderTitleRow}>
                      <Text
                        style={[styles.sectionTitle, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {section.title}
                      </Text>
                      <View
                        style={[
                          styles.countPill,
                          {
                            backgroundColor: isDarkMode
                              ? `${section.color}25`
                              : `${section.color}15`,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.countPillText,
                            { color: section.color },
                          ]}
                        >
                          {section.items.length}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.sectionSubtitle,
                        { color: colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {section.subtitle}
                    </Text>
                  </View>
                </View>

                {/* Right side: Dropdown Chevron */}
                <View
                  style={[
                    styles.chevronCircle,
                    {
                      backgroundColor: isExpanded
                        ? `${section.color}15`
                        : colors.inputBg,
                    },
                  ]}
                >
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={isExpanded ? section.color : colors.textSecondary}
                  />
                </View>
              </TouchableOpacity>

              {/* Drop Down Expanded Content (Single-Row Channel Cards) */}
              {isExpanded && (
                <View
                  style={[
                    styles.sectionBody,
                    {
                      backgroundColor: colors.card,
                      borderColor: isDarkMode
                        ? 'rgba(255, 255, 255, 0.12)'
                        : colors.border,
                    },
                  ]}
                >
                  {section.items.map((item, index) => {
                    const isLast = index === section.items.length - 1;

                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.singleRowCard,
                          {
                            borderBottomColor: isDarkMode
                              ? 'rgba(255, 255, 255, 0.08)'
                              : colors.border,
                            borderBottomWidth: isLast ? 0 : 1,
                          },
                        ]}
                        onPress={() => handleOpenChannel(item.url)}
                        activeOpacity={0.7}
                      >
                        {/* Channel Avatar with Whiteswan TV Logo */}
                        <View
                          style={[
                            styles.avatarWrapper,
                            {
                              borderColor: `${section.color}50`,
                            },
                          ]}
                        >
                          <Image
                            source={BRAND_LOGO}
                            style={styles.channelAvatarLogo}
                            resizeMode="contain"
                          />
                        </View>

                        {/* Center Information */}
                        <View style={styles.singleRowCenter}>
                          <View style={styles.singleRowTitleRow}>
                            <Text
                              style={[
                                styles.singleRowTitle,
                                { color: colors.text },
                              ]}
                              numberOfLines={1}
                            >
                              {item.title}
                            </Text>

                            {item.badge && (
                              <View
                                style={[
                                  styles.badgeTag,
                                  {
                                    borderColor: isDarkMode
                                      ? `${section.color}60`
                                      : `${section.color}40`,
                                    backgroundColor: isDarkMode
                                      ? 'rgba(255, 255, 255, 0.05)'
                                      : `${section.color}12`,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.badgeTagText,
                                    {
                                      color: isDarkMode
                                        ? '#CBD5E1'
                                        : section.color,
                                    },
                                  ]}
                                >
                                  {item.badge}
                                </Text>
                              </View>
                            )}
                          </View>

                          {item.titleMl ? (
                            <Text
                              style={[
                                styles.singleRowTitleMl,
                                { color: colors.textSecondary },
                              ]}
                              numberOfLines={1}
                            >
                              {item.titleMl}
                            </Text>
                          ) : null}

                          <Text
                            style={[
                              styles.singleRowHandle,
                              { color: colors.textSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {item.handle}
                          </Text>
                        </View>

                        {/* Right Action Button */}
                        <View
                          style={[
                            styles.singleRowButton,
                            { backgroundColor: section.color },
                          ]}
                        >
                          <Text style={styles.singleRowButtonText}>
                            {section.actionLabel}
                          </Text>
                          <Ionicons
                            name="arrow-forward"
                            size={12}
                            color="#FFFFFF"
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {/* ========================================================================= */}
        {/* LATEST YOUTUBE VIDEOS (TODAY & YESTERDAY BULLETINS)                        */}
        {/* ========================================================================= */}
        <View style={styles.videosSectionContainer}>
          {/* Section Header */}
          <View style={styles.videosSectionHeader}>
            <View style={styles.videosTitleRow}>
              <View style={styles.liveTagBadge}>
                <Ionicons name="play" size={12} color="#FFFFFF" />
                <Text style={styles.liveTagBadgeText}>YOUTUBE</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.videosMainTitle, { color: colors.text }]}>
                  Today's Video Bulletins
                </Text>
                <Text style={[styles.videosSubTitle, { color: colors.textSecondary }]}>
                  ഇന്നത്തെ പ്രധാന വാർത്താ വീഡിയോകൾ
                </Text>
              </View>
            </View>
          </View>

          {/* Video List / Loader */}
          {loadingVideos ? (
            <View style={styles.videoLoadingBox}>
              <ActivityIndicator size="small" color="#E50914" />
              <Text style={[styles.videoLoadingText, { color: colors.textSecondary }]}>
                Loading today's videos...
              </Text>
            </View>
          ) : displayedVideos.length > 0 ? (
            <View style={styles.videosListWrapper}>
              {displayedVideos.map((video) => (
                <YouTubeVideoCard key={video.id} video={video} />
              ))}
            </View>
          ) : (
            <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="videocam-off-outline" size={32} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.text }]}>
                No videos published today yet. Check back soon!
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 28 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    borderBottomWidth: 1,
    paddingBottom: SPACING.xs,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    marginBottom: 2,
  },
  mainHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  sectionWrapper: {
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 13,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  platformIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeaderTextCol: {
    flex: 1,
  },
  sectionHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  countPill: {
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: RADIUS.full,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  chevronCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sectionBody: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
  },
  singleRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 6,
    gap: 10,
  },
  avatarWrapper: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  channelAvatarLogo: {
    width: 36,
    height: 24,
  },
  singleRowCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  singleRowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  singleRowTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  badgeTag: {
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  badgeTagText: {
    fontSize: 8,
    fontWeight: '700',
  },
  singleRowTitleMl: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 1,
  },
  singleRowHandle: {
    fontSize: 10,
    marginTop: 1.5,
  },
  singleRowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6.5,
    borderRadius: RADIUS.sm + 2,
    gap: 4,
  },
  singleRowButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Videos Section Styles
  videosSectionContainer: {
    marginTop: SPACING.md,
  },
  videosSectionHeader: {
    marginBottom: SPACING.md,
  },
  videosTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  liveTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E50914',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  liveTagBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  videosMainTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  videosSubTitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  videosListWrapper: {
    marginTop: 4,
  },
  videoLoadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  videoLoadingText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  emptyBox: {
    padding: 30,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: SPACING.xs,
  },
  emptyText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  showAllBtn: {
    backgroundColor: '#E50914',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  showAllBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
