import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './pages/LandingPage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { DashboardPage } from './pages/DashboardPage';
import { FindBuddiesPage } from './pages/FindBuddiesPage';
import { ProfileSettingsPage } from './pages/ProfileSettingsPage';
import { AdminPage } from './pages/AdminPage';
import { OnboardingModal } from './components/OnboardingModal';
import { PrivacyNoticeModal } from './components/PrivacyNoticeModal';
import { BrandedLoadingLogo } from './components/BrandedLoadingLogo';
import { dataService } from './services/dataService';

const tabToHash: Record<string, string> = {
  'dashboard': 'my-exam',
  'find-buddies': 'find-buddies',
  'profile': 'profile',
  'signin': 'signin',
  'signup': 'signup',
  'landing': 'landing',
  'admin': 'admin',
};

const hashToTab: Record<string, string> = {
  'my-exam': 'dashboard',
  'dashboard': 'dashboard',
  'find-buddies': 'find-buddies',
  'profile': 'profile',
  'signin': 'signin',
  'signup': 'signup',
  'landing': 'landing',
  'admin': 'admin',
};

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('landing');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [hasCheckedFirstLogin, setHasCheckedFirstLogin] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Reliable navigation handler with hash history and double-click prevention
  const handleTabChange = (newTab: string) => {
    if (activeTab === newTab) return; // Prevent duplicate requests on rapid clicks
    setActiveTab(newTab);
    const targetHash = tabToHash[newTab] || newTab;
    if (window.location.hash !== `#${targetHash}`) {
      window.history.pushState(null, '', `#${targetHash}`);
    }
  };

  // Synchronize activeTab with URL hash for browser back/forward buttons
  useEffect(() => {
    const syncWithHash = () => {
      const raw = window.location.hash.replace(/^#/, '');
      if (raw && hashToTab[raw]) {
        const tab = hashToTab[raw];
        if (tab === 'admin' && !user?.is_admin) return;
        setActiveTab(tab);
      }
    };

    window.addEventListener('hashchange', syncWithHash);
    window.addEventListener('popstate', syncWithHash);
    syncWithHash();

    return () => {
      window.removeEventListener('hashchange', syncWithHash);
      window.removeEventListener('popstate', syncWithHash);
    };
  }, [user]);

  // Sync activeTab when user login state changes
  useEffect(() => {
    if (!loading) {
      if (user) {
        if (activeTab === 'landing' || activeTab === 'signin' || activeTab === 'signup') {
          const raw = window.location.hash.replace(/^#/, '');
          const initialTab = (raw && hashToTab[raw] && hashToTab[raw] !== 'signin' && hashToTab[raw] !== 'signup' && hashToTab[raw] !== 'landing')
            ? hashToTab[raw]
            : 'dashboard';
          setActiveTab(initialTab);
          const targetHash = tabToHash[initialTab] || 'my-exam';
          if (window.location.hash !== `#${targetHash}`) {
            window.history.replaceState(null, '', `#${targetHash}`);
          }
        }

        // Check if student has no exam yet; if so, open onboarding modal once
        if (!hasCheckedFirstLogin) {
          dataService.getStudentExam(user.id).then(exam => {
            if (!exam) {
              setIsOnboardingOpen(true);
            }
            setHasCheckedFirstLogin(true);
          });
        }
      } else {
        if (activeTab !== 'signin' && activeTab !== 'signup') {
          setActiveTab('landing');
        }
      }
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900 text-white font-sans p-4">
        <BrandedLoadingLogo message="Loading MoocDeal..." size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-slate-100">
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
      />

      <main className="flex-1">
        {/* Unauthenticated Pages */}
        {!user && activeTab === 'landing' && (
          <LandingPage
            onGoToSignIn={() => handleTabChange('signin')}
            onGoToSignUp={() => handleTabChange('signup')}
            onOpenPrivacyNotice={() => setIsPrivacyOpen(true)}
          />
        )}

        {!user && activeTab === 'signin' && (
          <SignInPage
            onGoToSignUp={() => handleTabChange('signup')}
            onSuccess={() => handleTabChange('dashboard')}
          />
        )}

        {!user && activeTab === 'signup' && (
          <SignUpPage
            onGoToSignIn={() => handleTabChange('signin')}
            onSuccess={() => {
              handleTabChange('dashboard');
              setIsOnboardingOpen(true);
            }}
          />
        )}

        {/* Authenticated Pages: Preserved in memory to eliminate layout jumps and blank screens */}
        {user && (
          <>
            <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
              <DashboardPage
                onOpenOnboarding={() => setIsOnboardingOpen(true)}
                onNavigateToFindBuddies={() => handleTabChange('find-buddies')}
                refreshTrigger={refreshTrigger}
                isActive={activeTab === 'dashboard'}
              />
            </div>

            <div className={activeTab === 'find-buddies' ? 'block' : 'hidden'}>
              <FindBuddiesPage
                onGoToMyExam={() => handleTabChange('dashboard')}
                isActive={activeTab === 'find-buddies'}
              />
            </div>

            {activeTab === 'profile' && (
              <ProfileSettingsPage />
            )}

            {/* Separate restricted route for administrators */}
            {user?.is_admin && activeTab === 'admin' && (
              <AdminPage />
            )}
          </>
        )}
      </main>

      <Footer />

      {/* Minimal First-Login Onboarding / AI Extraction Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onExamSaved={() => {
          setRefreshTrigger(prev => prev + 1);
          handleTabChange('dashboard');
        }}
      />

      {/* Global Privacy Notice Modal */}
      <PrivacyNoticeModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />
    </div>
  );
};


export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
