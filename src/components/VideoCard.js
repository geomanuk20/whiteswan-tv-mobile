import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const VideoCard = ({ channel, type = 'youtube', onWatchLive }) => {
  const { colors, isDarkMode } = useTheme();

  const handleOpenChannel = () => {
    if (channel.url) {
      Linking.openURL(channel.url).catch((err) =>
        console.error('Failed to open channel link:', err)
      );
    }
  };

  const channelColor = channel.color || (type === 'facebook' ? '#1877F2' : type === 'instagram' ? '#E1306C' : '#E50914');
  const platformIcon = channel.icon || (type === 'facebook' ? 'logo-facebook' : type === 'instagram' ? 'logo-instagram' : 'logo-youtube');

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
        },
      ]}
    >
      {/* Background Cover Image */}
      {channel.image ? (
        <Image
          source={{ uri: channel.image }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      ) : null}

      {/* Rich Dark Gradient Overlay for Contrast */}
      <LinearGradient
        colors={[
          'rgba(15, 23, 42, 0.45)',
          'rgba(15, 23, 42, 0.85)',
          'rgba(15, 23, 42, 0.97)',
        ]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top Accent Stripe */}
      <View style={[styles.topAccentBar, { backgroundColor: channelColor }]} />

      {/* Header with Avatar & Platform Badge */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: channel.avatar || channel.image }}
            style={styles.avatar}
          />
          <View style={[styles.platformBadgeIcon, { backgroundColor: channelColor }]}>
            <Ionicons name={platformIcon} size={11} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.titleInfo}>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: `${channelColor}40`, borderColor: channelColor, borderWidth: 1 }]}>
              <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>
                {channel.badge || 'OFFICIAL'}
              </Text>
            </View>
            {channel.tag && (
              <View style={styles.tagBadge}>
                <Text style={styles.tagText}>{channel.tag}</Text>
              </View>
            )}
          </View>

          <Text style={styles.channelTitle} numberOfLines={1}>
            {channel.title}
          </Text>

          {channel.titleMl && (
            <Text style={styles.channelTitleMl} numberOfLines={1}>
              {channel.titleMl}
            </Text>
          )}

          <Text style={styles.handle}>
            {channel.handle}
          </Text>
        </View>
      </View>

      {/* Channel Description */}
      {channel.description && (
        <Text style={styles.description} numberOfLines={2}>
          {channel.description}
        </Text>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            {
              backgroundColor: channelColor,
            },
          ]}
          onPress={handleOpenChannel}
          activeOpacity={0.82}
        >
          <Ionicons name={platformIcon} size={16} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>
            {type === 'facebook'
              ? 'Visit Facebook Page'
              : type === 'instagram'
              ? 'Follow on Instagram'
              : 'Watch & Subscribe on YouTube'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SPACING.md,
    marginVertical: 7,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1E293B',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  topAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#334155',
  },
  platformBadgeIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  titleInfo: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tagBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    color: '#E2E8F0',
    fontSize: 9.5,
    fontWeight: '600',
  },
  channelTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  channelTitleMl: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  handle: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  description: {
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(241, 245, 249, 0.9)',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  watchLiveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    gap: 5,
  },
  watchLiveText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    gap: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  actionBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
