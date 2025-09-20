import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { supabase } from '../../lib/supabase';

const { width: screenWidth } = Dimensions.get('window');

const colors = {
  primary: '#059669',
  secondary: '#10b981',
  white: '#ffffff',
  background: '#f0f9f4',
  text: '#0f172a',
  textSecondary: '#6b7280',
  border: '#d1fae5',
  shadow: 'rgba(0,0,0,0.1)',
};

interface SalesData {
  barangay: string;
  email: string;
  totalSales: number;
  salesData: Array<{
    date: string;
    amount: number;
  }>;
}

interface BuyerProfile {
  id: string;
  email: string | null;
  barangay: string | null;
  first_name: string | null;
  last_name: string | null;
  orders: Array<{
    id: string;
    total_amount: number | null;
    created_at: string;
    status: string;
  }> | null;
}

export default function BuyerSalesChart() {
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7days'); // 7days, 30days, 90days

  useEffect(() => {
    loadBuyerSalesData();
  }, [selectedPeriod]);

  const loadBuyerSalesData = async () => {
    try {
      setLoading(true);
      
      // Calculate date range based on selected period
      const endDate = new Date();
      const startDate = new Date();
      
      switch (selectedPeriod) {
        case '7days':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30days':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90days':
          startDate.setDate(endDate.getDate() - 90);
          break;
      }

      // Fetch buyer profiles and their orders/transactions
      const { data: buyers, error: buyersError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          barangay,
          first_name,
          last_name,
          orders!inner(
            id,
            total_amount,
            created_at,
            status
          )
        `)
        .eq('user_type', 'buyer')
        .gte('orders.created_at', startDate.toISOString())
        .lte('orders.created_at', endDate.toISOString())
        .in('orders.status', ['completed', 'delivered']) // Only count completed sales
        .returns<BuyerProfile[]>();

      if (buyersError) {
        console.error('Error fetching buyers:', buyersError);
        return;
      }

      // Process and group data by barangay
      const processedData: { [key: string]: SalesData } = {};

      buyers?.forEach(buyer => {
        const barangay = buyer.barangay || 'Unknown';
        
        if (!processedData[barangay]) {
          processedData[barangay] = {
            barangay,
            email: `bwbakeshop_${barangay.toLowerCase()}@utak.io`,
            totalSales: 0,
            salesData: []
          };
        }

        // Add up all orders for this buyer
        buyer.orders?.forEach(order => {
          processedData[barangay].totalSales += order.total_amount || 0;
          
          // Add to daily sales data
          const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          });
          
          const existingDay = processedData[barangay].salesData.find(
            day => day.date === orderDate
          );
          
          if (existingDay) {
            existingDay.amount += order.total_amount || 0;
          } else {
            processedData[barangay].salesData.push({
              date: orderDate,
              amount: order.total_amount || 0
            });
          }
        });
      });

      // Convert to array and sort by total sales
      const sortedData = Object.values(processedData)
        .sort((a, b) => b.totalSales - a.totalSales)
        .slice(0, 6); // Show top 6 barangays

      // Fill in missing dates for consistent chart display
      sortedData.forEach(data => {
        const dates = generateDateRange(startDate, endDate);
        const filledData: Array<{ date: string; amount: number }> = [];
        
        dates.forEach(date => {
          const existing = data.salesData.find(d => d.date === date);
          filledData.push({
            date,
            amount: existing ? existing.amount : 0
          });
        });
        
        data.salesData = filledData;
      });

      setSalesData(sortedData);
    } catch (error) {
      console.error('Error loading buyer sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateDateRange = (start: Date, end: Date): string[] => {
    const dates: string[] = [];
    const current = new Date(start);
    
    while (current <= end) {
      dates.push(current.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  };

  const formatCurrency = (amount: number): string => {
    return `₱${amount.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const getChartConfig = (color: string) => ({
    backgroundColor: colors.white,
    backgroundGradientFrom: colors.white,
    backgroundGradientTo: colors.white,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: color
    },
    fillShadowGradient: color,
    fillShadowGradientOpacity: 0.1,
  });

  const renderChart = (data: SalesData, index: number) => {
    if (data.salesData.length === 0) return null;

    const chartData = {
      labels: data.salesData.map(d => d.date),
      datasets: [
        {
          data: data.salesData.map(d => d.amount),
          color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };

    return (
      <View key={data.barangay} style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <Text style={styles.barangayTitle}>{data.barangay}</Text>
          <Text style={styles.emailText}>{data.email}</Text>
          <Text style={styles.totalSales}>{formatCurrency(data.totalSales)}</Text>
        </View>
        
        <LineChart
          data={chartData}
          width={screenWidth - 40}
          height={220}
          chartConfig={getChartConfig(colors.primary)}
          bezier
          style={styles.chart}
          withInnerLines={true}
          withOuterLines={true}
          withVerticalLines={true}
          withHorizontalLines={true}
          fromZero={true}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading buyer sales data...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Buyer Overall Sales</Text>
        <Text style={styles.subtitle}>Sales performance by barangay</Text>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {['7days', '30days', '90days'].map(period => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              selectedPeriod === period && styles.periodButtonActive
            ]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text style={[
              styles.periodButtonText,
              selectedPeriod === period && styles.periodButtonTextActive
            ]}>
              {period === '7days' ? '7 Days' : period === '30days' ? '30 Days' : '90 Days'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Charts */}
      <View style={styles.chartsContainer}>
        {salesData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No sales data found for the selected period</Text>
          </View>
        ) : (
          salesData.map((data, index) => renderChart(data, index))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    padding: 20,
    paddingBottom: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  periodSelector: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodButtonText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  chartsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  chartContainer: {
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: 20,
    padding: 16,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chartHeader: {
    marginBottom: 12,
  },
  barangayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 2,
  },
  emailText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  totalSales: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});