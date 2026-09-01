export const BRAND_NAME = 'MoneyBot';
export const BRAND_TAGLINE = 'Financial literacy for everyone';
export const BRAND_URL = 'getmoneybot.com';
export const APP_STORE_URL = 'https://apps.apple.com/us/app/moneybot-mobile/id6778658807';

export function buildInviteShareMessage() {
  return (
    `Join me on MoneyBot — learn money skills the fun way.\n\n`
    + `Download the app:\n${APP_STORE_URL}`
  );
}

export const LOADER_MESSAGES = {
  boot: 'Starting MoneyBot...',
  roadmap: 'Loading your roadmap...',
  questions: 'Preparing questions...',
  moneyverse: 'Opening the Moneyverse...',
  moneyChat: 'Money Chat is warming up...',
  thinking: 'MoneyBot is thinking...',
};

export const EMPTY_STATES = {
  tutor: {
    title: 'Ask MoneyBot anything',
    body: 'Your AI tutor knows all the course content — budgeting, saving, credit, taxes, and insurance. Ask a question to get started.',
  },
  tutorHistory: 'MoneyBot is ready to chat.',
  moneyverseHero: {
    title: 'No character yet',
    body: 'Visit the Moneyverse to meet your MoneyBot!',
  },
  moneyverseShop: {
    title: 'Shop coming soon',
    body: 'New characters and items will appear here.',
  },
};

export const CORRECT_ANSWER_MESSAGES = [
  'Nice!',
  'Great job!',
  'You got it!',
  'Well done!',
  'Awesome!',
  'Spot on!',
  'Brilliant!',
  'Money smart!',
  'Keep it up!',
  'On fire!',
];

export const CELEBRATIONS = {
  lessonIntro: 'Ready when you are!',
  correctAnswer: CORRECT_ANSWER_MESSAGES[0],
  wrongAnswer: 'Almost — keep going!',
  moduleComplete: 'MoneyBot is proud of you!',
  levelUp: 'Level up!',
};

export const LANDING = {
  tagline: 'Master your money.',
  subTagline: 'Learn how money really works with quick, fun lessons.',
};
