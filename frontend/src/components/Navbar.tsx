import React from 'react';
import { Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ProfileDropdown } from './layout/ProfileDropdown';

interface NavbarProps {
  isScrolled?: boolean;
  onOpenMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isScrolled = false, onOpenMobileMenu }) => {
  const { user, logout } = useAuth();

  return (
    <header
      className={`sticky top-0 left-0 right-0 z-30 h-16 w-full px-4 sm:px-6 flex items-center justify-between transition-all duration-200 ${
        isScrolled
          ? 'bg-m3-surface-container text-m3-on-surface shadow-m3-elevation-2 border-b border-m3-outline-variant/30'
          : 'bg-m3-surface text-m3-on-surface border-b border-m3-outline-variant/20'
      }`}
    >
      {/* Left: Mobile hamburger button & Greeting */}
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="md:hidden flex items-center justify-center p-2 rounded-full text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-container-high min-h-[44px] min-w-[44px] transition-colors cursor-pointer"
            aria-label="Buka menu navigasi"
          >
            <Menu className="w-5 h-5 text-m3-on-surface" />
          </button>
        )}

        <div className="flex flex-col">
          <span className="text-sm font-bold text-m3-on-surface tracking-tight truncate max-w-[200px] sm:max-w-none">
            Halo, <span className="text-m3-primary">{user?.name?.split(' ')[0] || 'Pengguna'}</span>
          </span>
          <span className="text-[10px] text-m3-on-surface-variant font-medium hidden sm:inline">
            {new Date().toLocaleDateString('id-ID', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* Right: User Profile & Actions */}
      <div className="flex items-center gap-2">
        <ProfileDropdown user={user} logout={logout} />
      </div>
    </header>
  );
};
