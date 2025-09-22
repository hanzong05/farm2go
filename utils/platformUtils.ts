import { Platform } from 'react-native';

// Safe wrapper for localStorage operations
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.warn(`Error reading localStorage key "${key}":`, error);
        return null;
      }
    }
    return null;
  },

  setItem: (key: string, value: string): boolean => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
        return false;
      }
    }
    return false;
  },

  removeItem: (key: string): boolean => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.warn(`Error removing localStorage key "${key}":`, error);
        return false;
      }
    }
    return false;
  },

  clear: (): boolean => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.clear();
        return true;
      } catch (error) {
        console.warn('Error clearing localStorage:', error);
        return false;
      }
    }
    return false;
  }
};

// Safe wrapper for window operations
export const safeWindow = {
  getLocation: () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return {
        pathname: window.location?.pathname || '',
        search: window.location?.search || '',
        hash: window.location?.hash || '',
        href: window.location?.href || ''
      };
    }
    return {
      pathname: '',
      search: '',
      hash: '',
      href: ''
    };
  },

  getNavigator: () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.navigator) {
      return {
        userAgent: window.navigator.userAgent || ''
      };
    }
    return {
      userAgent: ''
    };
  },

  replaceState: (state: any, title: string, url: string): boolean => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history) {
      try {
        window.history.replaceState(state, title, url);
        return true;
      } catch (error) {
        console.warn('Error replacing browser state:', error);
        return false;
      }
    }
    return false;
  },

  getURLSearchParams: (search?: string): URLSearchParams | null => {
    if (Platform.OS === 'web' && typeof URLSearchParams !== 'undefined') {
      try {
        return new URLSearchParams(search || safeWindow.getLocation().search);
      } catch (error) {
        console.warn('Error creating URLSearchParams:', error);
        return null;
      }
    }
    return null;
  }
};

// Memory management utilities
export const memoryUtils = {
  // Create a cleanup function for component unmounting
  createCleanup: (cleanupFunctions: (() => void)[]): (() => void) => {
    return () => {
      cleanupFunctions.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.warn('Error during cleanup:', error);
        }
      });
    };
  },

  // Safe timer creation with automatic cleanup
  createTimer: (callback: () => void, delay: number): (() => void) => {
    const timerId = setTimeout(callback, delay);
    return () => clearTimeout(timerId);
  },

  // Safe interval creation with automatic cleanup
  createInterval: (callback: () => void, delay: number): (() => void) => {
    const intervalId = setInterval(callback, delay);
    return () => clearInterval(intervalId);
  }
};

// Platform detection utilities
export const platformUtils = {
  isWeb: Platform.OS === 'web',
  isNative: Platform.OS !== 'web',
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',

  // Check if running in a native app environment
  isNativeApp: () => {
    return Platform.OS !== 'web';
  },

  // Check if browser APIs are available
  hasBrowserAPIs: () => {
    return Platform.OS === 'web' && typeof window !== 'undefined';
  }
};