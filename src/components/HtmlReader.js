import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { decodeHtmlEntities } from '../services/wpApi';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const HtmlReader = ({ html, fontSize = 16 }) => {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  if (!html) return null;

  // Simple, fast parser that splits HTML into structured blocks
  const parseHtmlToBlocks = (rawHtml) => {
    // Clean comments, scripts, styles
    let cleaned = rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // Match blocks (p, h1-h6, blockquote, img, li)
    const blockRegex =
      /<(p|h1|h2|h3|h4|h5|h6|blockquote|li|figure)[^>]*>([\s\S]*?)<\/\1>|<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const blocks = [];
    let match;

    while ((match = blockRegex.exec(cleaned)) !== null) {
      if (match[3]) {
        // standalone <img>
        blocks.push({
          type: 'image',
          src: match[3],
        });
      } else {
        const tag = match[1].toLowerCase();
        const innerContent = match[2];

        // Check if inside this block there's an image
        const imgMatch = innerContent.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
        if (imgMatch && imgMatch[1]) {
          blocks.push({
            type: 'image',
            src: imgMatch[1],
          });
        }

        const textContent = decodeHtmlEntities(innerContent);
        if (textContent.trim().length > 0) {
          blocks.push({
            type: tag,
            content: textContent,
          });
        }
      }
    }

    // Fallback if regex found no blocks: strip all tags and return paragraphs
    if (blocks.length === 0) {
      const plainText = decodeHtmlEntities(cleaned);
      const paragraphs = plainText.split('\n\n').filter((p) => p.trim().length > 0);
      return paragraphs.map((p) => ({ type: 'p', content: p.trim() }));
    }

    return blocks;
  };

  const blocks = parseHtmlToBlocks(html);

  // Helper to format leading district / dateline prefix (e.g. "കോഴിക്കോട്:", "തിരുവനന്തപുരം:", "കൊച്ചി:") in bold
  const renderParagraphContent = (text) => {
    if (!text || typeof text !== 'string') return text;

    // Matches leading district/city/dateline prefix followed by colon or dash
    const districtLeadRegex = /^([\u0D00-\u0D7F\w\s.-]{2,35}\s*[:\-—])\s*([\s\S]*)$/;
    const match = text.match(districtLeadRegex);

    if (match) {
      return (
        <Text>
          <Text style={[styles.districtLeadText, { color: colors.text }]}>
            {match[1]}{' '}
          </Text>
          <Text>{match[2]}</Text>
        </Text>
      );
    }

    return text;
  };

  return (
    <View style={styles.container}>
      {blocks.map((block, idx) => {
        if (block.type === 'image') {
          return (
            <View key={idx} style={styles.imageWrapper}>
              <Image
                source={{ uri: block.src }}
                style={styles.embeddedImage}
                resizeMode="cover"
              />
            </View>
          );
        }

        if (block.type === 'h1' || block.type === 'h2' || block.type === 'h3') {
          return (
            <Text
              key={idx}
              style={[
                styles.heading,
                {
                  color: colors.text,
                  fontSize: fontSize + 4,
                  lineHeight: (fontSize + 4) * 1.4,
                },
              ]}
            >
              {renderParagraphContent(block.content)}
            </Text>
          );
        }

        if (block.type === 'blockquote') {
          return (
            <View
              key={idx}
              style={[
                styles.blockquote,
                {
                  backgroundColor: colors.inputBg,
                  borderLeftColor: COLORS.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.blockquoteText,
                  {
                    color: colors.text,
                    fontSize: fontSize,
                    lineHeight: fontSize * 1.6,
                  },
                ]}
              >
                "{block.content}"
              </Text>
            </View>
          );
        }

        if (block.type === 'li') {
          return (
            <View key={idx} style={styles.listRow}>
              <Text style={[styles.bullet, { color: COLORS.primary }]}>•</Text>
              <Text
                style={[
                  styles.paragraph,
                  {
                    color: colors.text,
                    fontSize: fontSize,
                    lineHeight: fontSize * 1.65,
                    flex: 1,
                  },
                ]}
              >
                {renderParagraphContent(block.content)}
              </Text>
            </View>
          );
        }

        // Standard Paragraph with Bold District Lead
        return (
          <Text
            key={idx}
            style={[
              styles.paragraph,
              {
                color: colors.text,
                fontSize: fontSize,
                lineHeight: fontSize * 1.65,
              },
            ]}
          >
            {renderParagraphContent(block.content)}
          </Text>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  paragraph: {
    marginBottom: 16,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  districtLeadText: {
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  heading: {
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 10,
  },
  blockquote: {
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 14,
    borderRadius: RADIUS.sm,
  },
  blockquoteText: {
    fontStyle: 'italic',
    fontWeight: '500',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingLeft: 4,
    gap: 8,
  },
  bullet: {
    fontSize: 20,
    lineHeight: 22,
  },
  imageWrapper: {
    marginVertical: 14,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  embeddedImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 360,
    borderRadius: RADIUS.md,
  },
});
