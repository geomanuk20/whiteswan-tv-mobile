import AsyncStorage from '@react-native-async-storage/async-storage';
import { YOUTUBE_CHANNELS } from '../constants/channels.js';

const CACHE_KEY = '@ws_youtube_videos_v3';
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes cache for fresh news updates

/**
 * Classify if a video is published Today or Yesterday based on relative text or date
 */
export const classifyVideoTimeAgo = (timeAgoText) => {
  if (!timeAgoText || typeof timeAgoText !== 'string') {
    return { isToday: false, isYesterday: false, dateLabel: 'LATEST' };
  }
  const lower = timeAgoText.toLowerCase().trim();

  // 1. Explicitly check for days / weeks / months / years / yesterday (Strictly NOT Today)
  // Handles strings like: "Streamed 1 day ago", "Streamed 2 days ago", "1 day ago", "yesterday", "2 days ago", "1 week ago", "3 months ago", etc.
  const isOlder =
    lower.includes('day') ||
    lower.includes('yesterday') ||
    lower.includes('week') ||
    lower.includes('month') ||
    lower.includes('year') ||
    /\b\d+\s*d\b/i.test(lower) ||
    /\b\d+\s*w\b/i.test(lower) ||
    /\b\d+\s*mo\b/i.test(lower) ||
    /\b\d+\s*y\b/i.test(lower);

  if (isOlder) {
    const isYesterday =
      lower.includes('1 day') ||
      lower.includes('yesterday') ||
      /\b1\s*d(?:ay)?\b/i.test(lower);

    return {
      isToday: false,
      isYesterday,
      dateLabel: isYesterday ? 'YESTERDAY' : timeAgoText.toUpperCase(),
    };
  }

  // 2. Explicitly check for Today indicators (hours, minutes, seconds, just now, watching now, live now)
  // Handles strings like: "3 hours ago", "Streamed 2 hours ago", "45 minutes ago", "Just now", "Premiered 1 hour ago", "Live now"
  const isToday =
    lower.includes('second') ||
    lower.includes('minute') ||
    lower.includes('min') ||
    lower.includes('hour') ||
    lower.includes('hr') ||
    lower.includes('h ago') ||
    lower.includes('m ago') ||
    lower.includes('s ago') ||
    lower.includes('just now') ||
    lower.includes('today') ||
    lower.includes('watching now') ||
    lower.includes('live now');

  if (isToday) {
    return {
      isToday: true,
      isYesterday: false,
      dateLabel: 'TODAY',
    };
  }

  return {
    isToday: false,
    isYesterday: false,
    dateLabel: timeAgoText.toUpperCase(),
  };
};

/**
 * Fetch video list by YouTube Channel Handle (most reliable, bypasses 404 RSS issues)
 */
