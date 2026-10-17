import React, { useId } from 'react';

export interface M3TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const M3TextField: React.FC<M3TextFieldProps> = ({
  label,
  helperText,
  error,
  leadingIcon,
  trailingIcon,
  id,
  className = '',
  disabled,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const helperId = `${inputId}-helper`;

  const hasError = Boolean(error);

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className={`text-xs font-semibold px-1 tracking-wide transition-colors ${
            hasError
              ? 'text-m3-error'
              : 'text-m3-on-surface-variant'
          }`}
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center group">
        {leadingIcon && (
          <div className="absolute left-3.5 text-m3-outline pointer-events-none group-focus-within:text-m3-primary transition-colors flex items-center">
            {leadingIcon}
          </div>
        )}

        <input
          id={inputId}
          aria-describedby={helperText || error ? helperId : undefined}
          aria-invalid={hasError}
          disabled={disabled}
          className={`w-full bg-m3-surface text-m3-on-surface text-xs sm:text-sm rounded-xl py-2.5 px-3.5 transition-all duration-150 placeholder:text-m3-outline outline-none ${
            leadingIcon ? 'pl-10' : ''
          } ${trailingIcon ? 'pr-10' : ''} ${
            hasError
              ? 'border-2 border-m3-error focus:border-m3-error'
              : 'border border-m3-outline-variant hover:border-m3-outline focus:border-2 focus:border-m3-primary'
          } disabled:bg-m3-surface-container disabled:text-m3-on-surface/40 disabled:border-m3-outline-variant/30`}
          {...props}
        />

        {trailingIcon && (
          <div className="absolute right-3.5 text-m3-outline flex items-center">
            {trailingIcon}
          </div>
        )}
      </div>

      {(error || helperText) && (
        <p
          id={helperId}
          className={`text-[11px] px-1 font-medium transition-colors ${
            hasError ? 'text-m3-error' : 'text-m3-on-surface-variant'
          }`}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
};
