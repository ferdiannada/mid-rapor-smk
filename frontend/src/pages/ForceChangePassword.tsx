import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';
import { Navigate, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Check, AlertCircle, Loader2 } from 'lucide-react';
import { M3Button, M3TextField } from '../components/m3';

export const ForceChangePassword: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const requirements = useMemo(() => {
    return [
      { id: 'length', label: 'Minimal 6 karakter', isValid: newPass.length >= 6 },
      { id: 'match', label: 'Konfirmasi sandi cocok', isValid: Boolean(newPass) && newPass === confirmPass },
    ];
  }, [newPass, confirmPass]);

  const allRequirementsMet = requirements.every((req) => req.isValid);

  if (user && !user.is_initial_password) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!allRequirementsMet) {
      setError('Pastikan semua persyaratan kata sandi terpenuhi.');
      return;
    }

    setIsLoading(true);
    try {
      await authService.changePassword(currentPass, newPass);
      setMessage('Kata sandi berhasil diperbarui.');
      await refreshUser();
      setTimeout(() => {
        navigate('/');
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Gagal mengubah kata sandi. Pastikan data benar.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-m3-surface-container-low flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-m3-surface-container-lowest rounded-[28px] p-6 sm:p-8 shadow-m3-elevation-2 border border-m3-outline-variant/30 animate-m3-enter">
        <div className="mb-6 space-y-2 text-center">
          <div className="w-12 h-12 rounded-full bg-m3-primary-container text-m3-on-primary-container flex items-center justify-center mx-auto mb-2">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-m3-on-surface">Buat Kata Sandi Baru</h1>
          <p className="text-xs text-m3-on-surface-variant leading-relaxed">
            Akun Anda masih menggunakan kata sandi bawaan awal. Demi keamanan data nilai siswa, silakan buat kata sandi baru untuk melanjutkan.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 p-3.5 rounded-2xl bg-m3-error-container text-m3-on-error-container text-xs font-medium flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mb-5 p-3.5 rounded-2xl bg-m3-secondary-container text-m3-on-secondary-container text-xs font-bold flex items-center gap-2"
          >
            <Check className="w-4 h-4 shrink-0" />
            <span>{message} Mengalihkan ke dashboard...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <M3TextField
            label="Kata Sandi Saat Ini (NIP/NIK Bawaan)"
            type={showCurrent ? 'text' : 'password'}
            value={currentPass}
            onChange={(e) => setCurrentPass(e.target.value)}
            required
            placeholder="Masukkan kata sandi saat ini..."
            trailingIcon={
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                aria-label={showCurrent ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                className="p-1 text-m3-outline hover:text-m3-on-surface rounded-full cursor-pointer transition-colors"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />

          <M3TextField
            label="Kata Sandi Baru"
            type={showNew ? 'text' : 'password'}
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            required
            placeholder="Minimal 6 karakter..."
            trailingIcon={
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                aria-label={showNew ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                className="p-1 text-m3-outline hover:text-m3-on-surface rounded-full cursor-pointer transition-colors"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />

          <M3TextField
            label="Konfirmasi Kata Sandi Baru"
            type="password"
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            required
            placeholder="Ulangi kata sandi baru..."
          />

          {/* Requirements Checklist */}
          <div className="p-3.5 bg-m3-surface-container rounded-2xl space-y-2 border border-m3-outline-variant/20">
            <p className="text-[11px] font-bold text-m3-on-surface-variant">Syarat Keamanan:</p>
            <div className="grid grid-cols-1 gap-1.5">
              {requirements.map((req) => (
                <div key={req.id} className="flex items-center gap-2 text-xs">
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                      req.isValid
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-m3-outline-variant text-m3-on-surface-variant'
                    }`}
                  >
                    {req.isValid ? <Check className="w-2.5 h-2.5" /> : '•'}
                  </span>
                  <span
                    className={
                      req.isValid
                        ? 'text-emerald-700 font-semibold'
                        : 'text-m3-on-surface-variant'
                    }
                  >
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <M3Button
              type="submit"
              variant="filled"
              size="lg"
              className="w-full"
              disabled={isLoading || !allRequirementsMet}
              icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
            >
              {isLoading ? 'Menyimpan...' : 'Simpan Kata Sandi & Lanjutkan'}
            </M3Button>
          </div>
        </form>
      </div>
    </div>
  );
};
