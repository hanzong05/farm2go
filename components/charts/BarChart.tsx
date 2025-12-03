import React, { useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  const [containerWidth, setContainerWidth] = useState(300);
  const max = maxValue || Math.max(...data.map(d => d.value), 1);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width);
  };

  if (horizontal) {
    return (
      <ScrollView
        style={[styles.container, { height }]}
        onLayout={handleLayout}
        showsVerticalScrollIndicator={true}
      >
        {data.map((item, index) => {
          const barWidth = (item.value / max) * (containerWidth - 150);
          const percentage = (item.value / max) * 100;

          return (
            <View key={index} style={styles.horizontalBarContainer}>
              <View style={styles.horizontalLabelContainer}>
                <Text style={styles.horizontalLabel} numberOfLines={2}>
                  {item.label}
                </Text>
              </View>
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
      </ScrollView>
    );
  }

  // Vertical bar chart
  const spacing = data.length > 6 ? 4 : 8;
  const totalSpacing = (data.length - 1) * spacing + 16;
  const barWidth = Math.max((containerWidth - totalSpacing) / data.length, 20);

  return (
    <View style={styles.container} onLayout={handleLayout}>
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
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  barWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 2,
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  labelText: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 6,
    textAlign: 'center',
  },
  valueText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  horizontalBarContainer: {
    marginBottom: 20,
  },
  horizontalLabelContainer: {
    minWidth: 130,
    maxWidth: 130,
    marginBottom: 6,
  },
  horizontalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
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
