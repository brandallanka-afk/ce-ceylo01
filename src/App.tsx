import {lazy, Suspense, useEffect} from 'react';
import CartDrawer from './components/CartDrawer';
import {ErrorBoundary} from './components/ErrorBoundary';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import {StoreProvider, useStore} from './context/StoreContext';
import {setOrganizationWebsiteStructuredData} from './utils/seo';

const HomePage = lazy(() => import('./pages/HomePage'));
const BrandStorePage = lazy(() => import('./pages/BrandStorePage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const HandCraftsPage = lazy(() => import('./pages/HandCraftsPage'));
const WholesalePage = lazy(() => import('./pages/WholesalePage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const StoriesPage = lazy(() => import('./pages/StoriesPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));

function PageRouter() {
  const {route, lang} = useStore();

  useEffect(() => {
    setOrganizationWebsiteStructuredData(lang);
  }, [lang]);

  const renderPage = () => {
    switch (route.page) {
      case 'ceyvana':
        return <BrandStorePage brandId="ceyvana" />;
      case 'ceylomira':
        return <BrandStorePage brandId="ceylomira" />;
      case 'product':
        return <ProductDetailPage slug={route.productSlug} />;
      case 'hand-crafts':
        return <HandCraftsPage />;
      case 'wholesale':
        return <WholesalePage />;
      case 'portfolio':
        return <PortfolioPage />;
      case 'about':
        return <AboutPage />;
      case 'stories':
        return <StoriesPage />;
      case 'contact':
        return <ContactPage />;
      case 'cart':
        return <CartPage />;
      case 'privacy':
        return <PrivacyPolicyPage />;
      case 'terms':
        return <TermsPage />;
      case 'admin':
        return <AdminLayout />;
      case 'home':
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#151312] text-[#F3EBDD]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#C6A46A] focus:text-[#151312] focus:rounded-md focus:text-xs focus:font-medium"
      >
        {lang === 'si' ? 'ප්‍රධාන අන්තර්ගතයට යන්න' : 'Skip to main content'}
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center text-sm text-[#A99B88]">
                {lang === 'si' ? 'පූරණය වෙමින්...' : 'Loading...'}
              </div>
            }
          >
            {renderPage()}
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <PageRouter />
    </StoreProvider>
  );
}
