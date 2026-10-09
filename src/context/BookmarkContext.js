import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { SignInPromptModal } from '../components/SignInPromptModal';
import { navigationRef } from '../navigation/navigationService';

const BookmarkContext = createContext();

const GUEST_STORAGE_KEY = '@whiteswan_saved_articles_guest';

export const BookmarkProvider = ({ children }) => {
  const { user, isLoggedIn } = useAuth();
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Custom Sign-In Modal State
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    title: 'Sign In Required',
    subtitle: 'Please sign in or create an account to save news articles to your personal reading list.',
  });

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

  const showSignInModal = (customTitle, customSubtitle) => {
    setModalConfig({
      visible: true,
      title: customTitle || 'Sign In Required',
      subtitle:
        customSubtitle ||
        'Please sign in or create an account to save news articles to your personal reading list.',
    });
  };

  const hideSignInModal = () => {
    setModalConfig((prev) => ({ ...prev, visible: false }));
  };

  const handleModalSignIn = () => {
    hideSignInModal();
    if (navigationRef?.isReady?.()) {
      navigationRef.navigate('Login');
    }
  };

  const toggleBookmark = async (post, navigation) => {
    // Enforce login requirement with custom suitable modal
    if (!isLoggedIn || !user) {
      showSignInModal();
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
        showSignInModal,
        hideSignInModal,
      }}
    >
      {children}
      <SignInPromptModal
        visible={modalConfig.visible}
        title={modalConfig.title}
        subtitle={modalConfig.subtitle}
        onClose={hideSignInModal}
        onSignIn={handleModalSignIn}
      />
    </BookmarkContext.Provider>
  );
};

export const useBookmarks = () => useContext(BookmarkContext);
