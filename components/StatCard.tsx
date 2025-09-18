import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

interface StatCardProps {
  title: string;
  value: string | number;
  color: string;
  backgroundColor?: string;
  icon: string;
  subtitle?: string;
  growth?: number;
  variant?: 'default' | 'bordered';
}

export default function StatCard({
  title,
  value,
  color,
  backgroundColor,
  icon,
  subtitle,
  growth,
  variant = 'default'
}: StatCardProps) {
  if (variant === 'bordered') {
    return (
      <View style={[styles.borderedStatCard, { borderLeftColor: color }]}>
        <View style={styles.borderedStatHeader}>
          <Text style={[styles.borderedStatIcon, { color }]}>{icon}</Text>
          <Text style={[styles.borderedStatValue, { color }]}>{value}</Text>
        </View>
        <Text style={styles.borderedStatTitle}>{title}</Text>
        {subtitle && <Text style={styles.borderedStatSubtitle}>{subtitle}</Text>}
        {growth !== undefined && (
          <Text style={[
            styles.growthText,
            { color: growth >= 0 ? '#16a34a' : '#dc2626' }
          ]}>
            {growth >= 0 ? '↗' : '↘'} {Math.abs(growth).toFixed(1)}%
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.statCard, backgroundColor ? { backgroundColor } : null]}>
      <View style={styles.statHeader}>
        <View style={[styles.statIconContainer, { backgroundColor: color }]}>
          <Text style={styles.statIcon}>{icon}</Text>
        </View>
        <View style={styles.statContent}>
          <Text style={[styles.statValue, { color }]}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Default variant styles
  statCard: {
    width: (width - 56) / 2,
    borderRadius: 18,
    padding: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  statHeader: {
    alignItems: 'center',
  },
  statIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statIcon: {
    fontSize: 24,
    color: '#ffffff',
  },
  statContent: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  statTitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Bordered variant styles
  borderedStatCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 8,
    borderLeftWidth: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  borderedStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  borderedStatIcon: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  borderedStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  borderedStatTitle: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 4,
  },
  borderedStatSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
    marginBottom: 8,
  },
  growthText: {
    fontSize: 12,
    fontWeight: '600',
  },
});