import React from 'react';
import { Text, View, Platform, StyleSheet } from 'react-native';

// Split on emoji graphemes so they render with the system emoji font.
const EMOJI_PATTERN = /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/gu;
const BOLD_PATTERN = /(\*\*[^*]+?\*\*|__[^_]+?__)/g;
const LIST_LINE = /^\s*(?:[-*•]|\d+[.)])\s+/;

const emojiFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: undefined,
});

function cleanMarkdown(raw) {
  return String(raw ?? '')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?/g, '').replace(/```/g, '').trim())
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function EmojiRuns({ text, style }) {
  const parts = String(text ?? '').split(EMOJI_PATTERN);
  return parts.map((part, index) => {
    if (!part) return null;
    EMOJI_PATTERN.lastIndex = 0;
    if (EMOJI_PATTERN.test(part)) {
      return (
        <Text
          key={`emoji-${index}`}
          style={[style, { fontFamily: emojiFont, lineHeight: undefined, fontWeight: '400' }]}
        >
          {part}
        </Text>
      );
    }
    return part;
  });
}

function InlineText({ text, style, boldStyle }) {
  const chunks = String(text ?? '').split(BOLD_PATTERN);
  return chunks.map((chunk, index) => {
    if (!chunk) return null;
    const isBold = (chunk.startsWith('**') && chunk.endsWith('**'))
      || (chunk.startsWith('__') && chunk.endsWith('__'));
    const inner = isBold ? chunk.slice(2, -2) : chunk;
    return (
      <Text key={`in-${index}`} style={isBold ? [style, boldStyle] : style}>
        <EmojiRuns text={inner} style={isBold ? [style, boldStyle] : style} />
      </Text>
    );
  });
}

function parseBlocks(content) {
  const paragraphs = content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return paragraphs.map((paragraph) => {
    const lines = paragraph.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length > 1 && lines.every((line) => LIST_LINE.test(line))) {
      return {
        type: 'list',
        items: lines.map((line) => line.replace(LIST_LINE, '')),
      };
    }
    if (lines.length === 1 && LIST_LINE.test(lines[0])) {
      return { type: 'list', items: [lines[0].replace(LIST_LINE, '')] };
    }
    return { type: 'p', text: lines.join('\n') };
  });
}

export default function MessageText({ content, style }) {
  const text = cleanMarkdown(content);
  const blocks = parseBlocks(text);
  const boldStyle = styles.bold;

  if (blocks.length === 0) {
    return <Text style={style} />;
  }

  if (blocks.length === 1 && blocks[0].type === 'p' && !blocks[0].text.includes('\n')) {
    return (
      <Text style={style}>
        <InlineText text={blocks[0].text} style={style} boldStyle={boldStyle} />
      </Text>
    );
  }

  return (
    <View>
      {blocks.map((block, index) => {
        if (block.type === 'list') {
          return (
            <View key={`list-${index}`} style={[styles.block, index === 0 && styles.blockFirst]}>
              {block.items.map((item, itemIndex) => (
                <View key={`li-${itemIndex}`} style={styles.listRow}>
                  <Text style={style}>•</Text>
                  <Text style={[style, styles.listText]}>
                    <InlineText text={item} style={style} boldStyle={boldStyle} />
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={`p-${index}`} style={[style, styles.block, index === 0 && styles.blockFirst]}>
            <InlineText text={block.text} style={style} boldStyle={boldStyle} />
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '800' },
  block: { marginTop: 8 },
  blockFirst: { marginTop: 0 },
  listRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  listText: { flex: 1 },
});
