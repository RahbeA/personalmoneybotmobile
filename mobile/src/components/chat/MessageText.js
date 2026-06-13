import React from 'react';
import { Text, Platform } from 'react-native';

// Split on emoji graphemes so they render with the system emoji font.
const EMOJI_PATTERN = /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/gu;

const emojiFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: undefined,
});

export default function MessageText({ content, style }) {
  const text = String(content ?? '');
  const parts = text.split(EMOJI_PATTERN);

  return (
    <Text style={style}>
      {parts.map((part, index) => {
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
      })}
    </Text>
  );
}
