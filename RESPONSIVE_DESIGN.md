# Farm2Go Responsive Design System

## Overview

The Farm2Go app now supports both **mobile and desktop** layouts with a comprehensive responsive design system. The app automatically adapts to different screen sizes and provides optimized experiences for each platform.

## Breakpoints

```typescript
const BREAKPOINTS = {
  mobile: 768,     // < 768px = Mobile
  tablet: 1024,    // 768px - 1024px = Tablet
  desktop: 1200,   // 1024px - 1200px = Desktop
  largeDesktop: 1440, // > 1200px = Large Desktop
};
```

## Layout System

### 1. Navigation Layouts

#### Mobile (< 768px)
- **Bottom navigation tabs** with icons and labels
- **Stack navigation** for page transitions
- **Touch-optimized** interface

#### Tablet (768px - 1024px)
- **Top horizontal navigation** bar with scrollable tabs
- **Larger touch targets** and spacing
- **Grid layouts** start appearing

#### Desktop (> 1024px)
- **Left sidebar navigation** with collapsible menu
- **Hover states** and desktop interactions
- **Multi-column layouts** and advanced grids

### 2. Component Structure

```
ResponsiveLayout (Navigation wrapper)
├── ResponsivePage (Page wrapper)
    ├── ResponsiveGrid (Grid system)
    ├── ResponsiveCard (Card component)
    └── Content
```

## Components

### ResponsiveLayout
Wraps the entire app and provides navigation based on screen size.

```tsx
<ResponsiveLayout userRole="farmer">
  <Stack>
    <Stack.Screen name="index" />
    {/* Other screens */}
  </Stack>
</ResponsiveLayout>
```

### ResponsivePage
Wraps individual pages with responsive padding, max-width, and scrolling.

```tsx
<ResponsivePage backgroundColor={colors.background}>
  <View style={styles.container}>
    {/* Page content */}
  </View>
</ResponsivePage>
```

### ResponsiveGrid
Creates responsive grid layouts with different column counts per breakpoint.

```tsx
<ResponsiveGrid
  columns={{ mobile: 1, tablet: 2, desktop: 3 }}
  gap={16}
>
  {items.map(item => <Card key={item.id} />)}
</ResponsiveGrid>
```

### ResponsiveCard
Provides adaptive card styling with responsive padding and shadows.

```tsx
<ResponsiveCard elevated={true} padding={true}>
  <Text>Card content</Text>
</ResponsiveCard>
```

### useResponsiveValue Hook
Gets different values based on current screen size.

```tsx
const columns = useResponsiveValue({
  mobile: 1,
  tablet: 2,
  desktop: 3,
  largeDesktop: 4,
});
```

## Usage Examples

### 1. Basic Page Setup

```tsx
import ResponsivePage, { ResponsiveGrid, ResponsiveCard } from '../components/ResponsivePage';

export default function MyPage() {
  return (
    <ResponsivePage>
      <ResponsiveGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }}>
        <ResponsiveCard>
          <Text>Card 1</Text>
        </ResponsiveCard>
        <ResponsiveCard>
          <Text>Card 2</Text>
        </ResponsiveCard>
      </ResponsiveGrid>
    </ResponsivePage>
  );
}
```

### 2. Responsive Values

```tsx
const fontSize = useResponsiveValue({
  mobile: 16,
  tablet: 18,
  desktop: 20,
});

const padding = useResponsiveValue({
  mobile: 16,
  desktop: 24,
});
```

### 3. Layout Configuration

```tsx
// farmer/_layout.tsx
export default function FarmerLayout() {
  return (
    <ResponsiveLayout userRole="farmer">
      <Stack screenOptions={{ headerShown: false }}>
        {/* Screens */}
      </Stack>
    </ResponsiveLayout>
  );
}
```

## Navigation Configuration

Each user role has its own navigation configuration:

### Farmer Navigation
- Dashboard, My Products, Inventory, Orders, Sales History, Profile

### Buyer Navigation
- Marketplace, My Orders, Purchase History, Settings

### Admin Navigation
- Dashboard, Users, Products, Settings

## Design Features

### Desktop Features
- **Collapsible sidebar** navigation
- **Hover effects** and advanced interactions
- **Multi-column layouts** with optimal spacing
- **Larger click targets** and improved accessibility

### Mobile Features
- **Touch-optimized** interface
- **Bottom navigation** for easy thumb access
- **Single-column layouts** for better readability
- **Swipe gestures** and mobile interactions

### Tablet Features
- **Hybrid approach** combining desktop and mobile patterns
- **Horizontal scrolling** navigation
- **Medium-density** layouts

## Color Scheme

The responsive design maintains the Farm2Go green theme across all devices:

```typescript
const colors = {
  primary: '#059669',       // Farm green
  secondary: '#10b981',     // Light green
  background: '#f0f9f4',    // Light green background
  surface: '#ffffff',       // Card backgrounds
  text: '#0f172a',         // Dark text
  textSecondary: '#6b7280', // Gray text
  border: '#d1fae5',       // Green borders
};
```

## Performance Optimizations

- **Lazy loading** of responsive components
- **Efficient re-rendering** on dimension changes
- **Optimized breakpoint detection**
- **Minimal layout shifts** between screen sizes

## Migration Guide

To convert existing pages to responsive design:

1. **Wrap your layout** with `ResponsiveLayout`
2. **Replace View containers** with `ResponsivePage`
3. **Use ResponsiveGrid** instead of manual flex layouts
4. **Replace cards** with `ResponsiveCard`
5. **Apply responsive values** using the `useResponsiveValue` hook

## Example Implementation

See `app/farmer/index.tsx` for a complete example of a responsive dashboard implementation using all components and patterns.

## Best Practices

1. **Mobile-first approach** - Design for mobile, enhance for desktop
2. **Touch targets** - Minimum 44px touch targets on mobile
3. **Readable text** - Appropriate font sizes for each device
4. **Consistent spacing** - Use the responsive padding system
5. **Accessible navigation** - Clear navigation patterns for all devices

## Browser Support

- **Mobile**: iOS Safari, Chrome Mobile, Samsung Internet
- **Desktop**: Chrome, Firefox, Safari, Edge
- **Responsive**: Automatically adapts to window resizing

The responsive design system ensures Farm2Go provides an optimal experience across all devices while maintaining the agricultural theme and functionality.