const fetchVideosFromHandle = async (channel) => {
  const handle = channel.handle ? channel.handle.replace('@', '') : channel.id;
  try {
    const res = await fetch(`https://www.youtube.com/@${handle}/videos`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) return [];

    const html = await res.text();
    const jsonMatch =
      html.match(/var ytInitialData = ({[\s\S]*?});<\/script>/) ||
      html.match(/window\[\"ytInitialData\"\] = ({[\s\S]*?});<\/script>/);

    if (!jsonMatch) return [];

    const data = JSON.parse(jsonMatch[1]);
    const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
    const videoTab =
      tabs.find((t) => t.tabRenderer?.title === 'Videos') || tabs[1] || tabs[0];
    const contents =
      videoTab?.tabRenderer?.content?.richGridRenderer?.contents || [];

    const items = [];
    for (const item of contents) {
      const lockup = item.richItemRenderer?.content?.lockupViewModel;
      const videoRenderer = item.richItemRenderer?.content?.videoRenderer;

      if (lockup) {
        const videoId =
          lockup.contentId ||
          lockup.rendererContext?.commandContext?.onTap?.innertubeCommand
            ?.watchEndpoint?.videoId;

        if (!videoId) continue;

        let title =
          lockup.metadata?.lockupMetadataViewModel?.title?.content ||
          lockup.rendererContext?.accessibilityContext?.label?.split(
            /\s+\d+\s+(?:minutes|hours|seconds)/i
          )?.[0] ||
          '';

        title = title
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');

        let timeAgo = '';
        let views = '';
        const rows =
          lockup.metadata?.lockupMetadataViewModel?.metadata
            ?.contentMetadataViewModel?.metadataRows || [];

        for (const row of rows) {
          for (const part of row.metadataParts || row.parts || []) {
            const txt = part.text?.content || '';
            const label = part.accessibilityLabel || '';
            if (
              txt.match(/ago|streamed|premiered|today|yesterday/i) ||
              label.match(/ago/i)
            ) {
              timeAgo = label || txt;
            } else if (label.match(/view/i) || txt.match(/\d+[KMB]?\s*views?/i)) {
              views = label || txt;
            }
          }
        }

        const sources =
          lockup.contentImage?.thumbnailViewModel?.image?.sources || [];
        const thumbnail =
          sources.length > 0
            ? sources[sources.length - 1].url
            : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        const { isToday, isYesterday, dateLabel } = classifyVideoTimeAgo(timeAgo);

        items.push({
          id: videoId,
          videoId,
          title,
          timeAgo: timeAgo || 'Latest',
          dateLabel,
          isToday,
          isYesterday,
          thumbnail,
          views,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          channelId: channel?.channelId,
          channelTitle: channel?.title || 'Whiteswan TV News',
          channelHandle: channel?.handle || `@${handle}`,
          channelBadge: channel?.badge || 'OFFICIAL',
          channelColor: channel?.color || '#E50914',
        });
      } else if (videoRenderer) {
        const videoId = videoRenderer.videoId;
        if (!videoId) continue;
        const title = videoRenderer.title?.runs?.[0]?.text || '';
        const timeAgo = videoRenderer.publishedTimeText?.simpleText || '';
        const { isToday, isYesterday, dateLabel } = classifyVideoTimeAgo(timeAgo);

        items.push({
          id: videoId,
          videoId,
          title,
          timeAgo: timeAgo || 'Latest',
          dateLabel,
          isToday,
          isYesterday,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          channelId: channel?.channelId,
          channelTitle: channel?.title || 'Whiteswan TV News',
          channelHandle: channel?.handle || `@${handle}`,
          channelBadge: channel?.badge || 'OFFICIAL',
          channelColor: channel?.color || '#E50914',
        });
      }
    }

    return items;
  } catch (e) {
    console.log(`Error scraping handle for ${handle}:`, e.message);
    return [];
  }
};

/**
 * Fallback: Fetch RSS XML feed
 */
const fetchVideosFromRss = async (channel) => {
  if (!channel.channelId) return [];
  try {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];

    return entries.map((entry) => {
      const videoIdMatch = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
      const videoId = videoIdMatch ? videoIdMatch[1].trim() : '';

      const titleMatch = entry.match(/<title>(.*?)<\/title>/);
      let title = titleMatch ? titleMatch[1].trim() : '';
      title = title
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

      const publishedMatch = entry.match(/<published>(.*?)<\/published>/);
      const publishedStr = publishedMatch ? publishedMatch[1].trim() : '';
      const publishedDate = publishedStr ? new Date(publishedStr) : null;

      let isToday = false;
      let isYesterday = false;
      let timeAgo = 'Latest';

      if (publishedDate && !isNaN(publishedDate.getTime())) {
        const now = new Date();
        const diffMs = now.getTime() - publishedDate.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 3600));

        const isSameCalendarDay =
          now.getFullYear() === publishedDate.getFullYear() &&
          now.getMonth() === publishedDate.getMonth() &&
          now.getDate() === publishedDate.getDate();

        if (diffHours < 20 || (isSameCalendarDay && diffHours < 24)) {
          isToday = true;
          timeAgo = diffHours < 1 ? 'Just now' : `${diffHours}h ago`;
        } else if (diffHours >= 20 && diffHours < 44) {
          isYesterday = true;
          timeAgo = 'Yesterday';
        } else {
          const days = Math.max(2, Math.floor(diffHours / 24));
          timeAgo = `${days}d ago`;
        }
      }

      return {
        id: videoId,
        videoId,
        title,
        timeAgo,
        dateLabel: isToday ? 'TODAY' : isYesterday ? 'YESTERDAY' : 'LATEST',
        isToday,
        isYesterday,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        channelId: channel.channelId,
        channelTitle: channel.title || 'Whiteswan TV News',
        channelHandle: channel.handle,
        channelBadge: channel.badge || 'OFFICIAL',
        channelColor: channel.color || '#E50914',
      };
    });
  } catch (e) {
    return [];
  }
};

/**
 * Fetch latest YouTube videos across all Whiteswan TV channels
 */
export const fetchLatestYouTubeVideos = async ({ bypassCache = false } = {}) => {
  // 1. Check storage cache
  if (!bypassCache) {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL && Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch (e) {}
  }

  // 2. Fetch parallel across all channels using handle-based extraction
  const fetchPromises = YOUTUBE_CHANNELS.map(async (ch) => {
    let videos = await fetchVideosFromHandle(ch);
    if (!videos || videos.length === 0) {
      videos = await fetchVideosFromRss(ch);
    }
    return videos;
  });

  const results = await Promise.allSettled(fetchPromises);
  let allVideos = [];
  results.forEach((r) => {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      allVideos.push(...r.value);
    }
  });

  // Deduplicate by videoId
  const seenIds = new Set();
  const uniqueVideos = [];
  for (const v of allVideos) {
    if (v.videoId && !seenIds.has(v.videoId)) {
      seenIds.add(v.videoId);
      uniqueVideos.push(v);
    }
  }

  // Sort: Prioritize Today's videos first, then yesterday, then others
  uniqueVideos.sort((a, b) => {
    if (a.isToday && !b.isToday) return -1;
    if (!a.isToday && b.isToday) return 1;
    if (a.isYesterday && !b.isYesterday) return -1;
    if (!a.isYesterday && b.isYesterday) return 1;
    return 0;
  });

  // Save to cache
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), data: uniqueVideos })
    );
  } catch (e) {}

  return uniqueVideos;
};

