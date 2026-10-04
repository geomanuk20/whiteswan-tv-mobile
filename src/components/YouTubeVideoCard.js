import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Share,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const YouTubeVideoCard = ({ video }) => {
  const { colors, isDarkMode } = useTheme();
  const { width } = useWindowDimensions();
  const [imgError, setImgError] = useState(false);

  if (!video) return null;

  const isSmall = width < 360;
  const isTablet = width >= 768;
  const thumbHeight = isTablet ? 260 : Math.max(170, Math.min(width * 0.52, 230));

  const handleWatch = () => {
    if (video.url) {
      Linking.openURL(video.url).catch((err) =>
        console.error('Failed to open YouTube video:', err)
      );
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: video.title,
        message: `${video.title}\n\nWatch on Whiteswan TV News YouTube:\n${video.url}`,
        url: video.url,
      });
    } catch (e) {}
  };

  const fallbackThumb = 'https://whiteswantvnews.com/wp-content/uploads/2025/12/download.png';
  const thumbUri = !imgError && video.thumbnail ? video.thumbnail : fallbackThumb;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
          borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        },
      ]}
      onPress={handleWatch}
      activeOpacity={0.88}
    >
      {/* Video Thumbnail Container */}
      <View style={[styles.thumbContainer, { height: thumbHeight }]}>
        <Image
          source={{ uri: thumbUri }}
          style={styles.thumbnail}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />

        {/* Gradient Overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.15)', 'transparent', 'rgba(0,0,0,0.85)']}
          style={StyleSheet.absoluteFillObject}
        />

        {/* YouTube Play Button Overlay */}
        <View style={styles.playButtonCircle}>
          <Ionicons name="play" size={24} color="#FFFFFF" style={{ marginLeft: 3 }} />
        </View>

        {/* Top Badges (Today / Yesterday / Channel) */}
        <View style={styles.topBadgeRow}>
          {video.isToday ? (
            <View style={[styles.datePill, { backgroundColor: '#E50914' }]}>
              <View style={styles.livePulseDot} />
              <Text style={styles.datePillText}>TODAY</Text>
            </View>
          ) : video.isYesterday ? (
            <View style={[styles.datePill, { backgroundColor: '#D97706' }]}>
              <Text style={styles.datePillText}>YESTERDAY</Text>
            </View>
          ) : (
            <View style={[styles.datePill, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
              <Text style={styles.datePillText}>{video.timeAgo}</Text>
            </View>
          )}

          <View style={styles.channelBadgePill}>
            <Ionicons name="logo-youtube" size={11} color="#FF0000" style={{ marginRight: 4 }} />
            <Text style={styles.channelBadgeText} numberOfLines={1}>
              {video.channelTitle?.replace('Whiteswan ', '')}
            </Text>
          </View>
        </View>

        {/* Bottom Time Badge */}
        <View style={styles.bottomMeta}>
          <Text style={styles.bottomMetaTime}>{video.timeAgo}</Text>
        </View>
      </View>

      {/* Video Content / Title / Actions */}
      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            {
              color: colors.text,
              fontSize: isSmall ? 13.5 : isTablet ? 16 : 14.5,
              lineHeight: isSmall ? 19 : isTablet ? 22 : 20,
            },
          ]}
          numberOfLines={2}
        >
          {video.title}
        </Text>

        <View style={styles.footerRow}>
          <View style={styles.channelInfoRow}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.miniLogo}
              resizeMode="contain"
            />
            <Text style={[styles.channelNameText, { color: colors.textSecondary }]} numberOfLines={1}>
              {video.channelTitle}
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <Ionicons name="share-social-outline" size={15} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.watchBtn}
              onPress={handleWatch}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-youtube" size={13} color="#FFFFFF" />
              <Text style={styles.watchBtnText}>Watch</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  thumbContainer: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  playButtonCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(229, 9, 20, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
  topBadgeRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    gap: 5,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  datePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  channelBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  channelBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  bottomMeta: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bottomMetaTime: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  content: {
    padding: SPACING.md,
  },
  title: {
    fontWeight: '700',
    marginBottom: 10,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  channelInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  miniLogo: {
    width: 24,
    height: 16,
  },
  channelNameText: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E50914',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 5,
  },
  watchBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
