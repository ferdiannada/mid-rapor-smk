import React from 'react';

export type M3CardVariant = 'elevated' | 'filled' | 'outlined';

export interface M3CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: M3CardVariant;
  children: React.ReactNode;
}

export const M3Card: React.FC<M3CardProps> = ({
  variant = 'outlined',
  className = '',
  children,
  ...props
}) => {
  const baseStyles = 'rounded-2xl transition-all duration-150 overflow-hidden';

  const variantStyles = {
    elevated:
      'bg-m3-surface-container-lowest text-m3-on-surface shadow-m3-elevation-1 hover:shadow-m3-elevation-2 border border-m3-outline-variant/20',
    filled: 'bg-m3-surface-container-low text-m3-on-surface',
    outlined: 'bg-m3-surface text-m3-on-surface border border-m3-outline-variant/40',
  }[variant];

  return (
    <div className={`${baseStyles} ${variantStyles} ${className}`} {...props}>
      {children}
    </div>
  );
};
