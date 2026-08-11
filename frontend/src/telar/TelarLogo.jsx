import React from 'react';

/**
 * Marca de Telar: dos urdimbres verticales y dos tramas horizontales cruzadas.
 * Las horizontales van a media opacidad para que se lea el tejido.
 */
export default function TelarLogo({ size = 16, gradient = true, color }) {
  const id = React.useId();
  const fill = gradient ? `url(#${id})` : (color || 'currentColor');

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      {gradient && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8358EF" />
            <stop offset="55%" stopColor="#156EF5" />
            <stop offset="100%" stopColor="#0FBFA0" />
          </linearGradient>
        </defs>
      )}
      <rect x="4.5"  y="1.5"  width="3.4" height="21"  rx="1.2" fill={fill} />
      <rect x="16.1" y="1.5"  width="3.4" height="21"  rx="1.2" fill={fill} />
      <rect x="1.5"  y="4.5"  width="21"  height="3.4" rx="1.2" fill={fill} opacity="0.45" />
      <rect x="1.5"  y="16.1" width="21"  height="3.4" rx="1.2" fill={fill} opacity="0.45" />
    </svg>
  );
}

/** Monograma de una entidad financiera, sobre su color de marca. */
export function BankMark({ bank, size = 32, radius = 10 }) {
  const isLight = bank?.color === '#FFD100';
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: bank?.color || '#8A94A6',
        color: isLight ? '#00172E' : '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        flexShrink: 0,
      }}
    >
      {bank?.monogram || bank?.name?.slice(0, 2) || '··'}
    </span>
  );
}
