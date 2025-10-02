import React from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';

const screenWidth = Dimensions.get('window').width;

const colors = {
  primary: '#059669',
  secondary: '#10b981',
  white: '#ffffff',
  text: '#0f172a',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
  gray50: '#f8fafc',
  gray100: '#f1f5f9',
};

export interface TableColumn {
  key: string;
  title: string;
  width?: number;
  render?: (value: any, row: any) => React.ReactNode;
}

export interface TableAction {
  icon: string;
  label: string;
  color?: string;
  onPress: (row: any) => void;
  show?: (row: any) => boolean;
}

interface AdminTableProps {
  columns: TableColumn[];
  data: any[];
  actions?: TableAction[];
  onAddPress?: () => void;
  addButtonText?: string;
  emptyMessage?: string;
}

export default function AdminTable({
  columns,
  data,
  actions = [],
  onAddPress,
  addButtonText = '+ Add',
  emptyMessage = 'No data available'
}: AdminTableProps) {
  return (
    <View style={styles.container}>
      {/* Table Header */}
      <View style={styles.tableHeader}>
        <ScrollView horizontal showsHorizontalScrollIndicator={screenWidth < 768}>
          <View style={styles.headerRow}>
            {columns.map((column) => (
              <View
                key={column.key}
                style={[
                  styles.headerCell,
                  column.width && { width: column.width },
                  screenWidth < 768 && { minWidth: 100 }
                ]}
              >
                <Text style={[styles.headerText, screenWidth < 768 && { fontSize: 12 }]}>
                  {column.title}
                </Text>
              </View>
            ))}
            {actions.length > 0 && (
              <View style={[styles.headerCell, styles.actionsCell]}>
                <Text style={[styles.headerText, screenWidth < 768 && { fontSize: 12 }]}>
                  Actions
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {onAddPress && (
          <TouchableOpacity style={styles.addButton} onPress={onAddPress}>
            <Icon name="plus" size={screenWidth < 768 ? 12 : 14} color={colors.white} />
            {screenWidth >= 768 && <Text style={styles.addButtonText}>{addButtonText}</Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* Table Body */}
      <ScrollView style={styles.tableBody}>
        {data.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="inbox" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={screenWidth < 768}>
            <View>
              {data.map((row, index) => (
                <View key={index} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
                  {columns.map((column) => (
                    <View
                      key={column.key}
                      style={[
                        styles.tableCell,
                        column.width && { width: column.width },
                        screenWidth < 768 && { minWidth: 100, paddingHorizontal: 8 }
                      ]}
                    >
                      {column.render ? (
                        column.render(row[column.key], row)
                      ) : (
                        <Text style={[styles.cellText, screenWidth < 768 && { fontSize: 12 }]} numberOfLines={2}>
                          {row[column.key] || '-'}
                        </Text>
                      )}
                    </View>
                  ))}

                  {actions.length > 0 && (
                    <View style={[styles.tableCell, styles.actionsCell, screenWidth < 768 && { minWidth: 120 }]}>
                      <View style={styles.actionButtons}>
                        {actions.map((action, actionIndex) => {
                          const shouldShow = action.show ? action.show(row) : true;
                          if (!shouldShow) return null;

                          return (
                            <TouchableOpacity
                              key={actionIndex}
                              style={[
                                styles.actionButton,
                                { backgroundColor: action.color || colors.primary },
                                screenWidth < 768 && { width: 28, height: 28 }
                              ]}
                              onPress={() => action.onPress(row)}
                            >
                              <Icon name={action.icon} size={screenWidth < 768 ? 10 : 12} color={colors.white} />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    width: screenWidth >= 1024 ? '90%' : '100%',
    maxWidth: screenWidth >= 1024 ? 1400 : undefined,
    alignSelf: 'center',
  },
  tableHeader: {
    backgroundColor: colors.gray50,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCell: {
    paddingVertical: screenWidth < 768 ? 12 : 16,
    paddingHorizontal: screenWidth < 768 ? 8 : 16,
    minWidth: screenWidth < 768 ? 100 : 120,
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'uppercase',
  },
  actionsCell: {
    minWidth: 140,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: screenWidth < 768 ? 10 : 16,
    paddingVertical: screenWidth < 768 ? 6 : 8,
    borderRadius: 8,
    gap: 6,
    minWidth: screenWidth < 768 ? 36 : 'auto',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  tableBody: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  tableRowEven: {
    backgroundColor: colors.gray50,
  },
  tableCell: {
    paddingVertical: screenWidth < 768 ? 8 : 12,
    paddingHorizontal: screenWidth < 768 ? 8 : 16,
    minWidth: screenWidth < 768 ? 100 : 120,
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 14,
    color: colors.text,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
});
