import {useState} from 'react';

export type OfficialLogoBrandId = 'ceyvana' | 'ceylomira';

export type BrandLogoSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type BrandLogoTone = 'dark' | 'light';

interface BrandLogoProps {
  brandId: OfficialLogoBrandId;
  size?: BrandLogoSize;
  tone?: BrandLogoTone;
  eager?: boolean;
  animated?: boolean;
  sheen?: boolean;
  className?: string;
}

const BRAND_LOGO_META: Record<
  OfficialLogoBrandId,
  {
    srcDark: string;
    srcLight: string;
    maskClass: string;
    width: number;
    height: number;
    alt: string;
    label: string;
  }
> = {
  ceyvana: {
    srcDark: '/assets/logos/ceyvana-website.png',
    srcLight: '/assets/logos/ceyvana-original.png',
    maskClass: 'luxury-logo-mask-ceyvana',
    width: 1589,
    height: 936,
    alt: 'Ceyvana — Pure Origin. Timeless Flavor.',
    label: 'CEYVANA',
  },
  ceylomira: {
    srcDark: '/assets/logos/ceylomira-website.png',
    srcLight: '/assets/logos/ceylomira-original.png',
    maskClass: 'luxury-logo-mask-ceylomira',
    width: 1553,
    height: 1074,
    alt: 'Ceylomira — In Every Sip, A World of Flavour.',
    label: 'CEYLOMIRA',
  },
};

const SIZE_CLASSES: Record<BrandLogoSize, string> = {
  '2xs': 'h-5 sm:h-6',
  xs: 'h-7 sm:h-8',
  sm: 'h-11 sm:h-12',
  md: 'h-16 sm:h-20',
  lg: 'h-24 sm:h-28',
  xl: 'h-28 sm:h-32',
};

export function isOfficialLogoBrand(brandId: string): brandId is OfficialLogoBrandId {
  return brandId === 'ceyvana' || brandId === 'ceylomira';
}

export default function BrandLogo({
  brandId,
  size = 'md',
  tone = 'dark',
  eager = false,
  animated = true,
  sheen = true,
  className = '',
}: BrandLogoProps) {
  const [failed, setFailed] = useState(false);
  const meta = BRAND_LOGO_META[brandId];
  const src = tone === 'light' ? meta.srcLight : meta.srcDark;

  return (
    <span
      className={`relative inline-flex items-center justify-center bg-transparent select-none shrink-0 ${
        SIZE_CLASSES[size]
      } ${animated ? 'luxury-logo-reveal luxury-logo-crest' : ''} ${
        animated && sheen ? 'luxury-logo-sheen' : ''
      } ${className}`}
    >
      {failed ? (
        <span
          className={`font-display font-medium tracking-[0.16em] text-xs px-1 ${
            tone === 'light' ? 'text-[#4B1906]' : 'text-[#C6A46A]'
          }`}
        >
          {meta.label}
        </span>
      ) : (
        <>
          <img
            src={src}
            alt={meta.alt}
            width={meta.width}
            height={meta.height}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            referrerPolicy="no-referrer"
            draggable={false}
            onError={() => setFailed(true)}
            className="relative z-10 h-full w-auto object-contain block pointer-events-none"
          />
          {animated && sheen && (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 overflow-hidden z-20 ${meta.maskClass}`}
            >
              <span className="luxury-logo-sheen-layer block h-full" />
            </span>
          )}
        </>
      )}
    </span>
  );
}
