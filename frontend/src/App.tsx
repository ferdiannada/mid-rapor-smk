import React, { useState, useRef, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageLoadingFallback } from './components/common/Skeleton';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { InPlaceReauthModal } from './components/common/InPlaceReauthModal';

// Code Splitting / Lazy Loaded Pages
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const ForceChangePassword = lazy(() =>
  import('./pages/ForceChangePassword').then((m) => ({ default: m.ForceChangePassword }))
);
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const DapodikSettings = lazy(() =>
  import('./pages/DapodikSettings').then((m) => ({ default: m.DapodikSettings }))
);
const SchoolSettings = lazy(() =>
  import('./pages/SchoolSettings').then((m) => ({ default: m.SchoolSettings }))
);
const SemesterManagement = lazy(() =>
  import('./pages/SemesterManagement').then((m) => ({ default: m.SemesterManagement }))
);
const TeacherManagement = lazy(() =>
  import('./pages/TeacherManagement').then((m) => ({ default: m.TeacherManagement }))
);
const StudentList = lazy(() =>
  import('./pages/StudentList').then((m) => ({ default: m.StudentList }))
);
const SubjectList = lazy(() =>
  import('./pages/SubjectList').then((m) => ({ default: m.SubjectList }))
);
const SubjectGroups = lazy(() =>
  import('./pages/SubjectGroups').then((m) => ({ default: m.SubjectGroups }))
);
const GradeInput = lazy(() =>
  import('./pages/GradeInput').then((m) => ({ default: m.GradeInput }))
);
const LearningObjectives = lazy(() =>
  import('./pages/LearningObjectives').then((m) => ({ default: m.LearningObjectives }))
);
const GradeRecap = lazy(() =>
  import('./pages/GradeRecap').then((m) => ({ default: m.GradeRecap }))
);
const Attendance = lazy(() =>
  import('./pages/Attendance').then((m) => ({ default: m.Attendance }))
);
const Reports = lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })));

// Protected Layout Frame
const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      if (mainRef.current) {
        setIsScrolled(mainRef.current.scrollTop > 10);
      }
    };
    const mainEl = mainRef.current;
    if (mainEl) {
      mainEl.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (mainEl) mainEl.removeEventListener('scroll', handleScroll);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-m3-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-m3-primary flex items-center justify-center text-white font-black text-xl animate-pulse">
            R
          </div>
          <p className="text-xs font-semibold text-m3-on-surface-variant">Memuat sistem rapor...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user?.is_initial_password && location.pathname !== '/force-change-password') {
    return <Navigate to="/force-change-password" replace />;
  }

  return (
    <div className="h-screen overflow-hidden flex bg-m3-surface selection:bg-m3-primary-container selection:text-m3-on-primary-container">
      {/* Sidebar (Desktop + Mobile Slide-Over Drawer) */}
      <Sidebar
        mobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0 relative">
        <Navbar
          isScrolled={isScrolled}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto pt-4 sm:pt-6 pb-24 md:pb-12 px-3 sm:px-6 lg:px-8"
        >
          <div className="max-w-[1600px] mx-auto w-full animate-m3-enter">
            <Suspense fallback={<PageLoadingFallback />}>{children}</Suspense>
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav onOpenMenu={() => setIsMobileMenuOpen(true)} />
      </div>

      {/* In-Place Re-Authentication Dialog on Session Expiration */}
      <InPlaceReauthModal />
    </div>
  );
};

// Admin Route Guard
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

// Teacher Route Guard (Grade Input is exclusive to teachers, not admin)
const GuruRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (user?.role === 'admin') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

// Wali Kelas Route Guard (Attendance and Class Notes are exclusive to Wali Kelas)
const WaliKelasRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (!user?.wali_kelas_rombel) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <Suspense
              fallback={
                <div className="h-screen w-full flex items-center justify-center bg-m3-surface">
                  <div className="w-10 h-10 rounded-2xl bg-m3-primary animate-pulse" />
                </div>
              }
            >
              <Routes>
                {/* Public Auth */}
                <Route path="/login" element={<Login />} />
                <Route path="/force-change-password" element={<ForceChangePassword />} />

                {/* Protected Routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedLayout>
                      <Dashboard />
                    </ProtectedLayout>
                  }
                />

                {/* Master Data */}
                <Route
                  path="/students"
                  element={
                    <ProtectedLayout>
                      <StudentList />
                    </ProtectedLayout>
                  }
                />

                {/* Settings & Admin */}
                <Route
                  path="/settings/school"
                  element={
                    <ProtectedLayout>
                      <AdminRoute>
                        <SchoolSettings />
                      </AdminRoute>
                    </ProtectedLayout>
                  }
                />
                <Route
                  path="/settings/dapodik"
                  element={
                    <ProtectedLayout>
                      <AdminRoute>
                        <DapodikSettings />
                      </AdminRoute>
                    </ProtectedLayout>
                  }
                />
                <Route
                  path="/settings/semester"
                  element={
                    <ProtectedLayout>
                      <AdminRoute>
                        <SemesterManagement />
                      </AdminRoute>
                    </ProtectedLayout>
                  }
                />
                <Route
                  path="/settings/teachers"
                  element={
                    <ProtectedLayout>
                      <AdminRoute>
                        <TeacherManagement />
                      </AdminRoute>
                    </ProtectedLayout>
                  }
                />
                <Route
                  path="/settings/subjects"
                  element={
                    <ProtectedLayout>
                      <AdminRoute>
                        <SubjectList />
                      </AdminRoute>
                    </ProtectedLayout>
                  }
                />
                <Route
                  path="/settings/subject-groups"
                  element={
                    <ProtectedLayout>
                      <AdminRoute>
                        <SubjectGroups />
                      </AdminRoute>
                    </ProtectedLayout>
                  }
                />
                <Route path="/admin/subjects" element={<Navigate to="/settings/subjects" replace />} />
                <Route path="/admin/subject-groups" element={<Navigate to="/settings/subject-groups" replace />} />

                {/* Grades & Reports */}
                <Route
                  path="/learning-objectives"
                  element={
                    <ProtectedLayout>
                      <LearningObjectives />
                    </ProtectedLayout>
                  }
                />
                <Route
                  path="/grades/input"
                  element={
                    <ProtectedLayout>
                      <GuruRoute>
                        <GradeInput />
                      </GuruRoute>
                    </ProtectedLayout>
                  }
                />
                <Route
                  path="/grades/recap"
                  element={
                    <ProtectedLayout>
                      <GradeRecap />
                    </ProtectedLayout>
                  }
                />
                <Route
                  path="/attendance"
                  element={
                    <ProtectedLayout>
                      <WaliKelasRoute>
                        <Attendance />
                      </WaliKelasRoute>
                    </ProtectedLayout>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedLayout>
                      <Reports />
                    </ProtectedLayout>
                  }
                />
                <Route
                  path="/change-password"
                  element={
                    <ProtectedLayout>
                      <ForceChangePassword />
                    </ProtectedLayout>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
