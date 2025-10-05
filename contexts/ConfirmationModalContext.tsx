import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import ConfirmationModal from '../components/ConfirmationModal';

interface ConfirmationModalState {
  visible: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  isDestructive: boolean;
  onConfirm: () => void;
}

interface ConfirmationModalContextType {
  showConfirmation: (
    title: string,
    message: string,
    isDestructive?: boolean,
    confirmText?: string,
    cancelText?: string
  ) => Promise<boolean>;
  hideConfirmation: () => void;
}

const ConfirmationModalContext = createContext<ConfirmationModalContextType | undefined>(undefined);

export const useConfirmationModal = () => {
  const context = useContext(ConfirmationModalContext);
  if (!context) {
    throw new Error('useConfirmationModal must be used within a ConfirmationModalProvider');
  }
  return context;
};

interface ConfirmationModalProviderProps {
  children: ReactNode;
}

export const ConfirmationModalProvider: React.FC<ConfirmationModalProviderProps> = ({ children }) => {
  const [modalState, setModalState] = useState<ConfirmationModalState>({
    visible: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    isDestructive: false,
    onConfirm: () => {},
  });

  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const showConfirmation = (
    title: string,
    message: string,
    isDestructive: boolean = false,
    confirmText: string = 'Confirm',
    cancelText: string = 'Cancel'
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setModalState({
        visible: true,
        title,
        message,
        confirmText,
        cancelText,
        isDestructive,
        onConfirm: () => {
          setModalState(prev => ({ ...prev, visible: false }));
          if (resolveRef.current) {
            resolveRef.current(true);
            resolveRef.current = null;
          }
        },
      });
    });
  };

  const hideConfirmation = () => {
    setModalState(prev => ({ ...prev, visible: false }));
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
  };

  return (
    <ConfirmationModalContext.Provider value={{ showConfirmation, hideConfirmation }}>
      {children}

      {/* Global confirmation modal - renders at root level */}
      <ConfirmationModal
        visible={modalState.visible}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        isDestructive={modalState.isDestructive}
        onConfirm={modalState.onConfirm}
        onCancel={hideConfirmation}
      />
    </ConfirmationModalContext.Provider>
  );
};