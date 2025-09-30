import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import MessageComponent from './MessageComponent';

/**
 * Multi-User Test Component
 *
 * Tests that multiple users can use the same MessageComponent simultaneously
 * without conflicts. Each user gets their own isolated state and subscriptions.
 */
export default function MultiUserTestComponent() {
  const [activeUsers, setActiveUsers] = useState<string[]>([]);

  // Test users
  const testUsers = [
    { id: 'user1', name: 'Alice (Farmer)', type: 'farmer' },
    { id: 'user2', name: 'Bob (Buyer)', type: 'buyer' },
    { id: 'user3', name: 'Carol (Admin)', type: 'admin' },
    { id: 'user4', name: 'Dave (Farmer)', type: 'farmer' },
  ];

  const toggleUser = (userId: string) => {
    setActiveUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Multi-User Conflict Test</Text>

      <View style={styles.controlPanel}>
        <Text style={styles.sectionTitle}>Simulate Multiple Users:</Text>
        <Text style={styles.instructions}>
          Click to add/remove users. Each user gets isolated state and subscriptions.
        </Text>

        <View style={styles.userButtons}>
          {testUsers.map(user => (
            <TouchableOpacity
              key={user.id}
              style={[
                styles.userButton,
                activeUsers.includes(user.id) ? styles.userButtonActive : styles.userButtonInactive
              ]}
              onPress={() => toggleUser(user.id)}
            >
              <Text style={[
                styles.userButtonText,
                activeUsers.includes(user.id) ? styles.userButtonTextActive : styles.userButtonTextInactive
              ]}>
                {user.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.status}>
          <Text style={styles.statusText}>
            Active Users: {activeUsers.length} |
            Expected: Each user can send messages independently without conflicts
          </Text>
        </View>
      </View>

      <ScrollView style={styles.usersContainer} horizontal showsHorizontalScrollIndicator={false}>
        {activeUsers.map(userId => {
          const user = testUsers.find(u => u.id === userId);
          if (!user) return null;

          return (
            <View key={userId} style={styles.userPanel}>
              <Text style={styles.userPanelTitle}>
                {user.name}
              </Text>
              <Text style={styles.userPanelId}>ID: {userId}</Text>

              <View style={styles.messageComponentWrapper}>
                <MessageComponent
                  currentUserId={userId}
                  visible={true}
                  onConversationPress={(conversation) => {
                    console.log(`${user.name} opened conversation:`, conversation.other_user_name);
                  }}
                  onNewConversation={() => {
                    console.log(`${user.name} wants to start new conversation`);
                  }}
                />
              </View>

              <View style={styles.testInstructions}>
                <Text style={styles.testInstructionTitle}>Test Actions:</Text>
                <Text style={styles.testInstruction}>1. Click message button</Text>
                <Text style={styles.testInstruction}>2. Open a conversation</Text>
                <Text style={styles.testInstruction}>3. Send multiple messages</Text>
                <Text style={styles.testInstruction}>4. Check console logs</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {activeUsers.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            👆 Click user buttons above to simulate multiple users
          </Text>
          <Text style={styles.emptyStateSubtext}>
            Each user will have completely isolated state and subscriptions
          </Text>
        </View>
      )}

      <View style={styles.testResults}>
        <Text style={styles.testResultsTitle}>What to Check:</Text>
        <Text style={styles.testResult}>✅ Each user can send messages independently</Text>
        <Text style={styles.testResult}>✅ No "already sending" conflicts between users</Text>
        <Text style={styles.testResult}>✅ Messages appear instantly for both sender and receiver</Text>
        <Text style={styles.testResult}>✅ Console shows user-isolated subscription keys</Text>
        <Text style={styles.testResult}>✅ Rate limiting works per user (1 message per second)</Text>
        <Text style={styles.testResult}>✅ Conversation workflow follows exact diagram</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#2c3e50',
  },
  controlPanel: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  instructions: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 15,
    lineHeight: 20,
  },
  userButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 15,
  },
  userButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
  },
  userButtonActive: {
    backgroundColor: '#27ae60',
    borderColor: '#27ae60',
  },
  userButtonInactive: {
    backgroundColor: 'transparent',
    borderColor: '#bdc3c7',
  },
  userButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  userButtonTextActive: {
    color: 'white',
  },
  userButtonTextInactive: {
    color: '#7f8c8d',
  },
  status: {
    backgroundColor: '#ecf0f1',
    padding: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 12,
    color: '#2c3e50',
    textAlign: 'center',
  },
  usersContainer: {
    flex: 1,
    marginBottom: 20,
  },
  userPanel: {
    width: 350,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginRight: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userPanelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  userPanelId: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 15,
    fontFamily: 'monospace',
  },
  messageComponentWrapper: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    minHeight: 100,
  },
  testInstructions: {
    backgroundColor: '#e8f5e8',
    padding: 10,
    borderRadius: 5,
  },
  testInstructionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 5,
  },
  testInstruction: {
    fontSize: 11,
    color: '#27ae60',
    marginBottom: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 40,
    marginBottom: 20,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
  },
  testResults: {
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  testResultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 10,
  },
  testResult: {
    fontSize: 12,
    color: '#856404',
    marginBottom: 3,
  },
});