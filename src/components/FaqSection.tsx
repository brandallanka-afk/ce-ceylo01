import {useEffect} from 'react';
import {ChevronDown} from 'lucide-react';
import {type FaqEntry, setFaqStructuredData} from '../utils/seo';

interface FaqSectionProps {
  title: string;
  subtitle?: string;
  faqs: FaqEntry[];
  surfaceClass?: string;
}

export default function FaqSection({
  title,
  subtitle,
  faqs,
  surfaceClass = 'bg-[#211C1A]',
}: FaqSectionProps) {
  useEffect(() => {
    setFaqStructuredData(faqs);
    return () => setFaqStructuredData(null);
  }, [faqs]);

  if (!faqs || faqs.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="faq-section-heading"
      className={`border-t border-[#C6A46A]/25 py-16 lg:py-24 ${surfaceClass}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        <div className="lg:col-span-4 space-y-3">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-[#C6A46A]">
            Heritage Guide
          </p>
          <h2
            id="faq-section-heading"
            className="font-display text-3xl sm:text-4xl font-medium text-[#F3EBDD] text-balance"
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-[#D2C6B5] leading-relaxed">{subtitle}</p>
          )}
        </div>

        <div className="lg:col-span-8 divide-y divide-[#C6A46A]/20 border-y border-[#C6A46A]/20">
          {faqs.map((faq) => (
            <details key={faq.question} className="group py-5">
              <summary className="flex items-start justify-between gap-4 text-sm sm:text-base font-medium text-[#F3EBDD] cursor-pointer list-none min-h-[28px]">
                <span className="leading-snug">{faq.question}</span>
                <ChevronDown
                  className="w-4 h-4 shrink-0 mt-1 text-[#C6A46A] transition-transform duration-150 group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="mt-3 pr-8 text-sm text-[#D2C6B5] leading-relaxed">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
