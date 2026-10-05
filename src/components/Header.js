import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageBackground, useWindowDimensions, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  const logoWidth = isSmall ? 115 : width > 600 ? 165 : 138;
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

  const gradientColors = isDarkMode
    ? ['rgba(8, 14, 28, 0.72)', 'rgba(8, 14, 28, 0.94)']
    : ['rgba(255, 255, 255, 0.78)', 'rgba(255, 255, 255, 0.92)'];

  const iconBtnBg = isDarkMode
    ? 'rgba(255, 255, 255, 0.12)'
    : 'rgba(255, 255, 255, 0.88)';

  const iconBtnBorder = isDarkMode
    ? 'rgba(255, 255, 255, 0.15)'
    : 'rgba(0, 163, 232, 0.18)';

  return (
    <ImageBackground
      source={require('../../assets/header-bg.png')}
      style={styles.headerBg}
      resizeMode="cover"
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.overlay,
          {
            paddingTop: Math.max(insets.top, 12) + 4,
            borderBottomColor: isDarkMode ? 'rgba(0, 163, 232, 0.2)' : 'rgba(0, 163, 232, 0.12)',
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
            {/* Premium Badge for Subscribed User OR Subscribe Button */}
            {user?.isPremium || user?.role === 'Premium VIP' ? (
              <TouchableOpacity
                onPress={handlePremiumPress}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#00A3E8', '#0077B6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.vipBadgeButton}
                >
                  <Ionicons name="diamond" size={13} color="#FFFFFF" />
                  <Text style={styles.vipBadgeText}>Premium</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handlePremiumPress}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#00A3E8', '#0284C7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.subscribeIconButton}
                >
                  <Ionicons name="diamond-outline" size={13} color="#FFFFFF" />
                  <Text style={styles.subscribeIconText}>Premium</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Search Button */}
            {onSearchPress && (
              <TouchableOpacity
                style={[
                  styles.iconButton,
                  {
                    backgroundColor: iconBtnBg,
                    borderColor: iconBtnBorder,
                  },
                ]}
                onPress={onSearchPress}
                activeOpacity={0.7}
              >
                <Ionicons name="search-outline" size={18} color={isDarkMode ? '#F1F5F9' : '#0F172A'} />
              </TouchableOpacity>
            )}

            {/* Account / Profile Button */}
            <TouchableOpacity
              style={[
                styles.iconButton,
                {
                  backgroundColor: iconBtnBg,
                  borderColor: iconBtnBorder,
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
                  color={isDarkMode ? '#F1F5F9' : '#0F172A'}
                />
              )}
            </TouchableOpacity>

            {/* Dark / Light Toggle */}
            <TouchableOpacity
              style={[
                styles.iconButton,
                {
                  backgroundColor: iconBtnBg,
                  borderColor: iconBtnBorder,
                },
              ]}
              onPress={toggleTheme}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isDarkMode ? 'sunny' : 'moon'}
                size={18}
                color={isDarkMode ? COLORS.gold : '#1E293B'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  headerBg: {
    width: '100%',
    overflow: 'hidden',
  },
  overlay: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm + 2,
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
    gap: 7,
  },
  subscribeIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 4,
    shadowColor: '#00A3E8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
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
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 4,
    shadowColor: '#00A3E8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  headerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});
export default Header;
