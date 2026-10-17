import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Award,
  FileSpreadsheet,
  Users,
  Printer,
  Menu,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface MobileBottomNavProps {
  onOpenMenu?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenMenu }) => {
  const { user } = useAuth();
  const isWaliKelas = Boolean(user?.wali_kelas_rombel);
  const isAdmin = user?.role === 'admin';

  const items = [
    { to: '/', label: 'Beranda', icon: LayoutDashboard, show: true },
    { to: '/grades/input', label: 'Nilai', icon: Award, show: !isAdmin },
    { to: '/grades/recap', label: 'Rekap', icon: FileSpreadsheet, show: isAdmin || isWaliKelas },
    { to: '/students', label: 'Siswa', icon: Users, show: !isWaliKelas || isAdmin },
    { to: '/reports', label: 'Rapor', icon: Printer, show: isAdmin || isWaliKelas },
  ];

  return (
    <nav
      aria-label="Navigasi Utama Mobile"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-20 bg-m3-surface-container border-t border-m3-outline-variant/30 px-2 flex items-center justify-around shadow-m3-elevation-2 select-none"
    >
      {items
        .filter((item) => item.show)
        .slice(0, 4)
        .map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className="flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 cursor-pointer group"
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`h-8 w-16 rounded-full flex items-center justify-center transition-all duration-200 ${
                      isActive
                        ? 'bg-m3-secondary-container text-m3-on-secondary-container shadow-xs'
                        : 'text-m3-on-surface-variant group-hover:text-m3-on-surface group-hover:bg-m3-surface-container-high'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                  </div>
                  <span
                    className={`text-[11px] mt-1 tracking-tight truncate max-w-[64px] text-center transition-colors ${
                      isActive
                        ? 'font-bold text-m3-on-surface'
                        : 'font-medium text-m3-on-surface-variant'
                    }`}
                  >
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}

      {/* Menu item that opens the drawer */}
      {onOpenMenu && (
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 cursor-pointer group"
          aria-label="Buka navigasi selengkapnya"
        >
          <div className="h-8 w-16 rounded-full flex items-center justify-center text-m3-on-surface-variant group-hover:text-m3-on-surface group-hover:bg-m3-surface-container-high transition-all duration-200">
            <Menu className="w-5 h-5 shrink-0" />
          </div>
          <span className="text-[11px] font-medium text-m3-on-surface-variant mt-1 tracking-tight">
            Menu
          </span>
        </button>
      )}
    </nav>
  );
};
