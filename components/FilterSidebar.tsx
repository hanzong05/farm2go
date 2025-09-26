import React from 'react';
import {
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';

const { width } = Dimensions.get('window');
const isDesktop = width >= 1024;

export interface FilterSection {
  key: string;
  title: string;
  type: 'category' | 'range' | 'sort' | 'toggle' | 'custom';
  options: FilterOption[];
}

export interface FilterOption {
  key: string;
  label: string;
  value?: any;
  count?: number;
  min?: number;
  max?: number;
  color?: string;
}

export interface FilterState {
  [key: string]: any;
}

interface FilterSidebarProps {
  // Data
  sections: FilterSection[];
  filterState: FilterState;
  onFilterChange: (key: string, value: any) => void;

  // Display options
  showMobile?: boolean;
  onCloseMobile?: () => void;
  title?: string;

  // Styling
  width?: number;
  backgroundColor?: string;
  borderColor?: string;

  // Custom renderers
  customSectionRenderer?: (section: FilterSection) => React.ReactNode;
  customOptionRenderer?: (option: FilterOption, section: FilterSection) => React.ReactNode;
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({
  sections,
  filterState,
  onFilterChange,
  showMobile = false,
  onCloseMobile,
  title = 'Filters',
  width: customWidth = isDesktop ? 240 : 280, // Reduced default width for desktop
  backgroundColor = '#ffffff',
  borderColor = '#f1f5f9',
  customSectionRenderer,
  customOptionRenderer,
}) => {

  const renderOption = (option: FilterOption, section: FilterSection) => {
    if (customOptionRenderer) {
      return customOptionRenderer(option, section);
    }

    const isSelected = filterState[section.key] === option.key ||
      (Array.isArray(filterState[section.key]) && filterState[section.key].includes(option.key));

    switch (section.type) {
      case 'category':
        return (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.categoryItem,
              isSelected && styles.categoryItemActive
            ]}
            onPress={() => onFilterChange(section.key, option.key)}
          >
            <Text 
              style={[
                styles.categoryText,
                isSelected && styles.categoryTextActive
              ]}
              numberOfLines={2} // Prevent long text from breaking layout
              ellipsizeMode="tail"
            >
              {option.label}
            </Text>
            {option.count !== undefined && (
              <Text style={styles.categoryCount}>{option.count}</Text>
            )}
          </TouchableOpacity>
        );

      case 'range':
        return (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.rangeButton,
              isSelected && styles.rangeButtonActive
            ]}
            onPress={() => onFilterChange(section.key, option.key)}
          >
            <Text 
              style={[
                styles.rangeText,
                isSelected && styles.rangeTextActive
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );

      case 'sort':
        return (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.sortItem,
              isSelected && styles.sortItemActive
            ]}
            onPress={() => onFilterChange(section.key, option.key)}
          >
            <Text 
              style={[
                styles.sortText,
                isSelected && styles.sortTextActive
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );

      case 'toggle':
        return (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.toggleItem,
              isSelected && styles.toggleItemActive
            ]}
            onPress={() => onFilterChange(section.key, !filterState[section.key])}
          >
            <View style={[
              styles.toggleIndicator,
              isSelected && styles.toggleIndicatorActive
            ]}>
              {isSelected && <Icon name="check" size={12} color="#ffffff" />}
            </View>
            <Text 
              style={[
                styles.toggleText,
                isSelected && styles.toggleTextActive
              ]}
              numberOfLines={2}
              ellipsizeMode="tail"
              flex={1} // Allow text to take remaining space
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );

      default:
        return (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.defaultItem,
              isSelected && styles.defaultItemActive
            ]}
            onPress={() => onFilterChange(section.key, option.key)}
          >
            <Text 
              style={[
                styles.defaultText,
                isSelected && styles.defaultTextActive
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
    }
  };

  const renderSection = (section: FilterSection) => {
    if (customSectionRenderer) {
      return customSectionRenderer(section);
    }

    return (
      <View key={section.key} style={styles.sidebarSection}>
        <Text 
          style={styles.sidebarSectionTitle}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {section.title}
        </Text>
        <View style={styles.optionsContainer}>
          {section.options.map((option) => renderOption(option, section))}
        </View>
      </View>
    );
  };

  const sidebarContent = (
    <View style={[styles.sidebar, { width: customWidth, backgroundColor, borderRightColor: borderColor }]}>
      <ScrollView
        style={styles.sidebarScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.sidebarContent}
      >
        {sections.map(renderSection)}
      </ScrollView>
    </View>
  );

  // Desktop version - always visible
  if (isDesktop && !showMobile) {
    return sidebarContent;
  }

  // Mobile version - modal
  if (showMobile) {
    return (
      <Modal
        animationKeyframesType="slide"
        transparent={true}
        visible={showMobile}
        onRequestClose={onCloseMobile}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onCloseMobile}
              >
                <Icon name="times" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <View style={styles.modalSidebarContent}>
                {sections.map(renderSection)}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  // Sidebar Container
  sidebar: {
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    flex: 1,
    maxWidth: 300, // Add max width constraint
    minWidth: 200, // Add min width constraint
  },

  sidebarScroll: {
    flex: 1,
  },

  sidebarContent: {
    paddingVertical: 16, // Reduced from 20
    paddingHorizontal: 12, // Reduced from 16
    paddingBottom: 32, // Reduced from 40
  },

  sidebarSection: {
    marginBottom: isDesktop ? 20 : 24, // More spacing on mobile
    paddingBottom: isDesktop ? 16 : 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },

  sidebarSectionTitle: {
    fontSize: isDesktop ? 15 : 17, // Larger on mobile
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: isDesktop ? 10 : 14, // More spacing on mobile
  },

  optionsContainer: {
    gap: isDesktop ? 4 : 6, // More spacing on mobile
  },

  // Category Style
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: isDesktop ? 6 : 12, // More padding on mobile
    paddingHorizontal: isDesktop ? 10 : 16,
    borderRadius: 8,
    marginBottom: isDesktop ? 3 : 6,
    flex: 1, // Ensure it doesn't overflow
    minHeight: isDesktop ? 'auto' : 44, // Minimum touch target on mobile
  },

  categoryItemActive: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },

  categoryText: {
    fontSize: isDesktop ? 13 : 15, // Larger on mobile
    color: '#64748b',
    fontWeight: '500',
    flex: 1, // Allow text to take available space
    marginRight: 8, // Add spacing before count
  },

  categoryTextActive: {
    color: '#059669',
    fontWeight: '600',
  },

  categoryCount: {
    fontSize: isDesktop ? 11 : 13, // Larger on mobile
    color: '#9ca3af',
    backgroundColor: '#f8fafc',
    paddingHorizontal: isDesktop ? 6 : 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: isDesktop ? 20 : 24,
    textAlign: 'center',
    flexShrink: 0, // Prevent shrinking
  },

  // Range Style
  rangeButton: {
    paddingVertical: isDesktop ? 8 : 12, // More padding on mobile
    paddingHorizontal: isDesktop ? 10 : 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    marginBottom: isDesktop ? 6 : 8,
    minHeight: isDesktop ? 'auto' : 44, // Minimum touch target on mobile
    justifyContent: 'center',
  },

  rangeButtonActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#bbf7d0',
  },

  rangeText: {
    fontSize: isDesktop ? 13 : 15, // Larger on mobile
    color: '#64748b',
    fontWeight: '500',
    textAlign: 'center',
  },

  rangeTextActive: {
    color: '#059669',
    fontWeight: '600',
  },

  // Sort Style
  sortItem: {
    paddingVertical: isDesktop ? 6 : 12, // More padding on mobile
    paddingHorizontal: isDesktop ? 10 : 16,
    borderRadius: 8,
    marginBottom: isDesktop ? 3 : 6,
    minHeight: isDesktop ? 'auto' : 44, // Minimum touch target on mobile
    justifyContent: 'center',
  },

  sortItemActive: {
    backgroundColor: '#ecfdf5',
  },

  sortText: {
    fontSize: isDesktop ? 13 : 15, // Larger on mobile
    color: '#64748b',
    fontWeight: '500',
  },

  sortTextActive: {
    color: '#059669',
    fontWeight: '600',
  },

  // Toggle Style
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: isDesktop ? 6 : 12, // More padding on mobile
    paddingHorizontal: isDesktop ? 10 : 16,
    borderRadius: 8,
    marginBottom: isDesktop ? 3 : 6,
    minHeight: isDesktop ? 'auto' : 44, // Minimum touch target on mobile
  },

  toggleItemActive: {
    backgroundColor: '#ecfdf5',
  },

  toggleIndicator: {
    width: isDesktop ? 18 : 22, // Larger on mobile
    height: isDesktop ? 18 : 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    marginRight: isDesktop ? 8 : 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0, // Prevent shrinking
  },

  toggleIndicatorActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },

  toggleText: {
    fontSize: isDesktop ? 13 : 15, // Larger on mobile
    color: '#64748b',
    fontWeight: '500',
  },

  toggleTextActive: {
    color: '#059669',
    fontWeight: '600',
  },

  // Default Style
  defaultItem: {
    paddingVertical: isDesktop ? 6 : 12, // More padding on mobile
    paddingHorizontal: isDesktop ? 10 : 16,
    borderRadius: 8,
    marginBottom: isDesktop ? 3 : 6,
    minHeight: isDesktop ? 'auto' : 44, // Minimum touch target on mobile
    justifyContent: 'center',
  },

  defaultItemActive: {
    backgroundColor: '#ecfdf5',
  },

  defaultText: {
    fontSize: isDesktop ? 13 : 15, // Larger on mobile
    color: '#64748b',
    fontWeight: '500',
  },

  defaultTextActive: {
    color: '#059669',
    fontWeight: '600',
  },

  // Mobile Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '60%',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },

  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  modalScroll: {
    flex: 1,
  },

  modalSidebarContent: {
    paddingVertical: 24,
    paddingHorizontal: 24,
    paddingBottom: 40, // Extra padding for safe area
  },
});

export default FilterSidebar;