import { router } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { Database } from '../types/database';
import MessageComponent, { Conversation } from './MessageComponent';
import NotificationComponent, { Notification } from './NotificationComponent';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface HeaderComponentProps {
  profile?: Profile | null;

  // Search functionality
  showSearch?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;

  // Category tabs
  showCategories?: boolean;
  categories?: Array<{
    key: string;
    label: string;
    color: string;
  }>;
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;

  // Stats banner
  showStats?: boolean;
  stats?: Array<{
    number: string | number;
    label: string;
  }>;

  // Action buttons
  showAddButton?: boolean;
  addButtonText?: string;
  addButtonRoute?: string;
  onAddButtonPress?: () => void;

  // Filter button
  showFilterButton?: boolean;
  onFilterPress?: () => void;

  // Notifications
  showNotifications?: boolean;
  notifications?: Notification[];
  onNotificationPress?: (notification: Notification) => void;
  onMarkNotificationAsRead?: (notificationId: string) => void;
  onMarkAllNotificationsAsRead?: () => void;
  onClearAllNotifications?: () => void;

  // Messages
  showMessages?: boolean;
  conversations?: Conversation[];
  onConversationPress?: (conversation: Conversation) => void;
  onSendMessage?: (conversationId: string, content: string) => void;
  onMarkMessageAsRead?: (conversationId: string) => void;
  onNewConversation?: () => void;
}

// Farm2Go green color scheme
const colors = {
  primary: '#059669',
  secondary: '#10b981',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  white: '#ffffff',
  black: '#000000',
  gray100: '#f9fafb',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  background: '#f0f9f4',
  surface: '#ffffff',
  text: '#0f172a',
  textSecondary: '#6b7280',
  border: '#d1fae5',
  shadow: 'rgba(0,0,0,0.1)',
};

export default function HeaderComponent({
  profile,
  showSearch = false,
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  showCategories = false,
  categories = [],
  selectedCategory = 'all',
  onCategoryChange,
  showStats = false,
  stats = [],
  showAddButton = false,
  addButtonText = '+ Add',
  addButtonRoute,
  onAddButtonPress,
  showFilterButton = false,
  onFilterPress,
  showNotifications = false,
  notifications = [],
  onNotificationPress,
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead,
  onClearAllNotifications,
  showMessages = false,
  conversations = [],
  onConversationPress,
  onSendMessage,
  onMarkMessageAsRead,
  onNewConversation,
}: HeaderComponentProps) {

  const handleAddPress = () => {
    if (onAddButtonPress) {
      onAddButtonPress();
    } else if (addButtonRoute) {
      router.push(addButtonRoute as any);
    }
  };

  return (
    <View style={styles.header}>
      {/* Top Navigation Bar */}
      <View style={styles.topBar}>
        <View style={styles.logoSection}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>F2G</Text>
          </View>
          <Text style={styles.brandText}>Farm2Go</Text>
        </View>

        <View style={styles.headerActions}>
          {showMessages && (
            <MessageComponent
              conversations={conversations}
              onConversationPress={onConversationPress}
              onSendMessage={onSendMessage}
              onMarkAsRead={onMarkMessageAsRead}
              onNewConversation={onNewConversation}
            />
          )}

          {showNotifications && (
            <NotificationComponent
              notifications={notifications}
              onNotificationPress={onNotificationPress}
              onMarkAsRead={onMarkNotificationAsRead}
              onMarkAllAsRead={onMarkAllNotificationsAsRead}
              onClearAll={onClearAllNotifications}
            />
          )}

          {showAddButton && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleAddPress}
            >
              <Text style={styles.headerButtonText}>{addButtonText}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.profileButton}>
            <View style={styles.profileAvatar}>
              <Text style={styles.avatarText}>
                {profile?.first_name?.charAt(0)?.toUpperCase() ?? 'F'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      {showSearch && (
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Icon
                name="search"
                size={16}
                color={colors.textSecondary}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChangeText={onSearchChange}
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            {showFilterButton && (
              <TouchableOpacity style={styles.filterButton} onPress={onFilterPress}>
                <Icon
                  name="cog"
                  size={16}
                  color={colors.white}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Category Tabs */}
      {showCategories && categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categorySection}
          contentContainerStyle={styles.categoryContainer}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category.key}
              style={[
                styles.categoryTab,
                selectedCategory === category.key && styles.categoryTabActive
              ]}
              onPress={() => onCategoryChange?.(category.key)}
            >
              <Text style={[
                styles.categoryText,
                selectedCategory === category.key && styles.categoryTextActive
              ]}>
                {category.label}
              </Text>
              {selectedCategory === category.key && (
                <View style={[styles.categoryIndicator, { backgroundColor: category.color }]} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Stats Banner */}
      {showStats && stats.length > 0 && (
        <View style={styles.statsBanner}>
          <View style={styles.statsGrid}>
            {stats.map((stat, index) => (
              <React.Fragment key={index}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{stat.number}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
                {index < stats.length - 1 && <View style={styles.statDivider} />}
              </React.Fragment>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Header Styles
  header: {
    backgroundColor: colors.white,
    marginBottom: 8,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: colors.primary,
  },

  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  logoText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },

  brandText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  headerButton: {
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },

  headerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },

  profileButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
  },


  // Search Section
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary,
  },

  searchContainer: {
    flexDirection: 'row',
    gap: 8,
  },

  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },

  searchIcon: {
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },

  filterButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },


  // Categories
  categorySection: {
    backgroundColor: colors.white,
  },

  categoryContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    position: 'relative',
  },

  categoryTabActive: {
    backgroundColor: colors.primary + '20',
  },

  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },

  categoryTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },

  categoryIndicator: {
    position: 'absolute',
    bottom: -2,
    left: '50%',
    transform: [{ translateX: -6 }],
    width: 12,
    height: 2,
    borderRadius: 1,
  },

  // Stats Banner
  statsBanner: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },

  statItem: {
    flex: 1,
    alignItems: 'center',
  },

  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },

  statLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },

  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
});