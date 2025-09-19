import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  Platform,
  SafeAreaView,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

// Responsive breakpoints
const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1200,
  largeDesktop: 1440,
};

interface ResponsivePageProps {
  children: React.ReactNode;
  scrollable?: boolean;
  padding?: boolean;
  maxWidth?: keyof typeof BREAKPOINTS | number;
  backgroundColor?: string;
  style?: any;
}

// Farm2Go color scheme
const colors = {
  background: '#f0f9f4',
  surface: '#ffffff',
  border: '#d1fae5',
};

export default function ResponsivePage({
  children,
  scrollable = true,
  padding = true,
  maxWidth = 'largeDesktop',
  backgroundColor = colors.background,
  style,
}: ResponsivePageProps) {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  const isDesktop = dimensions.width >= BREAKPOINTS.mobile;
  const isTablet = dimensions.width >= BREAKPOINTS.tablet;
  const isLargeDesktop = dimensions.width >= BREAKPOINTS.largeDesktop;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const getMaxWidth = () => {
    if (typeof maxWidth === 'number') return maxWidth;
    return BREAKPOINTS[maxWidth];
  };

  const getResponsivePadding = () => {
    if (!padding) return 0;

    if (isLargeDesktop) return 40;
    if (isDesktop) return 24;
    if (isTablet) return 20;
    return 16;
  };

  const getContainerStyle = () => {
    const responsivePadding = getResponsivePadding();
    const maxWidthValue = getMaxWidth();

    return {
      flex: 1,
      backgroundColor,
      paddingHorizontal: responsivePadding,
      paddingVertical: isDesktop ? responsivePadding : 0,
      maxWidth: isDesktop ? maxWidthValue : '100%',
      alignSelf: 'center',
      width: '100%',
    };
  };

  const ContentWrapper = ({ children: contentChildren }: { children: React.ReactNode }) => {
    if (scrollable) {
      return (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {contentChildren}
        </ScrollView>
      );
    }

    return <View style={styles.staticContent}>{contentChildren}</View>;
  };

  if (Platform.OS === 'web' && isDesktop) {
    // Web desktop layout
    return (
      <View style={[styles.webContainer, getContainerStyle(), style]}>
        <ContentWrapper>{children}</ContentWrapper>
      </View>
    );
  }

  // Mobile/tablet layout with SafeAreaView
  return (
    <SafeAreaView style={[styles.mobileContainer, { backgroundColor }]}>
      <View style={[getContainerStyle(), style]}>
        <ContentWrapper>{children}</ContentWrapper>
      </View>
    </SafeAreaView>
  );
}

// Responsive Grid Component
interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: number;
  style?: any;
}

export function ResponsiveGrid({
  children,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 16,
  style,
}: ResponsiveGridProps) {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const getColumns = () => {
    if (dimensions.width >= BREAKPOINTS.desktop) return columns.desktop || 3;
    if (dimensions.width >= BREAKPOINTS.tablet) return columns.tablet || 2;
    return columns.mobile || 1;
  };

  const numColumns = getColumns();
  const childrenArray = React.Children.toArray(children);

  return (
    <View style={[styles.grid, { gap }, style]}>
      {Array.from({ length: Math.ceil(childrenArray.length / numColumns) }).map((_, rowIndex) => (
        <View key={rowIndex} style={[styles.gridRow, { gap }]}>
          {Array.from({ length: numColumns }).map((_, colIndex) => {
            const childIndex = rowIndex * numColumns + colIndex;
            const child = childrenArray[childIndex];

            return (
              <View
                key={colIndex}
                style={[
                  styles.gridColumn,
                  { width: `${100 / numColumns}%` },
                  colIndex > 0 && { marginLeft: gap },
                ]}
              >
                {child}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// Responsive Card Component
interface ResponsiveCardProps {
  children: React.ReactNode;
  elevated?: boolean;
  padding?: boolean;
  style?: any;
}

export function ResponsiveCard({
  children,
  elevated = true,
  padding = true,
  style,
}: ResponsiveCardProps) {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const isDesktop = dimensions.width >= BREAKPOINTS.mobile;

  const cardStyle = {
    backgroundColor: colors.surface,
    borderRadius: isDesktop ? 16 : 12,
    padding: padding ? (isDesktop ? 24 : 16) : 0,
    ...(elevated && {
      elevation: isDesktop ? 4 : 2,
      shadowColor: 'rgba(0,0,0,0.1)',
      shadowOffset: { width: 0, height: isDesktop ? 4 : 2 },
      shadowOpacity: 0.1,
      shadowRadius: isDesktop ? 8 : 4,
    }),
    borderWidth: 1,
    borderColor: colors.border,
  };

  return <View style={[cardStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  webContainer: {
    minHeight: '100vh',
  },

  mobileContainer: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },

  staticContent: {
    flex: 1,
  },

  // Grid Styles
  grid: {
    width: '100%',
  },

  gridRow: {
    flexDirection: 'row',
    width: '100%',
  },

  gridColumn: {
    flexShrink: 1,
  },
});

// Hook for responsive values
export function useResponsiveValue<T>(values: {
  mobile: T;
  tablet?: T;
  desktop?: T;
  largeDesktop?: T;
}): T {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  if (dimensions.width >= BREAKPOINTS.largeDesktop && values.largeDesktop !== undefined) {
    return values.largeDesktop;
  }
  if (dimensions.width >= BREAKPOINTS.desktop && values.desktop !== undefined) {
    return values.desktop;
  }
  if (dimensions.width >= BREAKPOINTS.tablet && values.tablet !== undefined) {
    return values.tablet;
  }
  return values.mobile;
}

// Export breakpoints for use in other components
export { BREAKPOINTS };