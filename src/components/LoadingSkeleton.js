import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SPACING, RADIUS } from '../constants/theme';

export const LoadingSkeleton = ({ count = 4, type = 'compact' }) => {
  const { colors } = useTheme();
  const animatedValue = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 0.8,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0.3,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  if (type === 'hero') {
    return (
      <View style={[styles.heroSkeleton, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Animated.View
          style={[
            styles.heroImageSkeleton,
            { backgroundColor: colors.skeletonBg, opacity: animatedValue },
          ]}
        />
        <View style={styles.heroContentSkeleton}>
          <Animated.View
            style={[
              styles.line,
              { width: '40%', height: 12, backgroundColor: colors.skeletonBg, opacity: animatedValue },
            ]}
          />
          <Animated.View
            style={[
              styles.line,
              { width: '90%', height: 16, marginTop: 8, backgroundColor: colors.skeletonBg, opacity: animatedValue },
            ]}
          />
          <Animated.View
            style={[
              styles.line,
              { width: '70%', height: 16, marginTop: 6, backgroundColor: colors.skeletonBg, opacity: animatedValue },
            ]}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.compactSkeleton,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.compactTextContainer}>
            <Animated.View
              style={[
                styles.line,
                { width: '35%', height: 10, backgroundColor: colors.skeletonBg, opacity: animatedValue },
              ]}
            />
            <Animated.View
              style={[
                styles.line,
                { width: '90%', height: 14, marginTop: 8, backgroundColor: colors.skeletonBg, opacity: animatedValue },
              ]}
            />
            <Animated.View
              style={[
                styles.line,
                { width: '70%', height: 14, marginTop: 6, backgroundColor: colors.skeletonBg, opacity: animatedValue },
              ]}
            />
            <Animated.View
              style={[
                styles.line,
                { width: '40%', height: 10, marginTop: 10, backgroundColor: colors.skeletonBg, opacity: animatedValue },
              ]}
            />
          </View>
          <Animated.View
            style={[
              styles.compactImageSkeleton,
              { backgroundColor: colors.skeletonBg, opacity: animatedValue },
            ]}
          />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
  },
  heroSkeleton: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroImageSkeleton: {
    width: '100%',
    height: 190,
  },
  heroContentSkeleton: {
    padding: SPACING.md,
  },
  compactSkeleton: {
    flexDirection: 'row',
    marginVertical: 6,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 12,
  },
  compactTextContainer: {
    flex: 1,
  },
  compactImageSkeleton: {
    width: 95,
    height: 85,
    borderRadius: RADIUS.md,
  },
  line: {
    borderRadius: 4,
  },
});
