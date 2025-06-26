
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'default';
}

export const Button: React.FC<ButtonProps> = ({ children, className, variant = 'primary', size = 'default', ...props }) => {
  const baseStyle = "font-semibold rounded-lg transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center justify-center gap-2";
  
  const variantStyles = {
    primary: "bg-sky-600 hover:bg-sky-700 text-white focus:ring-sky-500 focus:ring-offset-zinc-900 disabled:bg-sky-900 disabled:text-sky-700 disabled:cursor-not-allowed",
    secondary: "bg-gray-700 hover:bg-gray-600 text-gray-100 focus:ring-gray-500 focus:ring-offset-zinc-900 disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed",
  };

  const sizeStyles = {
    sm: "text-xs py-1 px-2",
    default: "text-sm py-2.5 px-5", // Assuming text-sm as a common base size, py-2.5 px-5 is current default padding
  };

  return (
    <button
      className={`${baseStyle} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
