import React from 'react';

// Pass size={null} to size the logo with classes instead (height plus aspect-[26/5]).
export const Logo = ({ size = 48, className = "", centerImage = false }) => {
  // The image is roughly 5.2 times wider than it is tall.
  const sizeStyle = size
    ? {
      width: `${size * 5.2}px`,
      maxWidth: '100%',
      height: `${size}px`
    }
    : undefined;

  return (
    <div
      className={`flex items-center ${className}`}
      style={sizeStyle}
    >
      <img
        src="/logo.png"
        alt="MedTech Europe - The Code App"
        className="h-full w-full"
        style={{
          objectFit: 'contain',
          objectPosition: centerImage ? 'center' : 'left center'
        }}
      />
    </div>
  );
};

/**
 * The logo for a phone's reader header, where the full one leaves no room for the reading
 * buttons: the MedTech Europe figure (public/favicon.svg) and the app's name, in the logo's
 * own colours.
 */
export const CompactLogo = ({ className = "" }) => (
  <span className={`flex items-center gap-1 text-[1.0625rem] leading-none tracking-[-0.01em] whitespace-nowrap ${className}`}>
    <img src="/favicon.svg" alt="" className="h-8 w-8 -ml-1 shrink-0" />
    <span className="sr-only">MedTech Europe: </span>
    <span>
      <span className="text-gray-950">The</span>{' '}
      <span className="text-[#2799a8]">Code</span>{' '}
      <span className="text-[#611d9d]">App</span>
    </span>
  </span>
);
