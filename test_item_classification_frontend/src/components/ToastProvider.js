import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import '../styles/import.css';

const ToastContext = createContext(null);

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// PUBLIC_INTERFACE
export function ToastProvider({ children }) {
  /** Provides addToast/removeToast for app-wide notifications. */
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const addToast = useCallback(
    ({ type = 'info', title, message, durationMs = 3500 }) => {
      const id = makeId();
      setToasts((prev) => [...prev, { id, type, title, message }]);

      if (durationMs && durationMs > 0) {
        const timer = setTimeout(() => removeToast(id), durationMs);
        timers.current.set(id, timer);
      }
      return id;
    },
    [removeToast]
  );

  const updateToast = useCallback((id, patch) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const value = useMemo(
    () => ({ addToast, removeToast, updateToast }),
    [addToast, removeToast, updateToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role="status">
            <div className="toast-header">
              <div className="toast-title">{t.title || (t.type === 'error' ? 'Error' : 'Notice')}</div>
              <button className="toast-close" onClick={() => removeToast(t.id)} aria-label="Dismiss notification">
                ×
              </button>
            </div>
            {t.message ? <div className="toast-message">{t.message}</div> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// PUBLIC_INTERFACE
export function useToast() {
  /** Hook to access toast controls. */
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
