import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './pages/LandingPage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { DashboardPage } from './pages/DashboardPage';
import { CentreMatchesPage } from './pages/CentreMatchesPage';
import { CourseMatchesPage } from './pages/CourseMatchesPage';
import { ProfileSettingsPage } from './pages/ProfileSettingsPage';
import { AdminPage } from './pages/AdminPage';
import { OnboardingModal } from './components/OnboardingModal';
import { PrivacyNoticeModal } from './components/PrivacyNoticeModal';
import { dataService } from './services/dataService';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('landing');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState<string | undefined>(undefined);
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(undefined);
  const [hasCheckedFirstLogin, setHasCheckedFirstLogin] = useState(false);

  // Sync activeTab when user login state changes
  useEffect(() => {
    if (!loading) {
      if (user) {
        if (activeTab === 'landing' || activeTab === 'signin' || activeTab === 'signup') {
          setActiveTab('dashboard');
        }

        // Check if student has 0 exams; if so, open onboarding modal
        if (!hasCheckedFirstLogin) {
          dataService.getStudentExams(user.id).then(exams => {
            if (exams.length === 0) {
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

  const handleNavigateToCentreMatches = (cohortId?: string) => {
    setSelectedCohortId(cohortId);
    setActiveTab('centre-matches');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToCourseMatches = (courseId?: string) => {
    setSelectedCourseId(courseId);
    setActiveTab('course-matches');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-navy-950 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-navy-900 border-t-amber-400 rounded-full animate-spin" />
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Loading NPTEL Exam Buddy...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
      />

      <main className="flex-1">
        {/* Unauthenticated Pages */}
        {!user && activeTab === 'landing' && (
          <LandingPage
            onGoToSignIn={() => setActiveTab('signin')}
            onGoToSignUp={() => setActiveTab('signup')}
            onOpenPrivacyNotice={() => setIsPrivacyOpen(true)}
          />
        )}

        {!user && activeTab === 'signin' && (
          <SignInPage
            onGoToSignUp={() => setActiveTab('signup')}
            onSuccess={() => setActiveTab('dashboard')}
          />
        )}

        {!user && activeTab === 'signup' && (
          <SignUpPage
            onGoToSignIn={() => setActiveTab('signin')}
            onSuccess={() => {
              setActiveTab('dashboard');
              setIsOnboardingOpen(true);
            }}
          />
        )}

        {/* Authenticated Pages */}
        {user && activeTab === 'dashboard' && (
          <DashboardPage
            onOpenOnboarding={() => setIsOnboardingOpen(true)}
            onNavigateToCentreMatches={handleNavigateToCentreMatches}
            onNavigateToCourseMatches={handleNavigateToCourseMatches}
          />
        )}

        {user && activeTab === 'centre-matches' && (
          <CentreMatchesPage initialCohortId={selectedCohortId} />
        )}

        {user && activeTab === 'course-matches' && (
          <CourseMatchesPage initialCourseId={selectedCourseId} />
        )}

        {user && activeTab === 'profile' && <ProfileSettingsPage />}

        {user && activeTab === 'admin' && <AdminPage />}
      </main>

      <Footer />

      {/* Onboarding / AI Hall Ticket Extraction Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onExamSaved={() => {
          setActiveTab('dashboard');
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
