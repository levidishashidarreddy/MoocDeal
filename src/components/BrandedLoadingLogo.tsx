import React, { useState } from 'react';

interface BrandedLoadingLogoProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const BrandedLoadingLogo: React.FC<BrandedLoadingLogoProps> = ({
  message,
  size = 'md',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);

  // Outer container dimensions (responsive: mobile scale -> desktop 100-120px inner logo)
  const containerClasses = {
    sm: 'w-32 h-32',
    md: 'w-40 h-40 sm:w-48 sm:h-48',
    lg: 'w-48 h-48 sm:w-56 sm:h-56',
  }[size];

  // Inner circular logo dimensions (Desktop: ~108-120px, Mobile: ~84-96px proportional)
  const imageClasses = {
    sm: 'w-16 h-16',
    md: 'w-22 h-22 sm:w-28 sm:h-28',
    lg: 'w-26 h-26 sm:w-32 sm:h-32',
  }[size];

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      <div className={`relative flex items-center justify-center ${containerClasses}`}>
        {/* SVG with revolving circular text ring outside the logo */}
        <svg
          viewBox="0 0 200 200"
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        >
          <defs>
            <path
              id="dealings-circular-path"
              d="M 100, 100 m -74, 0 a 74,74 0 1,1 148,0 a 74,74 0 1,1 -148,0"
              fill="none"
            />
          </defs>

          {/* Smooth, continuous rotating text ring around (100, 100) */}
          <g className="loading-logo-spin">
            <text
              fill="#A78BFA"
              fontSize="9.5"
              fontWeight="700"
              letterSpacing="0.18em"
              className="font-mono uppercase opacity-90"
            >
              <textPath href="#dealings-circular-path" startOffset="0%">
                DEALINGS ··· DEALINGS ··· DEALINGS ··· DEALINGS ···
              </textPath>
            </text>
          </g>
        </svg>

        {/* Restrained subtle violet ambient glow behind central logo */}
        <div className={`absolute rounded-full bg-brand-violet/15 blur-lg pointer-events-none ${imageClasses}`} />

        {/* Centered circular logo image (perfect circle, object-cover) */}
        <div
          className={`relative rounded-full overflow-hidden border border-white/20 shadow-[0_0_25px_rgba(167,139,250,0.2)] bg-dark-850 z-10 flex items-center justify-center shrink-0 aspect-square ${imageClasses}`}
        >
          {!imageError ? (
            <img
              src="/dealings-logo.jpg"
              alt="SRM DEALINGS"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover object-top select-none pointer-events-none"
              loading="eager"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-brand-violet to-brand-indigo flex items-center justify-center text-white font-bold text-sm tracking-wider">
              DEALINGS
            </div>
          )}
        </div>
      </div>

      {message && (
        <p className="mt-3 text-xs text-subtle-text font-medium tracking-wide text-center animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
};
