import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

const { width: screenWidth } = Dimensions.get('window');

interface LineChartData {
  label: string;
  value: number;
}

interface LineChartProps {
  data: LineChartData[];
  height?: number;
  color?: string;
  showDots?: boolean;
  showGrid?: boolean;
}

export default function LineChart({
  data,
  height = 200,
  color = '#10b981',
  showDots = true,
  showGrid = true,
}: LineChartProps) {
  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  }

  const chartWidth = screenWidth - 80;
  const chartHeight = height - 60;
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const minValue = Math.min(...data.map(d => d.value), 0);
  const valueRange = maxValue - minValue || 1;

  const xStep = chartWidth / (data.length - 1 || 1);

  const points = data.map((item, index) => {
    const x = index * xStep;
    const y = chartHeight - ((item.value - minValue) / valueRange) * chartHeight;
    return { x, y, value: item.value };
  });

  const pathData = points
    .map((point, index) => {
      if (index === 0) {
        return `M ${point.x} ${point.y}`;
      }
      return `L ${point.x} ${point.y}`;
    })
    .join(' ');

  // Create area fill path
  const areaPath = `${pathData} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;

  return (
    <View style={styles.container}>
      <Svg width={chartWidth} height={chartHeight + 10}>
        {/* Grid lines */}
        {showGrid && (
          <>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
              const y = chartHeight * ratio;
              return (
                <Line
                  key={index}
                  x1={0}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
              );
            })}
          </>
        )}

        {/* Area fill */}
        <Path d={areaPath} fill={color} opacity={0.1} />

        {/* Line */}
        <Path d={pathData} fill="none" stroke={color} strokeWidth="3" />

        {/* Dots */}
        {showDots &&
          points.map((point, index) => (
            <Circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="5"
              fill={color}
              stroke="#ffffff"
              strokeWidth="2"
            />
          ))}
      </Svg>

      {/* Labels */}
      <View style={styles.labelsContainer}>
        {data.map((item, index) => (
          <Text
            key={index}
            style={[
              styles.label,
              {
                width: chartWidth / data.length,
                textAlign: index === 0 ? 'left' : index === data.length - 1 ? 'right' : 'center',
              },
            ]}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        ))}
      </View>

      {/* Value indicators */}
      <View style={styles.valueIndicators}>
        <Text style={styles.valueText}>
          Max: <Text style={styles.valueBold}>{maxValue}</Text>
        </Text>
        <Text style={styles.valueText}>
          Min: <Text style={styles.valueBold}>{minValue}</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 16,
  },
  emptyContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  label: {
    fontSize: 10,
    color: '#6b7280',
  },
  valueIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  valueText: {
    fontSize: 12,
    color: '#6b7280',
  },
  valueBold: {
    fontWeight: '600',
    color: '#374151',
  },
});
