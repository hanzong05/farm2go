import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import ChatModal, { ChatParticipant, ChatMessage } from './ChatModal';

export interface ContactPerson {
  id: string;
  name: string;
  type: 'farmer' | 'buyer' | 'admin';
  isOnline?: boolean;
}

interface ContactButtonProps {
  // Contact person details
  contactPerson: ContactPerson;

  // Current user info (for sending messages)
  currentUserId?: string;
  currentUserName?: string;
  currentUserType?: 'farmer' | 'buyer' | 'admin';

  // Button appearance
  title?: string;
  icon?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';

  // Callbacks
  onSendMessage?: (message: string, contactPersonId: string) => void;
  onContactPress?: () => void; // Called when contact button is first pressed

  // Authentication
  requireAuth?: boolean;
  onAuthRequired?: () => void; // Called when user needs to log in

  // Loading state
  disabled?: boolean;

  // Initial messages (optional)
  initialMessages?: ChatMessage[];
}

const colors = {
  primary: '#059669',
  secondary: '#10b981',
  white: '#ffffff',
  gray400: '#9ca3af',
  gray600: '#4b5563',
  text: '#0f172a',
};

export default function ContactButton({
  contactPerson,
  currentUserId,
  currentUserName = 'User',
  currentUserType = 'buyer',
  title,
  icon = 'comment',
  style,
  textStyle,
  variant = 'secondary',
  size = 'medium',
  onSendMessage,
  onContactPress,
  requireAuth = true,
  onAuthRequired,
  disabled = false,
  initialMessages = [],
}: ContactButtonProps) {
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialMessages);

  // Auto-generate title if not provided
  const buttonTitle = title || `Contact ${contactPerson.type.charAt(0).toUpperCase() + contactPerson.type.slice(1)}`;

  const handleContactPress = () => {
    // Check authentication if required
    if (requireAuth && (!currentUserId || currentUserId === '00000000-0000-0000-0000-000000000000')) {
      if (onAuthRequired) {
        onAuthRequired();
      } else {
        Alert.alert('Login Required', `Please log in to contact the ${contactPerson.type}.`);
      }
      return;
    }

    // Call the optional callback
    if (onContactPress) {
      onContactPress();
    }

    // Open chat modal
    setChatModalVisible(true);
  };

  const handleSendMessage = (content: string) => {
    if (!currentUserId) return;

    // Create new message
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: currentUserId,
      senderName: currentUserName,
      senderType: currentUserType,
      content,
      timestamp: new Date().toISOString(),
      read: false,
    };

    // Add to local state
    setChatMessages(prev => [...prev, newMessage]);

    // Call the callback if provided
    if (onSendMessage) {
      onSendMessage(content, contactPerson.id);
    }

    // Log for debugging
    console.log(`💬 Message sent to ${contactPerson.type}:`, {
      from: currentUserName,
      to: contactPerson.name,
      message: content,
    });
  };

  const handleCloseModal = () => {
    setChatModalVisible(false);
    // Reset messages when modal closes (optional - you might want to keep them)
    // setChatMessages(initialMessages);
  };

  // Get button styles based on variant and size
  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      gap: 8,
    };

    // Size styles
    const sizeStyles: Record<string, ViewStyle> = {
      small: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        minHeight: 32,
      },
      medium: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 40,
      },
      large: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        minHeight: 48,
      },
    };

    // Variant styles
    const variantStyles: Record<string, ViewStyle> = {
      primary: {
        backgroundColor: colors.primary,
      },
      secondary: {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.gray400,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: colors.primary,
      },
    };

    const disabledStyle: ViewStyle = disabled ? {
      opacity: 0.5,
    } : {};

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...disabledStyle,
      ...style,
    };
  };

  const getTextStyle = (): TextStyle => {
    const sizeStyles: Record<string, TextStyle> = {
      small: { fontSize: 12 },
      medium: { fontSize: 14 },
      large: { fontSize: 16 },
    };

    const variantStyles: Record<string, TextStyle> = {
      primary: {
        color: colors.white,
        fontWeight: '600',
      },
      secondary: {
        color: colors.gray600,
        fontWeight: '500',
      },
      outline: {
        color: colors.primary,
        fontWeight: '600',
      },
    };

    return {
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...textStyle,
    };
  };

  const getIconColor = (): string => {
    if (disabled) return colors.gray400;

    switch (variant) {
      case 'primary':
        return colors.white;
      case 'secondary':
        return colors.gray600;
      case 'outline':
        return colors.primary;
      default:
        return colors.gray600;
    }
  };

  const getIconSize = (): number => {
    switch (size) {
      case 'small':
        return 14;
      case 'medium':
        return 16;
      case 'large':
        return 18;
      default:
        return 16;
    }
  };

  return (
    <>
      <TouchableOpacity
        style={getButtonStyle()}
        onPress={handleContactPress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Icon
          name={icon}
          size={getIconSize()}
          color={getIconColor()}
        />
        <Text style={getTextStyle()}>
          {buttonTitle}
        </Text>
      </TouchableOpacity>

      {/* Chat Modal */}
      <ChatModal
        visible={chatModalVisible}
        onClose={handleCloseModal}
        participant={contactPerson}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        currentUserId={currentUserId || 'anonymous'}
      />
    </>
  );
}

// Predefined style presets for common use cases
export const ContactButtonPresets = {
  // For product pages - Contact Seller
  contactSeller: {
    variant: 'outline' as const,
    size: 'medium' as const,
    title: 'Contact Seller',
    icon: 'comment',
  },

  // For sales history - Contact Buyer
  contactBuyer: {
    variant: 'secondary' as const,
    size: 'small' as const,
    title: 'Contact Buyer',
    icon: 'comment',
  },

  // For order details - Contact Support
  contactSupport: {
    variant: 'outline' as const,
    size: 'medium' as const,
    title: 'Contact Support',
    icon: 'headset',
  },

  // Primary chat button
  primaryChat: {
    variant: 'primary' as const,
    size: 'large' as const,
    title: 'Start Chat',
    icon: 'comments',
  },
};

const styles = StyleSheet.create({
  // No styles needed as everything is computed dynamically
});