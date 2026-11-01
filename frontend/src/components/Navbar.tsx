import React from 'react';
import { Menu, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { ProfileDropdown } from './layout/ProfileDropdown';

interface NavbarProps {
  isScrolled?: boolean;
  onOpenMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isScrolled = false, onOpenMobileMenu }) => {
  const { user, logout } = useAuth();
  const { isOnline, unsyncedCount, isSyncing, triggerSync } = useOfflineSync();

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
      <div className="flex items-center gap-2.5">
        {/* Global Connection & Outbox Sync Status */}
        {!isOnline ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
            <WifiOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Offline</span>
          </div>
        ) : unsyncedCount > 0 ? (
          <button
            type="button"
            onClick={() => triggerSync()}
            disabled={isSyncing}
            title="Klik untuk menyinkronkan data offline ke server"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{unsyncedCount} Antrean</span>
          </button>
        ) : (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20">
            <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Terhubung</span>
          </div>
        )}

        <ProfileDropdown user={user} logout={logout} />
      </div>
    </header>
  );
};
