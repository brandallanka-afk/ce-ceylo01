import {useEffect} from 'react';
import {ChevronRight} from 'lucide-react';
import {useStore} from '../context/StoreContext';
import {
  type BreadcrumbItem,
  buildPagePath,
  setBreadcrumbStructuredData,
} from '../utils/seo';

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  tone?: 'dark' | 'light';
}

export default function Breadcrumbs({items, tone = 'dark'}: BreadcrumbsProps) {
  const {lang, navigate} = useStore();

  useEffect(() => {
    setBreadcrumbStructuredData(items, lang);
    return () => setBreadcrumbStructuredData([], lang);
  }, [items, lang]);

  const linkClass =
    tone === 'light'
      ? 'text-[#A99B88] hover:text-[#F3EBDD] underline-offset-4 hover:underline'
      : 'text-[#A99B88] hover:text-[#C6A46A] underline-offset-4 hover:underline';

  const currentClass =
    tone === 'light' ? 'text-[#F3EBDD] font-medium' : 'text-[#C6A46A] font-medium';

  const sepClass = 'text-[#A99B88]/65';

  return (
    <nav aria-label="Breadcrumb" className="text-xs sm:text-sm">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="inline-flex items-center gap-1.5">
              {idx > 0 && <ChevronRight className={`w-3.5 h-3.5 ${sepClass}`} aria-hidden="true" />}
              {isLast || !item.page ? (
                <span aria-current="page" className={currentClass}>
                  {item.label}
                </span>
              ) : (
                <a
                  href={buildPagePath(item.page, {productSlug: item.productSlug, lang})}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(item.page!, item.productSlug);
                  }}
                  className={linkClass}
                >
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
