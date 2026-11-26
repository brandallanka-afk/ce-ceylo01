import {useState} from 'react';
import {Leaf} from 'lucide-react';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
  aspectClass?: string;
  sizes?: string;
  width?: number;
  height?: number;
}

const LOCAL_ASSET_DIMENSIONS: Record<string, {w: number; h: number}> = {
  hero_ceylon_heritage_1795545289913: {w: 1376, h: 768},
  hero_royal_ceylon_luxury_1795705254348: {w: 1376, h: 768},
  story_ceylon_highlands_1795545292272: {w: 1376, h: 768},
  brand_ceylomira_tea_1795545290271: {w: 1200, h: 896},
  brand_ceyvana_spices_1795545289791: {w: 1200, h: 896},
  showcase_ceyvana_editorial_1795705254796: {w: 1200, h: 896},
  showcase_ceylomira_editorial_1795705255087: {w: 1200, h: 896},
  product_cinnamon_pepper_1795545291338: {w: 1200, h: 896},
  product_curry_blends_1795545291347: {w: 1200, h: 896},
};

function resolveResponsiveWebp(src: string): {
  webpSrcSet: string;
  dims: {w: number; h: number};
} | null {
  const match = /^(\/src\/assets\/images\/([a-z0-9_]+))\.(jpe?g|png)$/i.exec(src.trim());
  if (!match) {
    return null;
  }
  const basePath = match[1];
  const fileKey = match[2];
  const dims = LOCAL_ASSET_DIMENSIONS[fileKey] ?? {w: 1200, h: 896};
  const webpSrcSet = `${basePath}-640.webp 640w, ${basePath}-1024.webp 1024w, ${basePath}.webp ${dims.w}w`;
  return {webpSrcSet, dims};
}

export default function SafeImage({
  src,
  alt,
  className = '',
  eager = false,
  aspectClass = '',
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  width,
  height,
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#211C1A] to-[#2A2522] text-[#C6A46A]/85 p-6 text-center ${aspectClass} ${className}`}
        role="img"
        aria-label={alt}
      >
        <Leaf className="w-7 h-7 mb-2 opacity-70" aria-hidden="true" />
        <span className="text-xs font-medium tracking-wide max-w-[20ch] text-[#A99B88]">{alt}</span>
      </div>
    );
  }

  const webpInfo = resolveResponsiveWebp(src);
  const resolvedWidth = width ?? webpInfo?.dims.w;
  const resolvedHeight = height ?? webpInfo?.dims.h;

  if (webpInfo) {
    return (
      <picture className="block w-full h-full">
        <source type="image/webp" srcSet={webpInfo.webpSrcSet} sizes={sizes} />
        <img
          src={src}
          alt={alt}
          width={resolvedWidth}
          height={resolvedHeight}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : undefined}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={className}
        />
      </picture>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={resolvedWidth}
      height={resolvedHeight}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
