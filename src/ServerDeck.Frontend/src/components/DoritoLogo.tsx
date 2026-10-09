import React from 'react';

interface DoritoLogoProps {
  size?: number;
  className?: string;
  withRibbon?: boolean;
  withSparkle?: boolean;
  withSticks?: boolean;
}

export const DoritoLogo: React.FC<DoritoLogoProps> = ({
  size = 32,
  className = '',
  withRibbon = true,
  withSparkle = true,
  withSticks = true,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
    >
      <defs>
        {/* Dorito golden cheese gradient */}
        <linearGradient id="doritoGrad" x1="24" y1="5" x2="38" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fff04d" />
          <stop offset="45%" stopColor="#ffd100" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>

        {/* Nijika Ribbon gradient */}
        <linearGradient id="ribbonGrad" x1="12" y1="30" x2="28" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="40%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#be123c" />
        </linearGradient>

        {/* Crossed drumsticks wood gradient */}
        <linearGradient id="drumstickGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="70%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>

        {/* Dorito soft shadow / glow */}
        <filter id="doritoGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#ffd100" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* Crossed Drumsticks behind the Dorito chip */}
      {withSticks && (
        <g opacity="0.95">
          {/* Stick 1 */}
          <line
            x1="8"
            y1="40"
            x2="38"
            y2="10"
            stroke="url(#drumstickGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="39" cy="9" r="2.2" fill="#fde68a" stroke="#b45309" strokeWidth="0.5" />

          {/* Stick 2 */}
          <line
            x1="10"
            y1="10"
            x2="40"
            y2="40"
            stroke="url(#drumstickGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="9" cy="9" r="2.2" fill="#fde68a" stroke="#b45309" strokeWidth="0.5" />
        </g>
      )}

      {/* The Iconic Dorito Chip (rounded triangle ahoge) */}
      <path
        d="M24 6 C25 6, 26 7.5, 27 9 L41 33 C42.2 35, 41.5 37.5, 39.5 38 C38.5 38.3, 10 38.3, 8.5 38 C6.5 37.5, 5.8 35, 7 33 L21 9 C22 7.5, 23 6, 24 6 Z"
        fill="url(#doritoGrad)"
        stroke="#d97706"
        strokeWidth="1.2"
        strokeLinejoin="round"
        filter="url(#doritoGlow)"
      />

      {/* Dorito seasoning specks (Paprika / Cheese powder) */}
      <circle cx="23" cy="17" r="0.9" fill="#ea580c" opacity="0.75" />
      <circle cx="28" cy="24" r="0.8" fill="#ea580c" opacity="0.8" />
      <circle cx="18" cy="28" r="1.1" fill="#ea580c" opacity="0.7" />
      <circle cx="32" cy="32" r="0.8" fill="#ea580c" opacity="0.8" />
      <circle cx="24" cy="31" r="0.7" fill="#ea580c" opacity="0.6" />
      <circle cx="15" cy="21" r="0.7" fill="#ea580c" opacity="0.6" />

      {/* Crisp 3D edge highlight */}
      <path
        d="M24 9 L38 33 C37 34, 11 34, 10 33 Z"
        stroke="#ffffff"
        strokeWidth="0.8"
        strokeOpacity="0.3"
        fill="none"
      />

      {/* Nijika's Big Cute Red Ribbon at the base/side */}
      {withRibbon && (
        <g id="nijika-ribbon">
          {/* Left Wing */}
          <path
            d="M24 35 C20 32, 14 31, 13 35 C12 39, 18 42, 23 37 Z"
            fill="url(#ribbonGrad)"
            stroke="#9f1239"
            strokeWidth="0.8"
          />
          {/* Right Wing */}
          <path
            d="M24 35 C28 32, 34 31, 35 35 C36 39, 30 42, 25 37 Z"
            fill="url(#ribbonGrad)"
            stroke="#9f1239"
            strokeWidth="0.8"
          />
          {/* Ribbon Tails */}
          <path d="M22 37 L17 44 L21 42 L23 38 Z" fill="#be123c" stroke="#9f1239" strokeWidth="0.5" />
          <path d="M26 37 L31 44 L27 42 L25 38 Z" fill="#be123c" stroke="#9f1239" strokeWidth="0.5" />
          {/* Central Knot with highlight */}
          <ellipse cx="24" cy="36" rx="2.5" ry="2.2" fill="#fda4af" stroke="#9f1239" strokeWidth="0.8" />
        </g>
      )}

      {/* Anime Sparkle at tip */}
      {withSparkle && (
        <path
          d="M24 2 L25.2 4.8 L28 6 L25.2 7.2 L24 10 L22.8 7.2 L20 6 L22.8 4.8 Z"
          fill="#ffffff"
          opacity="0.95"
        />
      )}
    </svg>
  );
};
