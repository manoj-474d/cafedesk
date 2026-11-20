import React, { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';

interface ResilientPhotoProps {
  src?: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallbackTitle?: string;
  fallbackSubtitle?: string;
  priority?: boolean;
}

/**
 * Renders high-resolution photography with referrerPolicy="no-referrer" and a
 * graceful editorial fallback container if an image is missing or fails to load.
 */
export function ResilientPhoto({
  src,
  alt,
  className = '',
  imgClassName = 'w-full h-full object-cover',
  fallbackTitle,
  fallbackSubtitle,
  priority = false,
}: ResilientPhotoProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`relative overflow-hidden bg-gradient-to-br from-[#f3ede3] via-[#ebe2d4] to-[#dfd3c0] flex flex-col items-center justify-center p-6 text-center text-[#1c1613] ${className}`}
      >
        <MapPin className="w-6 h-6 text-[#5c4e45] mb-2" aria-hidden="true" />
        <p className="font-serif-display text-base font-semibold text-[#1c1613]">
          {fallbackTitle || 'CafeDesk Branch'}
        </p>
        {fallbackSubtitle && (
          <p className="text-xs text-[#5c4e45] mt-1 max-w-xs">{fallbackSubtitle}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-[#ebe2d4] ${className}`}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        onError={() => setFailed(true)}
        className={imgClassName}
      />
    </div>
  );
}
