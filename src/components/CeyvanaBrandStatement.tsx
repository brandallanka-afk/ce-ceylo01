interface CeyvanaBrandStatementProps {
  variant?: 'hero' | 'showcase' | 'collection' | 'editorial' | 'compact';
  showEyebrow?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<
  NonNullable<CeyvanaBrandStatementProps['variant']>,
  {
    wrapper: string;
    eyebrow: string;
    quote: string;
    rule: string;
  }
> = {
  hero: {
    wrapper: 'space-y-2.5',
    eyebrow: 'text-[10px] font-mono-tabular uppercase tracking-[0.22em] text-[#C6A46A]/90',
    quote:
      'font-display text-2xl sm:text-[1.95rem] lg:text-[2.2rem] font-medium leading-[1.2] tracking-[-0.01em] text-[#F3EBDD] text-balance',
    rule: 'w-14 h-px bg-gradient-to-r from-[#C6A46A] to-transparent',
  },
  showcase: {
    wrapper: 'space-y-2',
    eyebrow: 'text-[10px] font-mono-tabular uppercase tracking-[0.2em] text-[#C6A46A]/85',
    quote:
      'font-display text-xl sm:text-2xl lg:text-[1.65rem] font-medium leading-[1.25] tracking-[-0.01em] text-[#F3EBDD]',
    rule: 'w-12 h-px bg-gradient-to-r from-[#C6A46A]/85 to-transparent',
  },
  collection: {
    wrapper: 'space-y-1.5',
    eyebrow: 'text-[10px] font-mono-tabular uppercase tracking-[0.22em] text-[#C6A46A]',
    quote:
      'font-display text-xl sm:text-2xl font-medium leading-[1.28] tracking-[-0.01em] text-[#F3EBDD]',
    rule: 'w-10 h-px bg-[#C6A46A]/65',
  },
  editorial: {
    wrapper: 'space-y-2',
    eyebrow: 'text-[10px] font-mono-tabular uppercase tracking-[0.22em] text-[#C6A46A]',
    quote:
      'font-display text-xl sm:text-2xl lg:text-[1.75rem] font-medium leading-[1.24] tracking-[-0.01em] text-[#F3EBDD]',
    rule: 'w-12 h-px bg-gradient-to-r from-[#C6A46A] to-transparent',
  },
  compact: {
    wrapper: 'space-y-1.5',
    eyebrow: 'text-[10px] font-mono-tabular uppercase tracking-[0.18em] text-[#C6A46A]',
    quote:
      'font-display text-lg sm:text-xl font-medium leading-[1.3] tracking-[-0.01em] text-[#F3EBDD]',
    rule: 'w-9 h-px bg-[#C6A46A]/60',
  },
};

export default function CeyvanaBrandStatement({
  variant = 'showcase',
  showEyebrow = false,
  className = '',
}: CeyvanaBrandStatementProps) {
  const styles = VARIANT_CLASSES[variant];

  return (
    <figure className={`ceyvana-statement-reveal ${styles.wrapper} ${className}`}>
      {showEyebrow && (
        <figcaption className={styles.eyebrow}>
          CEYVANA · Signature Statement
        </figcaption>
      )}
      <blockquote lang="en" className={styles.quote}>
        Every spice has a{' '}
        <span className="ceyvana-statement-gold ceyvana-statement-gold-1">story</span>. Every
        flavour has a{' '}
        <span className="ceyvana-statement-gold ceyvana-statement-gold-2">heritage</span>.
      </blockquote>
      <div className={`${styles.rule} ceyvana-statement-rule`} aria-hidden="true" />
    </figure>
  );
}
