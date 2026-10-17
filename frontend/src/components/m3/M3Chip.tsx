import React from 'react';

export interface M3ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const M3Chip: React.FC<M3ChipProps> = ({
  selected = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m3-primary focus-visible:ring-offset-1 disabled:opacity-40 disabled:pointer-events-none min-h-[32px] ${
        selected
          ? 'bg-m3-secondary-container text-m3-on-secondary-container border border-m3-secondary-container shadow-xs'
          : 'bg-transparent text-m3-on-surface-variant border border-m3-outline-variant hover:bg-m3-surface-container hover:text-m3-on-surface'
      } ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
    </button>
  );
};
