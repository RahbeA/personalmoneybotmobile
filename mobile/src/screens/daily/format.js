export function formatValue(value, unit) {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  switch (unit) {
    case 'money':
      return `$${Math.round(n).toLocaleString()}`;
    case 'percent':
      return `${n}%`;
    case 'years':
      return `${n} yr${n === 1 ? '' : 's'}`;
    case 'months':
      return `${n} mo`;
    default:
      return n.toLocaleString();
  }
}

export const COLOR_EMOJI = { green: '🟩', yellow: '🟨', black: '⬛' };

export function colorHex(color, colors) {
  if (color === 'green') return colors.primary;
  if (color === 'yellow') return colors.botBucks;
  return colors.textMuted;
}
