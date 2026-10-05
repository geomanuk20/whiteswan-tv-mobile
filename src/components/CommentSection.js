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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { fetchComments, createComment } from '../services/wpApi';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const CommentSection = ({ postId, postTitle }) => {
  const navigation = useNavigation();
  const { colors, isDarkMode } = useTheme();
  const { user, isLoggedIn, token } = useAuth();

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // { id, authorName }
  const [content, setContent] = useState('');
  const [likedComments, setLikedComments] = useState({});
  const [commentLikesCount, setCommentLikesCount] = useState({});

  const inputRef = useRef(null);

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
    if (!isLoggedIn) {
      Alert.alert(
        'Login Required',
        'Please log in to your account to reply to comments.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => navigation.navigate('Login') },
        ]
      );
      return;
    }

    setReplyingTo(comment);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 150);
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
    if (!isLoggedIn) {
      Alert.alert(
        'Login Required',
        'Please log in to your account to post a comment.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => navigation.navigate('Login') },
        ]
      );
      return;
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      Alert.alert('Validation Error', 'Please type your comment before posting.');
      return;
    }

    const authorName = user?.name || user?.username || 'Member';
    const authorEmail = user?.email || '';

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
        'Thank you! Your comment has been posted.'
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

  const userAvatar =
    user?.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || user?.username || 'User')}&background=00A3E8&color=fff&bold=true`;

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

      {/* Comment Input Box (Logged In Only) or Login Prompt Card */}
      {isLoggedIn ? (
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.loggedInUserRow}>
            <Image source={{ uri: userAvatar }} style={styles.inputUserAvatar} />
            <Text style={[styles.loggedInAsText, { color: colors.textSecondary }]}>
              Posting as{' '}
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {user?.name || user?.username || 'Member'}
              </Text>
            </Text>
          </View>

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
      ) : (
        /* Login Required Card */
        <View
          style={[
            styles.loginPromptCard,
            {
              backgroundColor: isDarkMode ? '#131D31' : '#F0F9FF',
              borderColor: isDarkMode ? '#1E293B' : '#BAE6FD',
            },
          ]}
        >
          <View style={styles.loginPromptIconWrapper}>
            <Ionicons name="lock-closed" size={22} color={COLORS.primary} />
          </View>
          <View style={styles.loginPromptContent}>
            <Text style={[styles.loginPromptTitle, { color: colors.text }]}>
              Log in to Comment
            </Text>
            <Text style={[styles.loginPromptSubtitle, { color: colors.textSecondary }]}>
              Join the conversation and share your opinion.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.loginPromptBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
          >
            <Text style={styles.loginPromptBtnText}>Log In</Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

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
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  loginPromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    gap: 12,
  },
  loginPromptIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 163, 232, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginPromptContent: {
    flex: 1,
  },
  loginPromptTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  loginPromptSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  loginPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  loginPromptBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
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
