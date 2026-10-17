import React from 'react';

export type M3ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'danger';
export type M3ButtonSize = 'sm' | 'md' | 'lg';

export interface M3ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: M3ButtonVariant;
  size?: M3ButtonSize;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const M3Button: React.FC<M3ButtonProps> = ({
  variant = 'filled',
  size = 'md',
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-full transition-all duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m3-primary focus-visible:ring-offset-2 disabled:opacity-38 disabled:pointer-events-none';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 min-h-[36px] gap-1.5',
    md: 'text-xs sm:text-sm px-4 py-2 min-h-[44px] sm:min-h-[40px] gap-2',
    lg: 'text-sm sm:text-base px-6 py-2.5 min-h-[48px] gap-2.5',
  }[size];

  const variantStyles = {
    filled:
      'bg-m3-primary text-m3-on-primary shadow-xs hover:shadow-m3-elevation-1 hover:brightness-105 active:brightness-95 active:shadow-none',
    tonal:
      'bg-m3-secondary-container text-m3-on-secondary-container hover:brightness-95 active:brightness-90',
    outlined:
      'bg-transparent border border-m3-outline text-m3-primary hover:bg-m3-primary/8 active:bg-m3-primary/12',
    text: 'bg-transparent text-m3-primary hover:bg-m3-primary/8 active:bg-m3-primary/12',
    danger:
      'bg-m3-error text-m3-on-error shadow-xs hover:shadow-m3-elevation-1 hover:brightness-105 active:brightness-95',
  }[variant];

  return (
    <button
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
