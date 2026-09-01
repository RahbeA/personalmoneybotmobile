export const CHAT_PERSONALITIES = [
  {
    key: 'chill',
    label: 'Chill',
    blurb: 'Laid-back friend',
    greeting: "What's on your mind? I'll keep it easy.",
    icon: 'cafe',
    accent: '#3DDC5F',
    premium: false,
  },
  {
    key: 'coach',
    label: 'Coach',
    blurb: 'Uplifting hype',
    greeting: "Let's lock a money win. What are we working?",
    icon: 'flash',
    accent: '#F5B72B',
    premium: false,
  },
  {
    key: 'funny',
    label: 'Funny',
    blurb: 'Jokes, still right',
    greeting: "Hit me. I'll explain it without the lecture voice.",
    icon: 'happy',
    accent: '#56C8E8',
    premium: false,
  },
  {
    key: 'teacher',
    label: 'Teacher',
    blurb: 'Straight-up class',
    greeting: 'Ask a real question. I will answer it cleanly.',
    icon: 'school',
    accent: '#A66BFF',
    premium: false,
  },
];

export const DEFAULT_PERSONALITY = 'chill';

export function personalityByKey(key) {
  return CHAT_PERSONALITIES.find((item) => item.key === key) || CHAT_PERSONALITIES[0];
}
