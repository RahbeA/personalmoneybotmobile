/** Shared encoding for match + fill-blank answers (same format the mobile app reads). */
export const PAIR_SEP = '::';

export const QUESTION_TYPES = [
  { value: 'true_false', label: 'True / False' },
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'select_all', label: 'Select All That Apply' },
  { value: 'match', label: 'Match the Following' },
  { value: 'fill_blank', label: 'Fill in the Blanks' },
];

export function answersToMatchForm(answers = []) {
  const pairs = answers
    .filter((a) => a.is_correct)
    .map((a) => {
      const [left = '', right = ''] = String(a.text).split(PAIR_SEP);
      return { left, right };
    });
  const distractors = answers.filter((a) => !a.is_correct).map((a) => ({ text: a.text }));
  return {
    pairs: pairs.length ? pairs : [{ left: '', right: '' }],
    distractors,
  };
}

export function matchFormToAnswers({ pairs = [], distractors = [] }) {
  const correct = pairs
    .filter((p) => p.left?.trim() && p.right?.trim())
    .map((p) => ({
      text: `${p.left.trim()}${PAIR_SEP}${p.right.trim()}`,
      is_correct: true,
    }));
  const wrong = distractors
    .filter((d) => d.text?.trim())
    .map((d) => ({ text: d.text.trim(), is_correct: false }));
  return [...correct, ...wrong];
}

/** Fill-in-the-blank supports one slot for now (one ___ in the sentence). */
export const FILL_BLANK_SLOTS = 1;

export function countFillBlankSlots(prompt) {
  const parts = String(prompt || '').split('___');
  return Math.min(Math.max(parts.length - 1, 0), FILL_BLANK_SLOTS) || FILL_BLANK_SLOTS;
}

export function answersToFillForm(answers = []) {
  const first = answers.find((a) => a.is_correct);
  const distractors = answers.filter((a) => !a.is_correct).map((a) => ({ text: a.text }));
  return {
    blanks: [{ text: first?.text || '' }],
    distractors,
  };
}

export function fillFormToAnswers({ blanks = [], distractors = [] }) {
  const word = (blanks?.[0]?.text || '').trim();
  const correct = word ? [{ text: word, is_correct: true }] : [];
  const wrong = distractors
    .filter((d) => d.text?.trim())
    .map((d) => ({ text: d.text.trim(), is_correct: false }));
  return [...correct, ...wrong];
}

export function recordToFormValues(record, orderFallback = 0) {
  if (!record?.id && !record?.question_type) {
    return {
      question_type: 'mcq',
      order: orderFallback,
      prompt: '',
      explanation: '',
      answers: [{ text: '', is_correct: false }],
    };
  }
  const base = {
    question_type: record.question_type,
    order: record.order ?? orderFallback,
    prompt: record.prompt ?? '',
    explanation: record.explanation ?? '',
  };
  if (record.question_type === 'match') {
    return { ...base, ...answersToMatchForm(record.answers) };
  }
  if (record.question_type === 'fill_blank') {
    return { ...base, ...answersToFillForm(record.answers) };
  }
  return {
    ...base,
    answers: record.answers?.length ? record.answers : [{ text: '', is_correct: false }],
  };
}

export function formValuesToPayload(values) {
  const { question_type, order, prompt, explanation } = values;
  const base = { question_type, order, prompt, explanation };
  if (question_type === 'match') {
    return { ...base, answers: matchFormToAnswers(values) };
  }
  if (question_type === 'fill_blank') {
    return { ...base, answers: fillFormToAnswers(values) };
  }
  return { ...base, answers: values.answers || [] };
}
