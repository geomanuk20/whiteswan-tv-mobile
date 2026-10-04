import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useBookmarks } from '../context/BookmarkContext';
import { NewsCard } from '../components/NewsCard';
import { EmptyState } from '../components/EmptyState';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const BookmarksScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDarkMode } = useTheme();
  const isTablet = width >= 768;
  const { user, isLoggedIn } = useAuth();
  const { bookmarks, clearAllBookmarks } = useBookmarks();
  const [showClearModal, setShowClearModal] = useState(false);

  const handleClearAll = () => {
    if (bookmarks.length === 0) return;
    setShowClearModal(true);
  };

  const confirmClearAll = async () => {
    setShowClearModal(false);
    if (clearAllBookmarks) {
      await clearAllBookmarks();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Info Bar */}
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
        <View style={styles.countBadge}>
          <Text style={[styles.countText, { color: colors.text }]}>
            {isLoggedIn ? `${bookmarks.length} Saved Article${bookmarks.length === 1 ? '' : 's'}` : 'Saved Articles'}
          </Text>
        </View>

        {isLoggedIn && bookmarks.length > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClearAll}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color={COLORS.primary} />
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* When NOT Logged In: Show Sign In Requirement Screen */}
      {!isLoggedIn ? (
        <View style={styles.loginPromptContainer}>
          <View style={[styles.iconCircle, { backgroundColor: colors.badgeBg }]}>
            <Ionicons name="bookmark" size={48} color={COLORS.primary} />
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
            </View>
          </View>
          <Text style={[styles.loginPromptTitle, { color: colors.text }]}>
            Sign In to View Saved Articles
          </Text>
          <Text style={[styles.loginPromptSubtitle, { color: colors.textSecondary }]}>
            Create a free Whiteswan account or sign in to save your favorite news, read offline, and access your reading list across all your devices.
          </Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
          >
            <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
            <Text style={styles.loginBtnText}>Sign In / Register</Text>
          </TouchableOpacity>
        </View>
      ) : bookmarks.length === 0 ? (
        <EmptyState
          icon="bookmark-outline"
          title="No Saved Articles"
          subtitle="Tap the bookmark icon on any article to save it for reading later."
          buttonText="Explore News"
          onRetry={() => navigation.navigate('Home')}
        />
      ) : (
        <FlatList
          data={bookmarks}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <NewsCard
              post={item}
              onPress={(selected) => navigation.navigate('ArticleDetail', { post: selected })}
              variant="compact"
            />
          )}
          contentContainerStyle={[
            { paddingVertical: 10 },
            isTablet && { maxWidth: 760, alignSelf: 'center', width: '100%' },
          ]}
        />
      )}

      {/* Custom Designed Clear All Confirmation Modal */}
      <Modal
        visible={showClearModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClearModal(false)}
      >
        <View style={styles.clearModalOverlay}>
          <View
            style={[
              styles.clearModalCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.clearIconBadge}>
              <Ionicons name="trash-outline" size={28} color="#EF4444" />
            </View>

            <Text style={[styles.clearModalTitle, { color: colors.text }]}>
              Clear All Saved Articles
            </Text>

            <Text style={[styles.clearModalMessage, { color: colors.textSecondary }]}>
              Are you sure you want to remove all saved news articles from your reading list?
            </Text>

            <View style={styles.clearButtonRow}>
              <TouchableOpacity
                style={[
                  styles.clearCancelBtn,
                  { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' },
                ]}
                onPress={() => setShowClearModal(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.clearCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.clearConfirmBtn}
                onPress={confirmClearAll}
                activeOpacity={0.8}
              >
                <Ionicons name="trash" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.clearConfirmText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countText: {
    fontSize: 14,
    fontWeight: '700',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  loginPromptContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: 12,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  lockBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  loginPromptTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  loginPromptSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
    marginBottom: 8,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: RADIUS.full,
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  clearModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  clearModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 22,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  clearIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EF444418',
    borderWidth: 1.5,
    borderColor: '#EF444430',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  clearModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  clearModalMessage: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 6,
  },
  clearButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  clearCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  clearConfirmBtn: {
    flex: 1.2,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  clearConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
