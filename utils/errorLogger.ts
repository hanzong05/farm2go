import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

interface ErrorLog {
  timestamp: string;
  error: string;
  stack?: string;
  userAgent?: string;
  appVersion?: string;
  platform: string;
  extra?: any;
}

class ErrorLogger {
  private logFile = `${FileSystem.documentDirectory}error-logs.json`;
  private maxLogs = 100; // Keep last 100 errors

  /**
   * Log an error to both Sentry (if available) and local storage
   */
  async logError(error: Error | string, extra?: any): Promise<void> {
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      platform: Platform.OS,
      appVersion: process.env.EXPO_PUBLIC_APP_VERSION || 'unknown',
      extra,
    };

    // Log to console
    console.error('🚨 Error logged:', errorLog);

    // Save to local storage
    await this.saveToLocalStorage(errorLog);
  }

  /**
   * Log a map-specific error with location context
   */
  async logMapError(error: Error | string, location?: { latitude: number; longitude: number }): Promise<void> {
    await this.logError(error, {
      category: 'map',
      location,
      mapProvider: 'Google Maps',
    });
  }

  /**
   * Save error to local file system
   */
  private async saveToLocalStorage(errorLog: ErrorLog): Promise<void> {
    try {
      // Read existing logs
      let logs: ErrorLog[] = [];
      const fileInfo = await FileSystem.getInfoAsync(this.logFile);

      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(this.logFile);
        logs = JSON.parse(content);
      }

      // Add new log
      logs.unshift(errorLog);

      // Keep only last N logs
      if (logs.length > this.maxLogs) {
        logs = logs.slice(0, this.maxLogs);
      }

      // Save back to file
      await FileSystem.writeAsStringAsync(this.logFile, JSON.stringify(logs, null, 2));
    } catch (e) {
      console.error('Failed to save error log to file:', e);
    }
  }

  /**
   * Get all stored error logs
   */
  async getLogs(): Promise<ErrorLog[]> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(this.logFile);
      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(this.logFile);
        return JSON.parse(content);
      }
    } catch (e) {
      console.error('Failed to read error logs:', e);
    }
    return [];
  }

  /**
   * Clear all logs
   */
  async clearLogs(): Promise<void> {
    try {
      await FileSystem.deleteAsync(this.logFile, { idempotent: true });
      console.log('✅ Error logs cleared');
    } catch (e) {
      console.error('Failed to clear error logs:', e);
    }
  }

  /**
   * Export logs as string (for sharing/debugging)
   */
  async exportLogs(): Promise<string> {
    const logs = await this.getLogs();
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Set up global error handlers
   */
  setupGlobalHandlers(): void {
    // Catch unhandled promise rejections
    const originalHandler = ErrorUtils.getGlobalHandler();

    ErrorUtils.setGlobalHandler((error, isFatal) => {
      this.logError(error, { isFatal, type: 'unhandled' });

      // Call original handler
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });

    console.log('✅ Global error handlers set up');
  }
}

// Export singleton instance
export const errorLogger = new ErrorLogger();

// Setup global handlers on import
if (!__DEV__) {
  errorLogger.setupGlobalHandlers();
}
