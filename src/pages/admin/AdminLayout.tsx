import {FormEvent, lazy, Suspense, useEffect, useState} from 'react';
import {
  getMultiFactorResolver,
  GoogleAuthProvider,
  multiFactor,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  TotpMultiFactorGenerator,
  type MultiFactorError,
  type MultiFactorResolver,
  type User,
} from 'firebase/auth';
import {Lock, LogOut, ShieldCheck} from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import {ErrorBoundary} from '../../components/ErrorBoundary';
import {useStore} from '../../context/StoreContext';
import {
  FIREBASE_DATABASE_ID,
  FIREBASE_PROJECT_ID,
} from '../../lib/firebase';
import {auth} from '../../lib/firebaseAdmin';
import {fetchAdminSession} from '../../services/commerceApi';
import {ensureAndFetchAdminProfile} from '../../services/firestoreService';
import type {
  AdminRole,
  AdminSectionId,
  AdminSessionInfo,
  AdminUserRecord,
} from '../../types/admin';
import {updatePageSeo} from '../../utils/seo';

const OverviewPanel = lazy(() => import('./panels/OverviewPanel'));
const CatalogPanels = lazy(() => import('./panels/CatalogPanels'));
const PricingStockPanels = lazy(() => import('./panels/PricingStockPanels'));
const CommercePanels = lazy(() => import('./panels/CommercePanels'));
const SettingsReportsPanels = lazy(() => import('./panels/SettingsReportsPanels'));
const PortfolioAdminPanels = lazy(() => import('./panels/PortfolioAdminPanels'));

const ADMIN_NAV: {id: AdminSectionId; label: string; roles: AdminRole[]}[] = [
  {id: 'overview', label: '01. Overview', roles: ['super_admin', 'catalog_manager', 'order_manager']},
  {id: 'products', label: '02. Product Management', roles: ['super_admin', 'catalog_manager']},
  {id: 'categories', label: '03. Category Management', roles: ['super_admin', 'catalog_manager']},
  {id: 'brands', label: '04. Brand Management', roles: ['super_admin', 'catalog_manager']},
  {id: 'variants', label: '05. Variant Management', roles: ['super_admin', 'catalog_manager']},
  {id: 'pricing', label: '06. Price Management', roles: ['super_admin', 'catalog_manager']},
  {id: 'stock', label: '07. Stock Management', roles: ['super_admin', 'catalog_manager']},
  {id: 'orders', label: '08. Order Management', roles: ['super_admin', 'order_manager']},
  {id: 'customers', label: '09. Customer Management', roles: ['super_admin', 'order_manager']},
  {id: 'enquiries', label: '10. Wholesale Enquiries', roles: ['super_admin', 'order_manager', 'catalog_manager']},
  {id: 'promotions', label: '11. Promotions', roles: ['super_admin', 'catalog_manager']},
  {id: 'content', label: '12. Website Content', roles: ['super_admin']},
  {id: 'reports', label: '13. Monthly Reports', roles: ['super_admin', 'order_manager']},
  {id: 'languages', label: '14. Language Management', roles: ['super_admin']},
  {id: 'settings', label: '15. Admin Settings', roles: ['super_admin']},
  {id: 'intl_enquiries', label: '16. International Enquiries', roles: ['super_admin', 'order_manager', 'catalog_manager']},
  {id: 'audit_logs', label: '17. Security & Audit Logs', roles: ['super_admin']},
  {id: 'portfolio_generator', label: '18. Portfolio Generator', roles: ['super_admin', 'catalog_manager']},
  {id: 'catalogue_requests', label: '19. Catalogue Requests', roles: ['super_admin', 'catalog_manager', 'order_manager']},
];

