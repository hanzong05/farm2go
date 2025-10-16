
import { Message, messageService } from './messageService';

/**
 * Real-time manager that implements the workflow diagram:
 * "Database broadcasts new message to conversation users"
 * "Sender's chat UI updates instantly"
 * "Receiver's chat UI updates instantly"
 */
class WorkflowRealtimeManager {
  private subscriptions: Map<string, any> = new Map();
  private conversationCallbacks: Map<string, (message: Message, type: 'INSERT' | 'UPDATE') => void> = new Map();

  /**
   * Set up real-time subscription for a conversation
   * Both sender and receiver subscribe to the same conversation channel
   */
  subscribeToConversation(
    conversationId: string,
    userId: string,
    callback: (message: Message, type: 'INSERT' | 'UPDATE') => void
  ): void {
    const subscriptionKey = `${conversationId}_${userId}`;


    // Store callback for this user
    this.conversationCallbacks.set(subscriptionKey, callback);

    // Only create one subscription per conversation to avoid conflicts
    if (!this.subscriptions.has(conversationId)) {

      const subscription = messageService.subscribeToConversationChanges(
        conversationId,
        (message: Message, type: 'INSERT' | 'UPDATE') => {

          // Notify all users subscribed to this conversation
          this.conversationCallbacks.forEach((cb, key) => {
            if (key.startsWith(conversationId)) {
              const [, subscribedUserId] = key.split('_');


              cb(message, type);
            }
          });
        }
      );

      this.subscriptions.set(conversationId, subscription);
    }
  }

  /**
   * Subscribe to general messages for new conversation detection
   * Used when conversation doesn't exist yet
   */
  subscribeToNewConversations(
    userId: string,
    callback: (message: Message) => void
  ): void {
    const subscriptionKey = `new_conversations_${userId}`;


    if (!this.subscriptions.has(subscriptionKey)) {
      const subscription = messageService.subscribeToMessages(
        (message: Message) => {
          // Check if this message involves our user
          if (message.sender_id === userId || message.receiver_id === userId) {
            callback(message);

            // Automatically set up conversation subscription now that we have the ID
            this.subscribeToConversation(
              message.conversation_id,
              userId,
              (newMessage, type) => {
                // This will be handled by the conversation-specific callback
                callback(newMessage);
              }
            );
          }
        },
        userId
      );

      this.subscriptions.set(subscriptionKey, subscription);
    }
  }

  /**
   * Unsubscribe from a conversation
   */
  unsubscribeFromConversation(conversationId: string, userId: string): void {
    const subscriptionKey = `${conversationId}_${userId}`;


    // Remove callback for this user
    this.conversationCallbacks.delete(subscriptionKey);

    // If no more users are subscribed to this conversation, remove the subscription
    const remainingCallbacks = Array.from(this.conversationCallbacks.keys())
      .filter(key => key.startsWith(conversationId));

    if (remainingCallbacks.length === 0) {
      const subscription = this.subscriptions.get(conversationId);
      if (subscription) {
        subscription.unsubscribe();
        this.subscriptions.delete(conversationId);
      }
    }
  }

  /**
   * Unsubscribe from new conversation detection
   */
  unsubscribeFromNewConversations(userId: string): void {
    const subscriptionKey = `new_conversations_${userId}`;


    const subscription = this.subscriptions.get(subscriptionKey);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(subscriptionKey);
    }
  }

  /**
   * Clean up all subscriptions
   */
  cleanup(): void {
    this.subscriptions.forEach((subscription, key) => {
      subscription.unsubscribe();
    });

    this.subscriptions.clear();
    this.conversationCallbacks.clear();
  }

  /**
   * Get active subscription count (for debugging)
   */
  getActiveSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get active subscriptions (for debugging)
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }
}

// Export singleton instance
export const workflowRealtimeManager = new WorkflowRealtimeManager();