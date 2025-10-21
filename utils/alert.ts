import { Platform, Alert as RNAlert } from 'react-native';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

// Global toast instance will be set by ToastProvider
let globalToastShow: ((config: any) => void) | null = null;

export const setGlobalToast = (showFn: (config: any) => void) => {
  globalToastShow = showFn;
};

/**
 * Cross-platform alert - uses native Alert on all platforms
 * This provides proper modal dialogs with buttons
 */
export const Alert = {
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: { cancelable?: boolean }
  ) => {
    // Use native Alert on all platforms
    // The Activity attachment issue was fixed by restarting the app
    RNAlert.alert(title, message, buttons, options);
  },
};

/**
 * Show a success toast message
 */
export const showSuccess = (message: string, title: string = 'Success') => {
  console.log('🎉 showSuccess called:', title, message);
  if (globalToastShow) {
    console.log('✅ Calling globalToastShow');
    globalToastShow({
      type: 'success',
      text1: title,
      text2: message,
      duration: 3000,
    });
  } else {
    console.warn('❌ Toast not initialized. Success:', title, message);
  }
};

/**
 * Show an error toast message
 */
export const showError = (message: string, title: string = 'Error') => {
  if (globalToastShow) {
    globalToastShow({
      type: 'error',
      text1: title,
      text2: message,
      duration: 4000,
    });
  } else {
    console.error('Toast not initialized. Error:', title, message);
  }
};

/**
 * Show an info toast message
 */
export const showInfo = (message: string, title: string = 'Info') => {
  if (globalToastShow) {
    globalToastShow({
      type: 'info',
      text1: title,
      text2: message,
      duration: 3000,
    });
  } else {
    console.info('Toast not initialized. Info:', title, message);
  }
};

/**
 * Show a warning toast message
 */
export const showWarning = (message: string, title: string = 'Warning') => {
  if (globalToastShow) {
    globalToastShow({
      type: 'warning',
      text1: title,
      text2: message,
      duration: 3500,
    });
  } else {
    console.warn('Toast not initialized. Warning:', title, message);
  }
};
