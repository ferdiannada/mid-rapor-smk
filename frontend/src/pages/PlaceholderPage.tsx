import React from 'react';
import { Clock, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { M3Button, M3Card } from '../components/m3';

interface PlaceholderProps {
  title: string;
  subtitle: string;
  phase: string;
}

export const PlaceholderPage: React.FC<PlaceholderProps> = ({ title, subtitle, phase }) => {
  return (
    <div className="space-y-6">
      {/* M3 Primary Tonal Header Banner */}
      <div className="rounded-[28px] bg-m3-primary-container text-m3-on-primary-container p-6 sm:p-8 border border-m3-primary/10 shadow-xs">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{title}</h1>
        <p className="text-xs sm:text-sm text-m3-on-primary-container/85 mt-1.5 leading-relaxed">{subtitle}</p>
      </div>

      {/* M3 Elevated Empty State Card */}
      <M3Card variant="elevated" className="p-8 sm:p-12 text-center space-y-4 max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-full bg-m3-primary-container text-m3-primary flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-m3-on-surface">Modul Sedang Disiapkan</h2>
        <p className="text-xs text-m3-on-surface-variant leading-relaxed">
          Fitur ini dijadwalkan pada <strong>{phase}</strong> sesuai dokumen PRD pengembangan sistem rapor SMK.
        </p>
        <div className="pt-2">
          <Link to="/">
            <M3Button variant="tonal" icon={<ArrowLeft className="w-4 h-4" />}>
              Kembali ke Dashboard
            </M3Button>
          </Link>
        </div>
      </M3Card>
    </div>
  );
};
