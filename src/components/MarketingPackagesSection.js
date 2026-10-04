import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  useWindowDimensions,
  Platform,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import {
  MARKETING_PACKAGES,
  MARKETING_CATEGORIES,
  WHATSAPP_CONTACT_NUMBER,
} from '../constants/marketingPackages';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const MarketingPackagesSection = ({ style }) => {
  const { colors, isDarkMode } = useTheme();
  const { width } = useWindowDimensions();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const toggleDropdown = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((prev) => !prev);
  };

  const filteredPackages =
    selectedCategory === 'all'
      ? MARKETING_PACKAGES
      : MARKETING_PACKAGES.filter((p) => p.category === selectedCategory);

  const handleWhatsAppInquiry = (pkg) => {
    const text = `Hi Whiteswan TV News Marketing Desk,\n\nI am interested in the "${pkg.title}" package.\n\n• Price: ${pkg.priceFormatted} (${pkg.duration})\n• Ad Format: ${pkg.adType}\n• Category: ${pkg.categoryName}\n\nPlease share more details and booking process.`;
    const url = `https://wa.me/${WHATSAPP_CONTACT_NUMBER}?text=${encodeURIComponent(text)}`;
    Linking.openURL(url).catch((err) => console.error('Failed to open WhatsApp:', err));
  };

  const isTablet = width >= 768;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: isExpanded
            ? isDarkMode
              ? 'rgba(255, 255, 255, 0.16)'
              : colors.border
            : colors.border,
        },
        style,
      ]}
    >
      {/* Clickable Dropdown Header Bar */}
      <TouchableOpacity
        style={[
          styles.headerRow,
          isExpanded && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
            paddingBottom: SPACING.md,
          },
        ]}
        onPress={toggleDropdown}
        activeOpacity={0.75}
      >
        <View style={styles.headerLeft}>
          <View style={[styles.iconCircle, { backgroundColor: '#00A3E8' }]}>
            <Ionicons name="megaphone" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.headerTextContainer}>
            <View style={styles.titleRow}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Marketing & Ad Packages
              </Text>
              <View
                style={[
                  styles.countPill,
                  {
                    backgroundColor: isDarkMode
                      ? 'rgba(0, 163, 232, 0.2)'
                      : 'rgba(0, 163, 232, 0.12)',
                  },
                ]}
              >
                <Text style={styles.countPillText}>
                  {MARKETING_PACKAGES.length}
                </Text>
              </View>
            </View>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Website, App, YouTube & Social Ads
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.chevronCircle,
            {
              backgroundColor: isExpanded
                ? 'rgba(0, 163, 232, 0.15)'
                : colors.inputBg,
            },
          ]}
        >
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={isExpanded ? '#00A3E8' : colors.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {/* Expanded Content Only When Clicked */}
      {isExpanded && (
        <View style={styles.expandedBody}>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Promote your business across Whiteswan TV News portal, Mobile App, YouTube, and Social channels.
          </Text>

          {/* Category Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
          >
            {MARKETING_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor: isSelected
                        ? COLORS.primary
                        : isDarkMode
                        ? '#1E293B'
                        : '#F1F5F9',
                      borderColor: isSelected ? COLORS.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedCategory(cat.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={cat.icon}
                    size={14}
                    color={isSelected ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.categoryPillText,
                      { color: isSelected ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Packages Grid / List */}
          <View style={[styles.packagesGrid, isTablet && styles.packagesGridTablet]}>
            {filteredPackages.map((pkg) => (
              <View
                key={pkg.id}
                style={[
                  styles.packageCard,
                  isTablet && styles.packageCardTablet,
                  {
                    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                    borderColor: pkg.popular ? COLORS.primary : colors.border,
                    borderWidth: pkg.popular ? 1.5 : 1,
                  },
                ]}
              >
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.badgeRow}>
                    <View
                      style={[
                        styles.categoryBadge,
                        { backgroundColor: `${pkg.color}15`, borderColor: `${pkg.color}30` },
                      ]}
                    >
                      <Text style={[styles.categoryBadgeText, { color: pkg.color }]}>
                        {pkg.categoryName}
                      </Text>
                    </View>

                    {pkg.popular && (
                      <View style={styles.popularBadge}>
                        <Ionicons name="flame" size={11} color="#FFFFFF" />
                        <Text style={styles.popularBadgeText}>POPULAR</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.priceContainer}>
                    <Text style={[styles.priceText, { color: colors.text }]}>
                      {pkg.priceFormatted}
                    </Text>
                    <Text style={[styles.durationText, { color: colors.textSecondary }]}>
                      / {pkg.duration}
                    </Text>
                  </View>
                </View>

                {/* Title */}
                <Text style={[styles.packageTitle, { color: colors.text }]}>
                  {pkg.title}
                </Text>

                {/* Description */}
                <Text style={[styles.packageDescription, { color: colors.textSecondary }]}>
                  {pkg.description}
                </Text>

                {/* Ad Type Meta */}
                <View style={[styles.metaRow, { backgroundColor: isDarkMode ? '#1E293B' : '#EDF2F7' }]}>
                  <Ionicons name={pkg.icon} size={15} color={pkg.color} />
                  <Text style={[styles.metaText, { color: colors.text }]} numberOfLines={1}>
                    {pkg.adType}
                  </Text>
                </View>

                {/* Inquire on WhatsApp Button */}
                <TouchableOpacity
                  style={styles.inquireBtn}
                  onPress={() => handleWhatsAppInquiry(pkg)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-whatsapp" size={17} color="#FFFFFF" />
                  <Text style={styles.inquireBtnText}>Inquire on WhatsApp</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm,
    paddingRight: 8,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  countPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00A3E8',
  },
  headerSubtitle: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  chevronCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedBody: {
    marginTop: SPACING.md,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: SPACING.sm,
  },
  categoriesContainer: {
    gap: 8,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.md,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  packagesGrid: {
    gap: SPACING.md,
  },
  packagesGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  packageCard: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  packageCardTablet: {
    width: '48.5%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DC2626',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '800',
  },
  durationText: {
    fontSize: 11,
    fontWeight: '600',
  },
  packageTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 4,
  },
  packageTitleMl: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 6,
  },
  packageDescription: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: SPACING.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: SPACING.sm,
  },
  metaText: {
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
  },
  inquireBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    marginTop: 2,
  },
  inquireBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
