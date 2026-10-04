import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { DEFAULT_CATEGORIES } from '../constants/categories';

export const CategoryPills = ({ selectedCategory, onSelectCategory }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {DEFAULT_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;

          return (
            <TouchableOpacity
              key={cat.id ?? 'all'}
              onPress={() => onSelectCategory(cat.id)}
              activeOpacity={0.7}
              style={[
                styles.pill,
                {
                  backgroundColor: isSelected ? COLORS.primary : colors.inputBg,
                  borderColor: isSelected ? COLORS.primary : colors.border,
                },
              ]}
            >
              <Ionicons
                name={cat.icon}
                size={14}
                color={isSelected ? '#FFFFFF' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.pillText,
                  {
                    color: isSelected ? '#FFFFFF' : colors.text,
                    fontWeight: isSelected ? '700' : '600',
                  },
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: SPACING.sm,
  },
  container: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 5,
  },
  pillText: {
    fontSize: 13,
  },
});
