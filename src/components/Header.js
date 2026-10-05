import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageBackground, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const Header = ({ onSearchPress, onPremiumPress, onProfilePress }) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const { user, isLoggedIn } = useAuth();
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [user?.avatar]);

  const isSmall = width < 360;
  const logoWidth = isSmall ? 115 : width > 600 ? 165 : 135;
  const logoHeight = isSmall ? 36 : width > 600 ? 48 : 40;

  const handleAccountPress = () => {
    if (onProfilePress) {
      onProfilePress();
    } else {
      try {
        navigation.navigate('Account');
      } catch (e) {
        navigation.navigate('Profile');
      }
    }
  };

  const handlePremiumPress = () => {
    if (onPremiumPress) {
      onPremiumPress();
    } else {
      navigation.navigate('PremiumPlans');
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/header-bg.png')}
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 12) + 4,
          borderBottomColor: isDarkMode ? 'rgba(0, 163, 232, 0.25)' : colors.border,
        },
      ]}
      resizeMode="cover"
    >
      {/* Subtle backdrop overlay for enhanced contrast */}
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: isDarkMode
              ? 'rgba(7, 13, 24, 0.45)'
              : 'rgba(248, 250, 252, 0.15)',
          },
        ]}
      />

      <View style={styles.topRow}>
        {/* Official Brand Logo */}
        <View style={styles.brandContainer}>
          <Image
            source={require('../../assets/logo.png')}
            style={{ width: logoWidth, height: logoHeight }}
            resizeMode="contain"
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {/* Premium Badge for Subscribed User OR Subscribe Button for Non-Subscribed */}
          {user?.isPremium || user?.role === 'Premium VIP' ? (
            <TouchableOpacity
              style={[styles.vipBadgeButton, { backgroundColor: COLORS.primary }]}
              onPress={handlePremiumPress}
              activeOpacity={0.8}
            >
              <Ionicons name="diamond" size={13} color="#FFFFFF" />
              <Text style={styles.vipBadgeText}>Premium</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.subscribeIconButton, { backgroundColor: COLORS.primary }]}
              onPress={handlePremiumPress}
              activeOpacity={0.8}
            >
              <Ionicons name="diamond-outline" size={14} color="#FFFFFF" />
              <Text style={styles.subscribeIconText}>Subscribe</Text>
            </TouchableOpacity>
          )}

          {/* Search Button */}
          {onSearchPress && (
            <TouchableOpacity
              style={[
                styles.iconButton,
                {
                  backgroundColor: isDarkMode
                    ? 'rgba(255, 255, 255, 0.14)'
                    : 'rgba(255, 255, 255, 0.88)',
                  borderColor: isDarkMode
                    ? 'rgba(255, 255, 255, 0.18)'
                    : 'rgba(0, 163, 232, 0.25)',
                },
              ]}
              onPress={onSearchPress}
              activeOpacity={0.7}
            >
              <Ionicons
                name="search-outline"
                size={18}
                color={isDarkMode ? '#FFFFFF' : COLORS.textPrimary}
              />
            </TouchableOpacity>
          )}

          {/* Account / Profile Button */}
          <TouchableOpacity
            style={[
              styles.iconButton,
              {
                backgroundColor: isDarkMode
                  ? 'rgba(255, 255, 255, 0.14)'
                  : 'rgba(255, 255, 255, 0.88)',
                borderColor: isDarkMode
                  ? 'rgba(255, 255, 255, 0.18)'
                  : 'rgba(0, 163, 232, 0.25)',
              },
            ]}
            onPress={handleAccountPress}
            activeOpacity={0.7}
          >
            {isLoggedIn && user?.avatar && !imgError ? (
              <Image
                key={`header_avatar_${user.avatar}_${user.avatarUpdatedAt || ''}`}
                source={{
                  uri: user.avatar,
                  ...(user.avatar.startsWith('http') ? { cache: 'reload' } : {}),
                }}
                style={styles.headerAvatar}
                onError={() => setImgError(true)}
              />
            ) : (
              <Ionicons
                name="person-outline"
                size={18}
                color={isDarkMode ? '#FFFFFF' : COLORS.textPrimary}
              />
            )}
          </TouchableOpacity>

          {/* Dark / Light Toggle */}
          <TouchableOpacity
            style={[
              styles.iconButton,
              {
                backgroundColor: isDarkMode
                  ? 'rgba(255, 255, 255, 0.14)'
                  : 'rgba(255, 255, 255, 0.88)',
                borderColor: isDarkMode
                  ? 'rgba(255, 255, 255, 0.18)'
                  : 'rgba(0, 163, 232, 0.25)',
              },
            ]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isDarkMode ? 'sunny-outline' : 'moon-outline'}
              size={18}
              color={isDarkMode ? COLORS.gold : COLORS.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm + 2,
    borderBottomWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    zIndex: 1,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subscribeIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 4.5,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  subscribeIconText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  vipBadgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 4.5,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  vipBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  headerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});
