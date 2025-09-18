// Farm2Go Design System - Inspired by Shopee but with Farm Colors
export const Theme = {
  // Primary Farm Colors (replacing Shopee's orange/red)
  colors: {
    // Primary Brand Colors
    primary: '#22c55e',          // Fresh green (like Shopee's primary orange)
    primaryDark: '#16a34a',      // Darker green
    primaryLight: '#86efac',     // Light green

    // Secondary Colors
    secondary: '#f59e0b',        // Golden harvest yellow
    secondaryDark: '#d97706',
    secondaryLight: '#fbbf24',

    // Earth Tones
    earth: '#92400e',            // Rich brown
    earthLight: '#d97706',       // Light brown
    soil: '#78716c',             // Soil gray-brown

    // Neutral Colors (Shopee-style grays)
    background: '#f8fafc',       // Light background
    surface: '#ffffff',          // Card surfaces
    surfaceVariant: '#f1f5f9',   // Alternative surface

    // Text Colors
    text: {
      primary: '#0f172a',        // Dark text
      secondary: '#64748b',      // Medium text
      tertiary: '#94a3b8',       // Light text
      inverse: '#ffffff',        // White text
    },

    // Status Colors
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#06b6d4',

    // Border & Divider
    border: '#e2e8f0',
    divider: '#f1f5f9',

    // Shadows
    shadow: '#000000',
  },

  // Typography (Shopee-style)
  typography: {
    // Headers
    h1: {
      fontSize: 32,
      fontWeight: 'bold' as const,
      lineHeight: 40,
    },
    h2: {
      fontSize: 28,
      fontWeight: 'bold' as const,
      lineHeight: 36,
    },
    h3: {
      fontSize: 24,
      fontWeight: '600' as const,
      lineHeight: 32,
    },
    h4: {
      fontSize: 20,
      fontWeight: '600' as const,
      lineHeight: 28,
    },

    // Body Text
    body1: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 24,
    },
    body2: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
    },

    // Labels & Captions
    caption: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 16,
    },
    overline: {
      fontSize: 10,
      fontWeight: '500' as const,
      lineHeight: 16,
      letterSpacing: 0.5,
      textTransform: 'uppercase' as const,
    },

    // Buttons
    button: {
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 20,
    },
  },

  // Spacing (Shopee-style 8px grid)
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  // Border Radius (Shopee's rounded corners)
  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,
    full: 9999,
  },

  // Shadows (Shopee-style elevations)
  shadows: {
    none: {
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    lg: {
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
    xl: {
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
      elevation: 8,
    },
  },

  // Layout
  layout: {
    // Container max widths
    container: {
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    },

    // Common component sizes
    header: 60,
    tabBar: 60,
    buttonHeight: 48,
    inputHeight: 48,
    cardPadding: 16,
  },
};

// Shopee-inspired component styles
export const ComponentStyles = {
  // Card styles (like Shopee product cards)
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    ...Theme.shadows.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },

  // Button styles
  button: {
    primary: {
      backgroundColor: Theme.colors.primary,
      paddingVertical: Theme.spacing.sm + 4,
      paddingHorizontal: Theme.spacing.lg,
      borderRadius: Theme.borderRadius.md,
      ...Theme.shadows.sm,
    },
    secondary: {
      backgroundColor: Theme.colors.surface,
      paddingVertical: Theme.spacing.sm + 4,
      paddingHorizontal: Theme.spacing.lg,
      borderRadius: Theme.borderRadius.md,
      borderWidth: 1,
      borderColor: Theme.colors.border,
      ...Theme.shadows.sm,
    },
  },

  // Input styles
  input: {
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm + 4,
    backgroundColor: Theme.colors.surface,
    height: Theme.layout.inputHeight,
  },

  // Badge/Chip styles (like Shopee's category chips)
  chip: {
    paddingVertical: Theme.spacing.xs + 2,
    paddingHorizontal: Theme.spacing.sm + 4,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Theme.colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },

  chipActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
};

// Legacy Colors export for compatibility
export const Colors = {
  light: {
    text: Theme.colors.text.primary,
    background: Theme.colors.background,
    tint: Theme.colors.primary,
    icon: Theme.colors.text.secondary,
    tabIconDefault: Theme.colors.text.secondary,
    tabIconSelected: Theme.colors.primary,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: Theme.colors.primary,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: Theme.colors.primary,
  },
};