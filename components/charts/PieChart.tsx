import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

interface PieChartData {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieChartData[];
  size?: number;
  showLegend?: boolean;
}

export default function PieChart({ data, size, showLegend = true }: PieChartProps) {
  const [containerWidth, setContainerWidth] = useState(300);
  const chartSize = size || Math.min(containerWidth * 0.7, 200);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width);
  };
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  }

  const radius = chartSize / 2;
  const innerRadius = radius * 0.6; // Donut chart
  let currentAngle = -90; // Start from top

  const createArc = (startAngle: number, endAngle: number, outerR: number, innerR: number) => {
    const startOuterX = radius + outerR * Math.cos((Math.PI * startAngle) / 180);
    const startOuterY = radius + outerR * Math.sin((Math.PI * startAngle) / 180);
    const endOuterX = radius + outerR * Math.cos((Math.PI * endAngle) / 180);
    const endOuterY = radius + outerR * Math.sin((Math.PI * endAngle) / 180);

    const startInnerX = radius + innerR * Math.cos((Math.PI * endAngle) / 180);
    const startInnerY = radius + innerR * Math.sin((Math.PI * endAngle) / 180);
    const endInnerX = radius + innerR * Math.cos((Math.PI * startAngle) / 180);
    const endInnerY = radius + innerR * Math.sin((Math.PI * startAngle) / 180);

    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return `
      M ${startOuterX} ${startOuterY}
      A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${endOuterX} ${endOuterY}
      L ${startInnerX} ${startInnerY}
      A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${endInnerX} ${endInnerY}
      Z
    `;
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <View style={styles.chartWrapper}>
        <Svg width={chartSize + 32} height={chartSize + 32} viewBox={`-16 -16 ${chartSize + 32} ${chartSize + 32}`}>
          <G>
            {data.map((item, index) => {
              const percentage = (item.value / total) * 100;
              const angle = (percentage / 100) * 360;
              const path = createArc(currentAngle, currentAngle + angle, radius, innerRadius);

              // Calculate label position
              const labelAngle = currentAngle + angle / 2;
              const labelRadius = radius * 0.75;
              const labelX = radius + labelRadius * Math.cos((Math.PI * labelAngle) / 180);
              const labelY = radius + labelRadius * Math.sin((Math.PI * labelAngle) / 180);

              currentAngle += angle;

              return (
                <G key={index}>
                  <Path d={path} fill={item.color} />
                  {percentage > 5 && (
                    <SvgText
                      x={labelX}
                      y={labelY}
                      fill="#ffffff"
                      fontSize="14"
                      fontWeight="700"
                      textAnchor="middle"
                      alignmentBaseline="middle"
                    >
                      {percentage.toFixed(0)}%
                    </SvgText>
                  )}
                </G>
              );
            })}
            {/* Center circle for donut effect */}
            <Circle cx={radius} cy={radius} r={innerRadius} fill="#ffffff" />
          </G>
        </Svg>
      </View>

      {showLegend && (
        <View style={styles.legend}>
          {data.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabel}>{item.label}</Text>
              <Text style={styles.legendValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  chartWrapper: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  legend: {
    width: '100%',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  legendColor: {
    width: 14,
    height: 14,
    borderRadius: 3,
    marginRight: 10,
  },
  legendLabel: {
    flex: 1,
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  legendValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    minWidth: 32,
    textAlign: 'right',
  },
});
