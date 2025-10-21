import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import Toast, { ToastConfig } from '../components/Toast';
import { setGlobalToast } from '../utils/alert';

interface ToastContextType {
  show: (config: ToastConfig) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toastConfig, setToastConfig] = useState<ToastConfig | null>(null);

  const show = React.useCallback((config: ToastConfig) => {
    console.log('🔔 ToastProvider.show called:', config);
    setToastConfig(config);
  }, []);

  const hide = React.useCallback(() => {
    setToastConfig(null);
  }, []);

  // Register global toast function
  useEffect(() => {
    console.log('📱 ToastProvider: Registering global toast');
    setGlobalToast(show);
    console.log('✅ ToastProvider: Global toast registered');
  }, [show]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <Toast config={toastConfig} onHide={hide} />
    </ToastContext.Provider>
  );
};
