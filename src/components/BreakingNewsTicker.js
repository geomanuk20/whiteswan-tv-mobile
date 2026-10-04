import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const BreakingNewsTicker = ({ items = [], onPressItem }) => {
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!items || items.length <= 1) return;

    const interval = setInterval(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -10,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentIndex((prev) => (prev + 1) % items.length);
        slideAnim.setValue(10);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [items]);

  if (!items || items.length === 0) return null;

  const currentItem = items[currentIndex];

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.badgeBg, borderColor: colors.border }]}
      activeOpacity={0.85}
      onPress={() => onPressItem && onPressItem(currentItem)}
    >
      {/* Large Article Thumbnail Image */}
      {currentItem?.featuredImage ? (
        <Animated.View style={{ opacity: fadeAnim }}>
          <Image
            source={{ uri: currentItem.featuredImage }}
            style={[styles.largeThumbnail, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
            resizeMode="cover"
          />
        </Animated.View>
      ) : null}

      {/* Right Column: Top Breaking News Badge + Headline Text */}
      <View style={styles.rightContent}>
        <View style={styles.topBadgeRow}>
          <View style={styles.badge}>
            <Ionicons name="flash" size={10} color="#FFFFFF" />
            <Text style={styles.badgeText}>BREAKING NEWS</Text>
          </View>
          {currentItem?.timeAgo ? (
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>
              {currentItem.timeAgo}
            </Text>
          ) : null}
        </View>

        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <Text
            numberOfLines={2}
            style={[styles.headline, { color: colors.text }]}
          >
            {currentItem?.title}
          </Text>
        </Animated.View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} style={{ marginRight: 4 }} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: 12,
    overflow: 'hidden',
  },
  largeThumbnail: {
    width: 76,
    height: 58,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  rightContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 5,
  },
  topBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: RADIUS.sm,
    gap: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  headline: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
});
