import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const BookmarkContext = createContext();

const GUEST_STORAGE_KEY = '@whiteswan_saved_articles_guest';

export const BookmarkProvider = ({ children }) => {
  const { user, isLoggedIn } = useAuth();
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Storage key is scoped to the logged-in user
  const storageKey = user?.id
    ? `@whiteswan_saved_articles_user_${user.id}`
    : GUEST_STORAGE_KEY;

  useEffect(() => {
    loadBookmarks();
  }, [user?.id, isLoggedIn]);

  const loadBookmarks = async () => {
    try {
      setLoading(true);
      if (!isLoggedIn || !user) {
        setBookmarks([]);
        return;
      }

      const data = await AsyncStorage.getItem(storageKey);
      if (data) {
        setBookmarks(JSON.parse(data));
      } else {
        setBookmarks([]);
      }
    } catch (error) {
      console.error('Failed to load bookmarks', error);
    } finally {
      setLoading(false);
    }
  };

  const isBookmarked = (postId) => {
    if (!isLoggedIn) return false;
    return bookmarks.some((item) => item.id === postId);
  };

  const toggleBookmark = async (post, navigation) => {
    // Enforce login requirement
    if (!isLoggedIn || !user) {
      Alert.alert(
        'Sign In Required',
        'Please sign in or create an account to save news articles to your personal reading list.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign In / Register',
            onPress: () => {
              if (navigation) {
                navigation.navigate('Login');
              }
            },
          },
        ]
      );
      return false;
    }

    try {
      let updated;
      if (isBookmarked(post.id)) {
        updated = bookmarks.filter((item) => item.id !== post.id);
      } else {
        const simplifiedPost = {
          id: post.id,
          title: post.title,
          excerpt: post.excerpt,
          content: post.content,
          featuredImage: post.featuredImage,
          date: post.date,
          timeAgo: post.timeAgo,
          link: post.link,
          categories: post.categories,
          categoryName: post.categoryName,
          authorName: post.authorName,
          authorAvatar: post.authorAvatar,
          savedAt: new Date().toISOString(),
        };
        updated = [simplifiedPost, ...bookmarks];
      }
      setBookmarks(updated);
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      return true;
    } catch (error) {
      console.error('Failed to toggle bookmark', error);
      return false;
    }
  };

  const removeBookmark = async (postId) => {
    if (!isLoggedIn || !user) return;
    try {
      const updated = bookmarks.filter((item) => item.id !== postId);
      setBookmarks(updated);
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to remove bookmark', error);
    }
  };

  const clearAllBookmarks = async () => {
    if (!isLoggedIn || !user) return;
    try {
      setBookmarks([]);
      await AsyncStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to clear bookmarks', error);
    }
  };

  return (
    <BookmarkContext.Provider
      value={{
        bookmarks,
        loading,
        isBookmarked,
        toggleBookmark,
        removeBookmark,
        clearAllBookmarks,
      }}
    >
      {children}
    </BookmarkContext.Provider>
  );
};

export const useBookmarks = () => useContext(BookmarkContext);
