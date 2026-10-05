import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Keyboard,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { fetchComments, createComment } from '../services/wpApi';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

const GUEST_STORAGE_KEY = '@wp_guest_commenter_info';

export const CommentSection = ({ postId, postTitle }) => {
  const { colors, isDarkMode } = useTheme();
  const { user, isLoggedIn, token } = useAuth();

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // { id, authorName }

  // Form fields
  const [content, setContent] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [saveInfo, setSaveInfo] = useState(true);
  const [likedComments, setLikedComments] = useState({});
  const [commentLikesCount, setCommentLikesCount] = useState({});

  const inputRef = useRef(null);

  // Load saved guest details
  useEffect(() => {
    const loadGuestInfo = async () => {
      if (!isLoggedIn) {
        try {
          const saved = await AsyncStorage.getItem(GUEST_STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.name) setGuestName(parsed.name);
            if (parsed.email) setGuestEmail(parsed.email);
          }
        } catch (_) {}
      }
    };
    loadGuestInfo();
  }, [isLoggedIn]);

  // Fetch comments when postId changes
  useEffect(() => {
    if (postId) {
      loadComments();
    }
  }, [postId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const data = await fetchComments(postId);
      setComments(data);
    } catch (e) {
      console.warn('Error fetching comments:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReplyPress = (comment) => {
    setReplyingTo(comment);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const handleToggleLike = (commentId) => {
    setLikedComments((prev) => {
      const isLiked = !prev[commentId];
      setCommentLikesCount((cPrev) => ({
        ...cPrev,
        [commentId]: (cPrev[commentId] || 0) + (isLiked ? 1 : -1),
      }));
      return { ...prev, [commentId]: isLiked };
    });
  };

  const handleSubmit = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      Alert.alert('Validation Error', 'Please type your comment before posting.');
      return;
    }

    let authorName = user?.name || guestName.trim();
    let authorEmail = user?.email || guestEmail.trim();

    if (!isLoggedIn) {
      if (!authorName) {
        Alert.alert('Name Required', 'Please enter your name to post a comment.');
        return;
      }
      if (!authorEmail) {
        Alert.alert('Email Required', 'Please enter your email address to post a comment.');
        return;
      }

      // Simple email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(authorEmail)) {
        Alert.alert('Invalid Email', 'Please provide a valid email address.');
        return;
      }

      if (saveInfo) {
        AsyncStorage.setItem(
          GUEST_STORAGE_KEY,
          JSON.stringify({ name: authorName, email: authorEmail })
        ).catch(() => {});
      }
    }

    try {
      setSubmitting(true);
      Keyboard.dismiss();

      const newComment = await createComment({
        postId,
        authorName,
        authorEmail,
        content: trimmedContent,
        parentId: replyingTo?.id || 0,
        token,
      });

      // Optimistically add comment to list
      if (newComment) {
        setComments((prev) => [...prev, newComment]);
      }

      setContent('');
      setReplyingTo(null);

      Alert.alert(
        'Comment Submitted',
        'Thank you! Your comment has been posted and will appear on the article.'
      );
    } catch (error) {
      Alert.alert('Submission Error', error?.message || 'Failed to submit comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Group root comments and child replies
  const rootComments = comments.filter((c) => !c.parent || c.parent === 0);
  const repliesMap = {};
  comments.forEach((c) => {
    if (c.parent && c.parent > 0) {
      if (!repliesMap[c.parent]) {
        repliesMap[c.parent] = [];
      }
      repliesMap[c.parent].push(c);
    }
  });

  const renderCommentItem = (comment, isReply = false) => {
    const isLiked = !!likedComments[comment.id];
    const likesCount = commentLikesCount[comment.id] || 0;
    const replies = repliesMap[comment.id] || [];

    return (
      <View
        key={`comment_${comment.id}`}
        style={[
          styles.commentCard,
          isReply && styles.replyCard,
          {
            backgroundColor: isDarkMode ? '#131D31' : '#F8FAFC',
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.commentHeader}>
          <Image
            source={{ uri: comment.authorAvatar }}
            style={isReply ? styles.replyAvatar : styles.commentAvatar}
          />
          <View style={styles.authorMeta}>
            <View style={styles.nameRow}>
              <Text style={[styles.authorName, { color: colors.text }]}>
                {comment.authorName}
              </Text>
              {comment.status === 'hold' && (
                <View style={styles.holdBadge}>
                  <Text style={styles.holdBadgeText}>Pending Moderation</Text>
                </View>
              )}
            </View>
            <Text style={[styles.commentTime, { color: colors.textSecondary }]}>
              {comment.timeAgo || 'Recent'}
            </Text>
          </View>
        </View>

        <Text style={[styles.commentContent, { color: colors.text }]}>
          {comment.content}
        </Text>

        <View style={styles.commentActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleToggleLike(comment.id)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={15}
              color={isLiked ? '#EF4444' : colors.textSecondary}
            />
            <Text
              style={[
                styles.actionBtnText,
                { color: isLiked ? '#EF4444' : colors.textSecondary },
              ]}
            >
              {likesCount > 0 ? `${likesCount}` : 'Like'}
            </Text>
          </TouchableOpacity>

          {!isReply && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleReplyPress(comment)}
              activeOpacity={0.7}
            >
              <Ionicons name="return-down-forward" size={15} color={COLORS.primary} />
              <Text style={[styles.actionBtnText, { color: COLORS.primary, fontWeight: '700' }]}>
                Reply
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Nested Child Replies */}
        {replies.length > 0 && (
          <View style={styles.nestedRepliesContainer}>
            {replies.map((reply) => renderCommentItem(reply, true))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { borderTopColor: colors.border }]}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="chatbubbles" size={20} color={COLORS.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Comments ({comments.length})
          </Text>
        </View>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          അഭിപ്രായങ്ങൾ പങ്കുവെക്കൂ
        </Text>
      </View>

      {/* Replying-to Banner */}
      {replyingTo && (
        <View
          style={[
            styles.replyingBanner,
            { backgroundColor: isDarkMode ? '#1E293B' : '#E0F2FE', borderColor: COLORS.primary },
          ]}
        >
          <View style={styles.replyingTextCol}>
            <Text style={[styles.replyingLabel, { color: COLORS.primary }]}>
              Replying to @{replyingTo.authorName}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.replyingSnippet, { color: colors.textSecondary }]}
            >
              "{replyingTo.content}"
            </Text>
          </View>
          <TouchableOpacity onPress={cancelReply} style={styles.cancelReplyBtn}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Comment Input Box */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        {/* User preview */}
        {isLoggedIn ? (
          <View style={styles.loggedInUserRow}>
            <Image
              source={{
                uri:
                  user?.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=00A3E8&color=fff&bold=true`,
              }}
              style={styles.inputUserAvatar}
            />
            <Text style={[styles.loggedInAsText, { color: colors.textSecondary }]}>
              Posting as <Text style={{ color: colors.text, fontWeight: '700' }}>{user?.name}</Text>
            </Text>
          </View>
        ) : (
          <View style={styles.guestFieldsContainer}>
            <View style={styles.guestInputRow}>
              <View style={[styles.guestInputWrapper, { backgroundColor: colors.inputBg }]}>
                <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                <TextInput
                  placeholder="Your Name *"
                  placeholderTextColor={colors.textSecondary}
                  value={guestName}
                  onChangeText={setGuestName}
                  style={[styles.guestTextInput, { color: colors.text }]}
                />
              </View>
              <View style={[styles.guestInputWrapper, { backgroundColor: colors.inputBg }]}>
                <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
                <TextInput
                  placeholder="Your Email *"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={guestEmail}
                  onChangeText={setGuestEmail}
                  style={[styles.guestTextInput, { color: colors.text }]}
                />
              </View>
            </View>
          </View>
        )}

        {/* Text Input */}
        <TextInput
          ref={inputRef}
          multiline
          numberOfLines={3}
          placeholder={
            replyingTo
              ? `Write a reply to ${replyingTo.authorName}...`
              : 'Write your thoughts or opinion here...'
          }
          placeholderTextColor={colors.textSecondary}
          value={content}
          onChangeText={setContent}
          style={[
            styles.mainTextInput,
            {
              backgroundColor: colors.inputBg,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
        />

        {/* Submit Bar */}
        <View style={styles.submitBar}>
          {!isLoggedIn && (
            <TouchableOpacity
              style={styles.saveInfoRow}
              onPress={() => setSaveInfo(!saveInfo)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={saveInfo ? 'checkbox' : 'square-outline'}
                size={16}
                color={saveInfo ? COLORS.primary : colors.textSecondary}
              />
              <Text style={[styles.saveInfoText, { color: colors.textSecondary }]}>
                Remember details
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.submitBtn,
              {
                backgroundColor: content.trim().length > 0 ? COLORS.primary : colors.border,
                opacity: submitting ? 0.7 : 1,
              },
            ]}
            onPress={handleSubmit}
            disabled={submitting || content.trim().length === 0}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>Post Comment</Text>
                <Ionicons name="send" size={14} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Comments List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading comments...
          </Text>
        </View>
      ) : rootComments.length === 0 ? (
        <View
          style={[
            styles.emptyContainer,
            { backgroundColor: isDarkMode ? '#131D31' : '#F8FAFC', borderColor: colors.border },
          ]}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No comments yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Be the first to share your thoughts on this story!
          </Text>
        </View>
      ) : (
        <View style={styles.commentsList}>
          {rootComments.map((comment) => renderCommentItem(comment))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.xl,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
  },
  sectionHeader: {
    marginBottom: SPACING.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  replyingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  replyingTextCol: {
    flex: 1,
    marginRight: 8,
  },
  replyingLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  replyingSnippet: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  cancelReplyBtn: {
    padding: 4,
  },
  inputContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  loggedInUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  inputUserAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  loggedInAsText: {
    fontSize: 12,
  },
  guestFieldsContainer: {
    marginBottom: 10,
  },
  guestInputRow: {
    flexDirection: 'column',
    gap: 8,
  },
  guestInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 8,
    height: 38,
    gap: 6,
  },
  guestTextInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  mainTextInput: {
    minHeight: 75,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  submitBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  saveInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  saveInfoText: {
    fontSize: 12,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    gap: 6,
    marginLeft: 'auto',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  commentsList: {
    gap: 12,
  },
  commentCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  replyCard: {
    marginTop: 8,
    marginLeft: 16,
    borderLeftWidth: 2.5,
    borderLeftColor: COLORS.primary,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  replyAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  authorMeta: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
  },
  holdBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  holdBadgeText: {
    color: '#92400E',
    fontSize: 10,
    fontWeight: '700',
  },
  commentTime: {
    fontSize: 11,
    marginTop: 1,
  },
  commentContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
  },
  nestedRepliesContainer: {
    marginTop: 4,
  },
});

export default CommentSection;
