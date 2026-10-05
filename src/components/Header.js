import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, useWindowDimensions, Linking } from 'react-native';
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
  const logoWidth = isSmall ? 110 : width > 600 ? 160 : 130;
  const logoHeight = isSmall ? 34 : width > 600 ? 46 : 38;

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
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          paddingTop: Math.max(insets.top, 12) + 4,
        },
      ]}
    >
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
              style={[styles.iconButton, { backgroundColor: colors.inputBg }]}
              onPress={onSearchPress}
              activeOpacity={0.7}
            >
              <Ionicons name="search-outline" size={18} color={colors.text} />
            </TouchableOpacity>
          )}

          {/* Account / Profile Button */}
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.inputBg }]}
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
                color={colors.text}
              />
            )}
          </TouchableOpacity>

          {/* Dark / Light Toggle */}
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.inputBg }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isDarkMode ? 'sunny-outline' : 'moon-outline'}
              size={18}
              color={isDarkMode ? COLORS.gold : colors.text}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
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
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: RADIUS.full,
    gap: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
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
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: RADIUS.full,
    gap: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
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
  },
  headerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});
