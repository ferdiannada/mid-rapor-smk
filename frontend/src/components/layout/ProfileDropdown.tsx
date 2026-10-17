import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, KeyRound, Database, Shield, GraduationCap } from 'lucide-react';
import { User as UserType } from '../../types';
import { useClickOutside } from '../../hooks/useClickOutside';

interface ProfileDropdownProps {
  user: UserType | null;
  logout: () => void;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ user, logout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false), isOpen);

  const getRoleBadge = (role?: string) => {
    if (role === 'admin') {
      return (
        <span className="bg-m3-secondary-container text-m3-on-secondary-container text-[11px] px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
          <Shield className="w-3 h-3" /> Administrator
        </span>
      );
    }
    return (
      <span className="bg-m3-primary-container text-m3-on-primary-container text-[11px] px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
        <GraduationCap className="w-3 h-3" /> Guru Pengajar
      </span>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-1.5 pr-3 rounded-full hover:bg-m3-surface-container transition-all cursor-pointer border border-transparent hover:border-m3-outline-variant/30 group select-none min-h-[44px]"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <div className="w-9 h-9 rounded-full bg-m3-primary text-m3-on-primary font-bold flex items-center justify-center shadow-xs text-xs">
          {user?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="text-left hidden md:block">
          <p className="text-xs font-bold text-m3-on-surface line-clamp-1">{user?.name}</p>
          <p className="text-[10px] text-m3-on-surface-variant font-medium capitalize">
            {user?.role === 'admin'
              ? 'Administrator'
              : user?.wali_kelas_rombel
              ? `Wali Kelas (${user.wali_kelas_rombel.name})`
              : 'Guru'}
          </p>
        </div>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 bg-m3-surface-container-high text-m3-on-surface rounded-[24px] p-3 shadow-m3-elevation-3 border border-m3-outline-variant/30 z-50 animate-m3-enter"
        >
          {/* User Info Header */}
          <div className="p-3 border-b border-m3-outline-variant/20 flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-m3-primary-container text-m3-on-primary-container font-bold text-base flex items-center justify-center shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-m3-on-surface truncate">{user?.name}</p>
              <p className="text-xs text-m3-on-surface-variant truncate mb-1.5">{user?.email}</p>
              {getRoleBadge(user?.role)}
            </div>
          </div>

          {/* Academic & Dapodik Info */}
          <div className="p-3 bg-m3-surface rounded-2xl my-2 space-y-1.5 text-xs text-m3-on-surface-variant border border-m3-outline-variant/20">
            {user?.nip_nik && (
              <div className="flex justify-between">
                <span>NIP/NIK:</span>
                <span className="font-semibold text-m3-on-surface font-mono">{user.nip_nik}</span>
              </div>
            )}
            {user?.wali_kelas_rombel && (
              <div className="flex justify-between">
                <span>Wali Kelas:</span>
                <span className="font-bold text-m3-primary">{user.wali_kelas_rombel.name}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1 border-t border-m3-outline-variant/20">
              <span className="text-[11px] text-m3-on-surface-variant flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-m3-primary" /> Dapodik Sync
              </span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                Terhubung
              </span>
            </div>
          </div>

          {/* Menu Items */}
          <div className="space-y-1 pt-1">
            <Link
              to="/force-change-password"
              onClick={() => setIsOpen(false)}
              role="menuitem"
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-m3-on-surface hover:bg-m3-surface rounded-full transition cursor-pointer min-h-[40px]"
            >
              <KeyRound className="w-4 h-4 text-m3-outline" />
              <span>Ganti Kata Sandi</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              role="menuitem"
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-m3-error hover:bg-m3-error-container/40 rounded-full transition cursor-pointer min-h-[40px]"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar dari Akun</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
