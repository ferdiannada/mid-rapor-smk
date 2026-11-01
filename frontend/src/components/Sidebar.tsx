import React, { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Award,
  FileSpreadsheet,
  Users,
  ChevronLeft,
  ChevronRight,
  Database,
  Printer,
  CalendarCheck,
  BookOpen,
  GraduationCap,
  Layers,
  Target,
  Building2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

// M3 Collapsed Rail Tooltip
interface CollapsedTooltipProps {
  children: React.ReactNode;
  active?: boolean;
}

const CollapsedTooltip: React.FC<CollapsedTooltipProps> = ({ children, active }) => (
  <div
    role="tooltip"
    className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[70] invisible opacity-0 -translate-x-1 scale-95 group-hover:visible group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100 group-focus-visible:visible group-focus-visible:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:scale-100 transition-all duration-150 ease-out flex items-center"
  >
    <div className="px-3 py-1.5 rounded-lg bg-m3-surface-container-highest text-m3-on-surface text-xs font-semibold whitespace-nowrap shadow-m3-elevation-2 border border-m3-outline-variant/30 flex items-center gap-2">
      {children}
      {active && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-m3-secondary-container text-[10px] font-bold text-m3-on-secondary-container">
          Aktif
        </span>
      )}
    </div>
  </div>
);

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onCloseMobile }) => {
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768 && window.innerWidth < 1024;
    }
    return false;
  });

  // Responsive collapse adjustment on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1024) {
        setIsCollapsed(true);
      } else if (window.innerWidth >= 1024) {
        setIsCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  const isWaliKelas = Boolean(user?.wali_kelas_rombel);
  const isAdmin = user?.role === 'admin';

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { to: '/learning-objectives', label: 'Tujuan Pembelajaran (TP)', icon: Target, show: true },
    { to: '/grades/input', label: 'Input Nilai Mapel', icon: Award, show: !isAdmin },
    { to: '/grades/recap', label: 'Rekap Nilai Siswa', icon: FileSpreadsheet, show: isAdmin || isWaliKelas },
    { to: '/students', label: 'Data Peserta Didik', icon: Users, show: true },
    { to: '/settings/teachers', label: 'Manajemen Guru & PTK', icon: GraduationCap, show: isAdmin },
    { to: '/attendance', label: 'Kehadiran & Catatan', icon: CalendarCheck, show: isWaliKelas },
    { to: '/reports', label: 'Cetak Rapor', icon: Printer, show: isAdmin || isWaliKelas },
    { to: '/settings/school', label: 'Identitas Sekolah', icon: Building2, show: isAdmin },
    { to: '/settings/subjects', label: 'Mata Pelajaran & TP', icon: BookOpen, show: isAdmin },
    { to: '/settings/subject-groups', label: 'Kelompok Mata Pelajaran', icon: Layers, show: isAdmin },
    { to: '/settings/semester', label: 'Manajemen Semester', icon: CalendarCheck, show: isAdmin },
    { to: '/settings/dapodik', label: 'Koneksi Dapodik', icon: Database, show: isAdmin },
  ];

  return (
    <>
      {/* Mobile M3 Modal Navigation Drawer (< 768px) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          {/* M3 Scrim */}
          <div
            className="fixed inset-0 bg-slate-900/40 transition-opacity animate-in fade-in duration-200"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* M3 Drawer Body: rounded-e-[28px] */}
          <aside className="fixed top-0 bottom-0 left-0 w-72 max-w-[85vw] bg-m3-surface-container-low border-r border-m3-outline-variant/30 shadow-m3-elevation-3 z-10 flex flex-col justify-between p-4 rounded-e-[28px] animate-in slide-in-from-left duration-200 overflow-y-auto">
            <div className="space-y-4">
              {/* Header with Close */}
              <div className="flex items-center justify-between pb-3 border-b border-m3-outline-variant/20">
                <Link to="/" onClick={onCloseMobile} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-m3-primary flex items-center justify-center text-m3-on-primary font-black text-base shadow-xs">
                    R
                  </div>
                  <div>
                    <span className="text-base font-black text-m3-on-surface tracking-tight block">
                      RAPOR <span className="text-m3-primary">SMK</span>
                    </span>
                    <p className="text-[10px] text-m3-on-surface-variant font-medium">Kurikulum Merdeka</p>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="p-2 rounded-full text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-container min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition-colors"
                  aria-label="Tutup menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Identity Chip */}
              <div className="p-3 rounded-2xl bg-m3-surface border border-m3-outline-variant/30 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-m3-primary-container text-m3-on-primary-container font-bold text-xs flex items-center justify-center shrink-0">
                  {getInitials(user?.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-m3-on-surface truncate">{user?.name}</p>
                  <p className="text-[10px] text-m3-on-surface-variant truncate">
                    {isAdmin ? 'Admin Sekolah' : isWaliKelas ? `Wali ${user?.wali_kelas_rombel?.name}` : 'Guru Mapel'}
                  </p>
                </div>
              </div>

              {/* M3 Navigation Items */}
              <nav className="space-y-1">
                {navItems
                  .filter((item) => item.show)
                  .map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        onClick={onCloseMobile}
                        className={({ isActive }) =>
                          `flex items-center gap-3.5 px-4 py-2.5 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer min-h-[44px] ${
                            isActive
                              ? 'bg-m3-secondary-container text-m3-on-secondary-container shadow-xs'
                              : 'text-m3-on-surface-variant hover:bg-m3-surface-container hover:text-m3-on-surface'
                          }`
                        }
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    );
                  })}
              </nav>
            </div>

            {/* Footer Dapodik Sync Status */}
            <div className="pt-3 mt-4 border-t border-m3-outline-variant/20">
              <div className="p-2.5 rounded-xl bg-m3-surface border border-m3-outline-variant/20 text-[11px] text-m3-on-surface-variant flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  <Database className="w-3.5 h-3.5 text-m3-primary" />
                  <span>Dapodik Sync</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Aktif
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop & Tablet M3 Navigation Drawer / Rail (>= 768px) */}
      <aside
        className={`relative z-40 bg-m3-surface-container-low border-r border-m3-outline-variant/30 h-full flex flex-col justify-between hidden md:flex shrink-0 transition-all duration-200 ease-out ${
          isCollapsed ? 'w-20 px-2 pb-4 pt-5' : 'w-64 px-3 pb-4 pt-5'
        }`}
      >
        {/* Collapse Toggle Button */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="group absolute top-16 -right-3.5 z-50 w-7 h-7 bg-m3-surface border border-m3-outline-variant text-m3-on-surface hover:bg-m3-surface-container rounded-full flex items-center justify-center shadow-m3-elevation-1 transition-all duration-150 cursor-pointer"
          aria-label={isCollapsed ? 'Perluas Navigasi' : 'Minimalkan Navigasi'}
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        <div className="space-y-4 relative z-10">
          {/* Brand & Logo */}
          <div
            className={`flex items-center mb-4 transition-all ${
              isCollapsed ? 'justify-center px-0' : 'gap-3 px-2'
            }`}
          >
            <Link
              to="/"
              className={`group flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}
              aria-label="Beranda Rapor SMK"
            >
              <div className="w-10 h-10 shrink-0 rounded-2xl bg-m3-primary flex items-center justify-center text-m3-on-primary font-black text-base shadow-xs group-hover:brightness-105 transition-all">
                R
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <span className="text-base font-black text-m3-on-surface tracking-tight whitespace-nowrap block truncate">
                    RAPOR <span className="text-m3-primary">SMK</span>
                  </span>
                  <p className="text-[10px] text-m3-on-surface-variant font-medium truncate">
                    Kurikulum Merdeka
                  </p>
                </div>
              )}
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems
              .filter((item) => item.show)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `group relative flex items-center transition-all duration-150 cursor-pointer ${
                        isCollapsed
                          ? 'justify-center py-1.5'
                          : 'gap-3.5 px-4 py-2.5 rounded-full text-xs font-semibold'
                      } ${
                        isActive
                          ? isCollapsed
                            ? 'text-m3-on-secondary-container'
                            : 'bg-m3-secondary-container text-m3-on-secondary-container shadow-xs font-bold'
                          : 'text-m3-on-surface-variant hover:bg-m3-surface-container hover:text-m3-on-surface'
                      }`
                    }
                    aria-label={isCollapsed ? item.label : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        {isCollapsed ? (
                          <div
                            className={`w-12 h-8 rounded-full flex items-center justify-center transition-colors ${
                              isActive
                                ? 'bg-m3-secondary-container text-m3-on-secondary-container'
                                : 'group-hover:bg-m3-surface-container text-m3-on-surface-variant group-hover:text-m3-on-surface'
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <CollapsedTooltip active={isActive}>
                              <span>{item.label}</span>
                            </CollapsedTooltip>
                          </div>
                        ) : (
                          <>
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
          </nav>
        </div>

        {/* Footer Dapodik Sync Badge */}
        <div className="pt-3 border-t border-m3-outline-variant/20">
          {!isCollapsed ? (
            <div className="p-2.5 rounded-xl bg-m3-surface border border-m3-outline-variant/20 text-[11px] text-m3-on-surface-variant flex items-center justify-between">
              <span className="flex items-center gap-2 font-medium">
                <Database className="w-3.5 h-3.5 text-m3-primary" />
                <span>Dapodik Sync</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Aktif
              </span>
            </div>
          ) : (
            <div className="relative group flex justify-center py-1">
              <div
                className="w-9 h-9 rounded-xl bg-m3-surface border border-m3-outline-variant/30 flex items-center justify-center cursor-default hover:bg-m3-surface-container transition-colors"
                aria-label="Status: Dapodik Aktif"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
              <CollapsedTooltip>
                <span>Dapodik Terhubung</span>
              </CollapsedTooltip>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
