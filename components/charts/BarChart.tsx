import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartData[];
  maxValue?: number;
  height?: number;
  showValues?: boolean;
  horizontal?: boolean;
}

export default function BarChart({
  data,
  maxValue,
  height = 200,
  showValues = true,
  horizontal = false,
}: BarChartProps) {
  const max = maxValue || Math.max(...data.map(d => d.value), 1);
  const chartWidth = screenWidth - 80;

  if (horizontal) {
    return (
      <View style={[styles.container, { height }]}>
        {data.map((item, index) => {
          const barWidth = (item.value / max) * (chartWidth - 100);
          const percentage = (item.value / max) * 100;

          return (
            <View key={index} style={styles.horizontalBarContainer}>
              <Text style={styles.horizontalLabel} numberOfLines={1}>
                {item.label}
              </Text>
              <View style={styles.horizontalBarWrapper}>
                <View
                  style={[
                    styles.horizontalBar,
                    {
                      width: barWidth,
                      backgroundColor: item.color || '#10b981',
                    },
                  ]}
                />
                {showValues && (
                  <Text style={styles.horizontalValue}>{item.value}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  // Vertical bar chart
  const barWidth = (chartWidth - (data.length - 1) * 12) / data.length;

  return (
    <View style={styles.container}>
      <View style={[styles.chartArea, { height }]}>
        {data.map((item, index) => {
          const barHeight = (item.value / max) * (height - 40);

          return (
            <View key={index} style={[styles.barWrapper, { width: barWidth }]}>
              {showValues && (
                <Text style={styles.valueText}>{item.value}</Text>
              )}
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: item.color || '#10b981',
                  },
                ]}
              />
              <Text style={styles.labelText} numberOfLines={2}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 16,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  barWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 4,
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  labelText: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 80,
  },
  valueText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  horizontalBarContainer: {
    marginBottom: 16,
  },
  horizontalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    maxWidth: 100,
  },
  horizontalBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  horizontalBar: {
    height: 24,
    borderRadius: 4,
    minWidth: 20,
  },
  horizontalValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
});
