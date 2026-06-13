import { brand } from '../theme/tokens';

export default function BrandLogo({ size = 40, showWordmark = false, wordmarkSize = 'md' }) {
  const wordmarkStyles = {
    sm: { fontSize: 16, subSize: 10 },
    md: { fontSize: 20, subSize: 11 },
    lg: { fontSize: 26, subSize: 12 },
  }[wordmarkSize] || { fontSize: 20, subSize: 11 };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: showWordmark ? 12 : 0 }}>
      <img
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt="MoneyBot"
        width={size}
        height={size}
        style={{ display: 'block', objectFit: 'contain' }}
      />
      {showWordmark ? (
        <div>
          <div style={{ fontWeight: 700, fontSize: wordmarkStyles.fontSize, color: brand.textPrimary, lineHeight: 1.1 }}>
            Money<span style={{ color: brand.primary }}>Bot</span>
          </div>
          <div style={{ fontSize: wordmarkStyles.subSize, color: brand.textMuted, letterSpacing: 0.4 }}>
            Control Panel
          </div>
        </div>
      ) : null}
    </div>
  );
}
