import { MESSAGES, BASE_POINTS, COMBO_BONUS, WRONG_PENALTY } from './messages';

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createDeck() {
  return shuffle(MESSAGES);
}

// choice is 'scam' or 'safe'.
export function scoreAnswer({ score, combo }, choice, message) {
  const correct = (choice === 'scam') === message.isScam;
  if (correct) {
    const nextCombo = combo + 1;
    const points = BASE_POINTS + (nextCombo - 1) * COMBO_BONUS;
    return {
      score: score + points,
      combo: nextCombo,
      correct: true,
      pointsEarned: points,
    };
  }
  return {
    score: Math.max(0, score - WRONG_PENALTY),
    combo: 0,
    correct: false,
    pointsEarned: -WRONG_PENALTY,
  };
}

export function createInitialState() {
  const deck = createDeck();
  return {
    deck,
    index: 0,
    score: 0,
    combo: 0,
    correctCount: 0,
    wrongCount: 0,
    current: deck[0] || null,
  };
}

export function advanceState(state) {
  const nextIndex = state.index + 1;
  if (nextIndex >= state.deck.length) {
    const deck = createDeck();
    return {
      ...state,
      deck,
      index: 0,
      current: deck[0] || null,
    };
  }
  return {
    ...state,
    index: nextIndex,
    current: state.deck[nextIndex],
  };
}
