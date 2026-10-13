import React, { useState } from 'react';

interface BrandedLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
}

export const BrandedLogo: React.FC<BrandedLogoProps> = ({
  size = 'md',
  className = '',
  showLabel = false,
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  }[size];

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div
        className={`relative ${sizeClasses} rounded-full overflow-hidden border border-white/20 shadow-md bg-dark-850 shrink-0`}
      >
        {!imageError ? (
          <img
            src="/dealings-logo.jpg"
            alt="MoocDeal brand mark"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover object-top select-none"
            loading="eager"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand-violet to-brand-indigo flex items-center justify-center text-white font-bold text-xs">
            MD
          </div>
        )}
      </div>

      {showLabel && (
        <div className="flex items-center gap-1.5 select-none">
          <span className="text-base font-bold tracking-tight text-white">MoocDeal</span>
          <span className="text-xs text-subtle-text font-normal">- SRM DEALINGS</span>
        </div>
      )}
    </div>
  );
};
