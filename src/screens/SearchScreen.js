import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { NewsCard } from '../components/NewsCard';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { fetchPosts } from '../services/wpApi';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

const TRENDING_TAGS = [
  'Kerala',
  'Politics',
  'Cinema',
  'Sports',
  'Crime',
  'Gold Rate',
  'Gulf News',
  'Business',
  'Education',
  'Global',
];

export const SearchScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const isTablet = width >= 768;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const searchTimeout = useRef(null);

  const performSearch = async (searchTerm) => {
    if (!searchTerm || searchTerm.trim().length === 0) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setSearched(true);
      const data = await fetchPosts({ page: 1, perPage: 15, search: searchTerm.trim() });
      setResults(data.posts);
    } catch (e) {
      console.error('Search error:', e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQueryChange = (text) => {
    setQuery(text);
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (text.trim().length >= 2) {
      searchTimeout.current = setTimeout(() => {
        performSearch(text);
      }, 500);
    } else {
      setResults([]);
      setSearched(false);
    }
  };

  const handleTagPress = (tag) => {
    setQuery(tag);
    Keyboard.dismiss();
    performSearch(tag);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Input Bar */}
      <View
        style={[
          styles.searchBarWrapper,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: Math.max(insets.top, 12) + 4,
          },
        ]}
      >
        <View style={[styles.searchInputContainer, { backgroundColor: colors.inputBg }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Search news..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={handleQueryChange}
            returnKeyType="search"
            onSubmitEditing={() => performSearch(query)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton count={4} />
      ) : searched && results.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No Articles Found"
          subtitle={`No results found for "${query}". Try searching with different keywords.`}
          onRetry={() => performSearch(query)}
        />
      ) : results.length > 0 ? (
        <FlatList
          data={results}
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
      ) : (
        /* Trending Search Suggestions */
        <View style={[styles.suggestionsContainer, isTablet && { maxWidth: 760, alignSelf: 'center', width: '100%' }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trending-up" size={18} color={COLORS.primary} />
            <Text style={[styles.suggestionsTitle, { color: colors.text }]}>
              Trending Topics
            </Text>
          </View>

          <View style={styles.tagsGrid}>
            {TRENDING_TAGS.map((tag, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.tag, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                onPress={() => handleTagPress(tag)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tagText, { color: colors.text }]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBarWrapper: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    height: 44,
  },
  input: {
    flex: 1,
    height: '100%',
    marginLeft: 8,
    fontSize: 15,
  },
  clearBtn: {
    padding: 4,
  },
  suggestionsContainer: {
    padding: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.md,
  },
  suggestionsTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
