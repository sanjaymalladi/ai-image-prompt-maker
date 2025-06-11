
import React from 'react';

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
}

// Alert styles are designed to be fairly theme-agnostic due to use of contrasting text and icon colors
// against semi-transparent backgrounds. The main concern is the close button's focus ring.
const alertStyles = {
  success: {
    bg: 'bg-green-500/20 border-green-500/40', // Slightly more opaque for better definition on black
    text: 'text-green-300',
    iconColor: 'text-green-400',
    focusRing: 'focus:ring-green-400',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
  },
  error: {
    bg: 'bg-red-500/20 border-red-500/40',
    text: 'text-red-300',
    iconColor: 'text-red-400',
    focusRing: 'focus:ring-red-400',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    ),
  },
  warning: {
    bg: 'bg-yellow-500/20 border-yellow-500/40',
    text: 'text-yellow-300',
    iconColor: 'text-yellow-400',
    focusRing: 'focus:ring-yellow-400',
    icon: (
       <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.216 3.031-1.742 3.031H4.42c-1.526 0-2.492-1.697-1.742-3.031l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-3a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
    ),
  },
  info: {
    bg: 'bg-sky-500/20 border-sky-500/40',
    text: 'text-sky-300',
    iconColor: 'text-sky-400',
    focusRing: 'focus:ring-sky-400',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
    ),
  },
};

export const Alert: React.FC<AlertProps> = ({ type, message, onClose }) => {
  const styles = alertStyles[type];

  return (
    <div className={`p-4 border rounded-md flex items-start space-x-3 ${styles.bg} ${styles.text}`} role="alert">
      <div className={`flex-shrink-0 ${styles.iconColor}`}>{styles.icon}</div>
      <div className="flex-1 text-sm">
        {message}
      </div>
      {onClose && (
        <button 
          onClick={onClose} 
          className={`ml-auto -mx-1.5 -my-1.5 p-1.5 rounded-md focus:outline-none focus:ring-2 ${styles.focusRing} ${styles.iconColor} hover:opacity-80 transition-opacity`} 
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
};