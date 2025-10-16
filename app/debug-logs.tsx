import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { errorLogger } from '../utils/errorLogger';

export default function DebugLogsScreen() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    const errorLogs = await errorLogger.getLogs();
    setLogs(errorLogs);
    setLoading(false);
  };

  const handleClearLogs = () => {
    Alert.alert(
      'Clear Logs',
      'Are you sure you want to clear all error logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await errorLogger.clearLogs();
            await loadLogs();
            Alert.alert('Success', 'Error logs cleared');
          },
        },
      ]
    );
  };

  const handleShareLogs = async () => {
    const logsText = await errorLogger.exportLogs();
    await Share.share({
      message: logsText,
      title: 'Farm2Go Error Logs',
    });
  };


  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading logs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Debug Logs</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity onPress={loadLogs} style={styles.actionButton}>
          <Text style={styles.actionButtonText}>🔄 Refresh</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShareLogs} style={styles.actionButton}>
          <Text style={styles.actionButtonText}>📤 Share</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleClearLogs} style={[styles.actionButton, styles.dangerButton]}>
          <Text style={[styles.actionButtonText, styles.dangerButtonText]}>🗑️ Clear</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.count}>
        {logs.length} error{logs.length !== 1 ? 's' : ''} logged
      </Text>

      <ScrollView style={styles.logsList}>
        {logs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No errors logged yet</Text>
            <Text style={styles.emptySubtext}>Errors will appear here when they occur</Text>
          </View>
        ) : (
          logs.map((log, index) => (
            <View key={index} style={styles.logItem}>
              <View style={styles.logHeader}>
                <Text style={styles.logTimestamp}>
                  {new Date(log.timestamp).toLocaleString()}
                </Text>
                <Text style={styles.logPlatform}>{log.platform}</Text>
              </View>
              <Text style={styles.logError}>{log.error}</Text>
              {log.stack && (
                <ScrollView horizontal style={styles.logStack}>
                  <Text style={styles.logStackText}>{log.stack}</Text>
                </ScrollView>
              )}
              {log.extra && (
                <Text style={styles.logExtra}>
                  {JSON.stringify(log.extra, null, 2)}
                </Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    backgroundColor: '#1f2937',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSpacer: {
    width: 80,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#059669',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#ef4444',
  },
  dangerButtonText: {
    color: '#ffffff',
  },
  count: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  logsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  logItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logTimestamp: {
    fontSize: 12,
    color: '#6b7280',
  },
  logPlatform: {
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logError: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 8,
  },
  logStack: {
    maxHeight: 100,
    marginBottom: 8,
  },
  logStackText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    padding: 8,
    borderRadius: 4,
  },
  logExtra: {
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    padding: 8,
    borderRadius: 4,
    fontFamily: 'monospace',
  },
});
