import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  Pressable,
} from 'react-native';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
  onRequestClose?: () => void;
}

// For web browsers, we'll use the custom modal
const WebAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  buttons,
  onRequestClose,
}) => {
  // Prevent body scroll when modal is visible on web
  useEffect(() => {
    if (Platform.OS === 'web' && visible) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [visible]);

  if (!visible) return null;

  const handleButtonPress = (button: AlertButton) => {
    // Call button's onPress first
    button.onPress?.();
    // Then close the modal
    onRequestClose?.();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onRequestClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent={true}
    >
      <Pressable style={styles.overlay} onPress={onRequestClose}>
        <Pressable style={styles.alertContainer} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.buttonContainer}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  button.style === 'destructive' && styles.destructiveButton,
                  button.style === 'cancel' && styles.cancelButton,
                  buttons.length === 1 && styles.singleButton,
                ]}
                onPress={() => handleButtonPress(button)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.style === 'destructive' && styles.destructiveText,
                    button.style === 'cancel' && styles.cancelText,
                  ]}
                >
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// Function to show alert that works on both platforms
export const showAlert = (
  title: string,
  message: string,
  buttons: AlertButton[],
  options?: { onDismiss?: () => void }
) => {
  if (Platform.OS === 'web') {
    // For web, we need to use a different approach
    // We'll return a component that can be rendered
    return { title, message, buttons, options };
  } else {
    // For mobile, use native Alert
    Alert.alert(
      title,
      message,
      buttons.map(button => ({
        text: button.text,
        onPress: button.onPress,
        style: button.style,
      })),
      options
    );
    return null;
  }
};

// Hook for managing alert state
export const useCustomAlert = () => {
  const [alertConfig, setAlertConfig] = React.useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons: AlertButton[];
  }>({
    visible: false,
    title: '',
    message: '',
    buttons: [],
  });

  const showAlert = (title: string, message: string, buttons: AlertButton[]) => {
    if (Platform.OS === 'web') {
      setAlertConfig({
        visible: true,
        title,
        message,
        buttons,
      });
    } else {
      Alert.alert(
        title,
        message,
        buttons.map(button => ({
          text: button.text,
          onPress: button.onPress,
          style: button.style,
        }))
      );
    }
  };

  const hideAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };

  const AlertComponent = Platform.OS === 'web' ? (
    <WebAlert
      visible={alertConfig.visible}
      title={alertConfig.title}
      message={alertConfig.message}
      buttons={alertConfig.buttons}
      onRequestClose={hideAlert}
    />
  ) : null;

  return { showAlert, hideAlert, AlertComponent };
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999999,
    elevation: 99999,
    ...(Platform.OS === 'web' && {
      position: 'fixed' as any,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    }),
  },
  alertContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    minWidth: Platform.OS === 'web' ? 320 : 300,
    maxWidth: Platform.OS === 'web' ? 450 : 400,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 100000,
    zIndex: 100000000,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    }),
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  singleButton: {
    flex: 1,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  destructiveButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  cancelText: {
    color: '#6b7280',
  },
  destructiveText: {
    color: '#ffffff',
  },
});

export default WebAlert;