export default function AdminLayout() {
  const {navigate, lang} = useStore();
  const [user, setUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminUserRecord | null>(null);
  const [sessionInfo, setSessionInfo] = useState<AdminSessionInfo | null>(null);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [section, setSection] = useState<AdminSectionId>('overview');

  useEffect(() => {
    updatePageSeo({
      title: 'Protected Admin Portal | Ceylon Heritage House',
      description: 'Protected operations dashboard for Ceyvana and Ceylomira catalog, stock, and order management.',
      page: 'admin',
      lang,
      noindex: true,
    });
  }, [lang]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (current) => {
      setUser(current);
      setAuthError('');
      if (!current) {
        setAdminProfile(null);
        setSessionInfo(null);
        setAuthLoading(false);
        return;
      }
      try {
        const profile = await ensureAndFetchAdminProfile({
          uid: current.uid,
          email: current.email,
          emailVerified: current.emailVerified,
          displayName: current.displayName,
        });
        setAdminProfile(profile);
        if (profile) {
          const srvSession = await fetchAdminSession().catch(() => null);
          setSessionInfo(srvSession);
        }
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Unable to verify admin privileges.');
        setAdminProfile(null);
        setSessionInfo(null);
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const handleGoogleSignIn = async () => {
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setMfaResolver(null);
    } catch (err) {
      const maybeMfa = err as {code?: string};
      if (maybeMfa?.code === 'auth/multi-factor-auth-required') {
        try {
          const resolver = getMultiFactorResolver(auth, err as MultiFactorError);
          setMfaResolver(resolver);
          return;
        } catch (resolverErr) {
          setAuthError(
            resolverErr instanceof Error ? resolverErr.message : 'MFA challenge required.',
          );
          return;
        }
      }
      setAuthError(err instanceof Error ? err.message : 'Sign-in cancelled or failed.');
    }
  };

  const handleMfaChallengeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!mfaResolver) return;
    setAuthError('');
    try {
      const totpHint = mfaResolver.hints.find(
        (h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID,
      );
      if (!totpHint) {
        setAuthError(
          'This account uses an MFA factor type not supported in inline popup verification. Please use your enrolled TOTP authenticator factor.',
        );
        return;
      }
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(
        totpHint.uid,
        mfaCode.trim(),
      );
      await mfaResolver.resolveSignIn(assertion);
      setMfaResolver(null);
      setMfaCode('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Invalid verification code.');
    }
  };

  if (authLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center text-sm text-[#A99B88]">
        Verifying administrator session...
      </div>
    );
  }

  if (!user || !adminProfile) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="bg-[#211C1A] border border-[#C6A46A]/25 rounded-lg p-8 space-y-5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)]">
          <div className="flex items-center gap-2.5 text-[#F3EBDD]">
            <ShieldCheck className="w-6 h-6 text-[#C6A46A]" aria-hidden="true" />
            <h1 className="font-display text-3xl font-medium">Protected Admin Portal</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <BrandLogo brandId="ceyvana" size="xs" eager />
            <BrandLogo brandId="ceylomira" size="xs" eager />
          </div>

          <p className="text-sm text-[#D2C6B5] leading-relaxed">
            Sign in with your verified Google administrator account to manage Ceyvana &amp;
            Ceylomira products, variants, stock, orders, and international enquiries.
          </p>

          <div className="text-xs text-[#A99B88] bg-[#2A2522] border border-[#3B332E] rounded-md p-3 font-mono-tabular space-y-1">
            <p>Project: {FIREBASE_PROJECT_ID}</p>
            <p className="truncate">Database: {FIREBASE_DATABASE_ID}</p>
          </div>

          {mfaResolver && (
            <form
              onSubmit={handleMfaChallengeSubmit}
              className="p-4 bg-[#2A2522] border border-[#C6A46A]/55 rounded-md space-y-3"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-[#F3EBDD]">
                <Lock className="w-4 h-4 text-[#C6A46A]" aria-hidden="true" />
                <span>Multi-Factor Verification Required</span>
              </div>
              <input
                type="text"
                inputMode="numeric"
                required
                placeholder="Enter 6-digit authenticator code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-tabular bg-[#151312] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
              />
              <button
                type="submit"
                className="w-full px-4 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] cursor-pointer whitespace-nowrap"
              >
                Verify &amp; Continue
              </button>
            </form>
          )}

          {user && !adminProfile && (
            <div className="p-3 text-xs bg-[#501C2B]/40 border border-[#F3B0B6]/40 text-[#F3B0B6] rounded-md">
              Signed in as {user.email}, which does not have active admin permissions.
            </div>
          )}

          {authError && (
            <div className="p-3 text-xs bg-[#501C2B]/40 border border-[#F3B0B6]/40 text-[#F3B0B6] rounded-md">
              {authError}
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            {!user ? (
              <button
                type="button"
                onClick={() => void handleGoogleSignIn()}
                className="px-5 py-2.5 text-sm font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] transition-colors cursor-pointer whitespace-nowrap"
              >
                Sign in with Google
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void signOut(auth)}
                className="px-5 py-2.5 text-sm font-medium bg-[#501C2B] text-[#F3EBDD] border border-[#7A1F28] rounded-md hover:bg-[#6E1924] cursor-pointer whitespace-nowrap"
              >
                Sign Out
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('home')}
              className="px-5 py-2.5 text-sm font-medium border border-[#3B332E] bg-[#2A2522] text-[#F3EBDD] hover:border-[#C6A46A] rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              Return to Storefront
            </button>
          </div>
        </div>
      </div>
    );
  }

  const visibleNav = ADMIN_NAV.filter((item) => item.roles.includes(adminProfile.role));
  const enrolledMfaCount = multiFactor(user).enrolledFactors.length;

  const renderPanel = () => {
    switch (section) {
      case 'overview':
        return <OverviewPanel onNavigateSection={setSection} />;
      case 'products':
      case 'categories':
      case 'brands':
      case 'variants':
        return <CatalogPanels section={section} />;
      case 'pricing':
      case 'stock':
        return <PricingStockPanels section={section} />;
      case 'orders':
      case 'customers':
      case 'enquiries':
      case 'intl_enquiries':
      case 'promotions':
        return <CommercePanels section={section} />;
      case 'content':
      case 'reports':
      case 'languages':
      case 'settings':
      case 'audit_logs':
        return <SettingsReportsPanels section={section} sessionInfo={sessionInfo} />;
      case 'portfolio_generator':
      case 'catalogue_requests':
        return <PortfolioAdminPanels section={section} />;
    }
  };

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-[#F3EBDD]">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-[#C6A46A]/25">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <BrandLogo brandId="ceyvana" size="2xs" sheen={false} />
              <BrandLogo brandId="ceylomira" size="2xs" sheen={false} />
              <p className="text-xs text-[#D2C6B5]">
                Admin Portal · <span className="font-mono-tabular font-medium text-[#C6A46A]">{adminProfile.role}</span> · {adminProfile.email}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono-tabular text-[#A99B88]">
              <span>MFA Factors: {enrolledMfaCount > 0 ? `${enrolledMfaCount} enrolled` : '0 enrolled'}</span>
              {sessionInfo && (
                <span>
                  Server MFA Policy: {sessionInfo.mfaRequired ? 'Required' : 'Optional'} · App Check:{' '}
                  {sessionInfo.appCheckEnforced ? 'Enforced' : 'Optional'}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-[#3B332E] bg-[#211C1A] text-[#F3EBDD] rounded-md hover:border-[#C6A46A] hover:bg-[#2A2522] transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5 text-[#C6A46A]" />
            <span>Sign Out</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <aside className="lg:col-span-3 bg-[#211C1A] border border-[#3B332E] rounded-lg p-3">
            <nav className="space-y-1" aria-label="Admin Sections">
              {visibleNav.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`w-full text-left px-3 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap truncate ${
                    section === item.id
                      ? 'bg-[#C6A46A] text-[#151312]'
                      : 'text-[#D2C6B5] hover:bg-[#2A2522] hover:text-[#C6A46A]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          <section className="lg:col-span-9 min-w-0">
            <Suspense
              fallback={
                <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-12 text-center text-sm text-[#A99B88]">
                  Loading admin module...
                </div>
              }
            >
              {renderPanel()}
            </Suspense>
          </section>
        </div>
      </div>
    </ErrorBoundary>
  );
}

