import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
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
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View style={styles.overlay}>
        <View style={styles.alertContainer}>
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
                ]}
                onPress={() => {
                  button.onPress?.();
                  onRequestClose?.();
                }}
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
        </View>
      </View>
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
  },
  alertContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    minWidth: 300,
    maxWidth: 400,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 20,
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  destructiveButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  cancelText: {
    color: '#6b7280',
  },
  destructiveText: {
    color: '#ffffff',
  },
});

export default WebAlert;