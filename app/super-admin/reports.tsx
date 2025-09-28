import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import HeaderComponent from '../../components/HeaderComponent';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

const { width } = Dimensions.get('window');

interface ReportData {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: string;
}

export default function SuperAdminReports() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState<ReportData[]>([]);

  useEffect(() => {
    loadProfile();
    loadReports();
  }, []);

  const loadProfile = async () => {
    try {
      const userData = await getUserWithProfile();
      if (userData?.profile) {
        setProfile(userData.profile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    // TODO: Implement actual data fetching
    setReports([
      {
        title: 'Total Users',
        value: '1,234',
        change: '+12.5%',
        changeType: 'positive',
        icon: '👥',
      },
      {
        title: 'Active Farmers',
        value: '456',
        change: '+8.2%',
        changeType: 'positive',
        icon: '🚜',
      },
      {
        title: 'Total Orders',
        value: '2,890',
        change: '+15.3%',
        changeType: 'positive',
        icon: '📦',
      },
      {
        title: 'Revenue',
        value: '₱45,670',
        change: '+22.1%',
        changeType: 'positive',
        icon: '💰',
      },
      {
        title: 'Products Listed',
        value: '789',
        change: '+5.7%',
        changeType: 'positive',
        icon: '🥬',
      },
      {
        title: 'System Errors',
        value: '12',
        change: '-45.2%',
        changeType: 'positive',
        icon: '⚠️',
      },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    await loadReports();
    setRefreshing(false);
  };

  const exportReport = (type: string) => {
    // TODO: Implement report export functionality
    console.log(`Exporting ${type} report`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <HeaderComponent profile={profile} />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={styles.loadingText}>Loading system reports...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderComponent
        profile={profile}
        showSearch={false}
        showMessages={true}
        showNotifications={true}
      />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#059669"
            colors={['#059669']}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>System Reports</Text>
          <Text style={styles.subtitle}>Analytics and performance metrics</Text>
        </View>

        {/* Key Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <View style={styles.metricsGrid}>
            {reports.map((report, index) => (
              <View key={index} style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricIcon}>{report.icon}</Text>
                  <View style={[
                    styles.changeIndicator,
                    report.changeType === 'positive' ? styles.positiveChange :
                    report.changeType === 'negative' ? styles.negativeChange : styles.neutralChange
                  ]}>
                    <Text style={[
                      styles.changeText,
                      report.changeType === 'positive' ? styles.positiveText :
                      report.changeType === 'negative' ? styles.negativeText : styles.neutralText
                    ]}>
                      {report.change}
                    </Text>
                  </View>
                </View>
                <Text style={styles.metricValue}>{report.value}</Text>
                <Text style={styles.metricTitle}>{report.title}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export Reports</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => exportReport('users')}
            >
              <Text style={styles.actionIcon}>📊</Text>
              <Text style={styles.actionTitle}>User Analytics</Text>
              <Text style={styles.actionDescription}>
                Detailed user registration and activity data
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => exportReport('sales')}
            >
              <Text style={styles.actionIcon}>💹</Text>
              <Text style={styles.actionTitle}>Sales Report</Text>
              <Text style={styles.actionDescription}>
                Revenue and transaction analytics
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => exportReport('system')}
            >
              <Text style={styles.actionIcon}>⚙️</Text>
              <Text style={styles.actionTitle}>System Health</Text>
              <Text style={styles.actionDescription}>
                Performance and error monitoring
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => exportReport('products')}
            >
              <Text style={styles.actionIcon}>📈</Text>
              <Text style={styles.actionTitle}>Product Analytics</Text>
              <Text style={styles.actionDescription}>
                Listing and engagement metrics
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  section: {
    backgroundColor: '#ffffff',
    marginTop: 12,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },
  metricCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    width: width < 768 ? '48%' : '31%',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricIcon: {
    fontSize: 20,
  },
  changeIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  positiveChange: {
    backgroundColor: '#dcfce7',
  },
  negativeChange: {
    backgroundColor: '#fee2e2',
  },
  neutralChange: {
    backgroundColor: '#f3f4f6',
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  positiveText: {
    color: '#059669',
  },
  negativeText: {
    color: '#dc2626',
  },
  neutralText: {
    color: '#6b7280',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  metricTitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },
  actionCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    width: width < 768 ? '48%' : '48%',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    textAlign: 'center',
  },
  actionDescription: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  bottomSpacing: {
    height: 40,
  },
});