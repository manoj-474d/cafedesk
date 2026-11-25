import React, { useEffect, useState } from 'react';
import { Coffee } from 'lucide-react';

interface ResilientPhotoProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
}

function getWebpFallback(url: string): string | null {
  if (!url) return null;
  if (url.startsWith('/assets/cafes/') && /\.(jpg|jpeg|png)$/i.test(url)) {
    return url.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  }
  return null;
}

export function ResilientPhoto({
  src,
  alt,
  className = '',
  imgClassName = 'w-full h-full object-cover',
  priority = false,
}: ResilientPhotoProps) {
  const [activeSrc, setActiveSrc] = useState(src);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setActiveSrc(src);
    setFailed(!src);
    setLoaded(false);
  }, [src]);

  const handleError = () => {
    const webp = getWebpFallback(activeSrc);
    if (webp && webp !== activeSrc) {
      setActiveSrc(webp);
      return;
    }
    setFailed(true);
  };

  if (failed || !activeSrc) {
    return (
      <div
        className={`relative overflow-hidden bg-[#f3ede3] flex flex-col items-center justify-center p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <div className="w-10 h-10 rounded-full bg-white border border-[#e6ddd0] flex items-center justify-center text-[#b45309] mb-2 shadow-xs">
          <Coffee className="w-5 h-5" aria-hidden="true" />
        </div>
        <p className="text-[11px] font-medium text-[#5c4e45] line-clamp-2 max-w-[180px]">{alt}</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-[#f3ede3] ${className}`}>
      {!loaded && <div className="absolute inset-0 bg-[#efe7da] animate-pulse" aria-hidden="true" />}
      <img
        src={activeSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        onLoad={() => setLoaded(true)}
        onError={handleError}
        className={`${imgClassName} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
