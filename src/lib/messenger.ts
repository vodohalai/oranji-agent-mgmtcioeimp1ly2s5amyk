// Client-side helpers for Messenger integration (Admin UI)
/**
 * Tests the webhook connection by simulating Facebook's verification request.
 */
export async function testWebhookConnection(verifyToken: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`/api/messenger/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=challenge-accepted`);
    if (response.ok) {
      const text = await response.text();
      if (text === 'challenge-accepted') {
        return { success: true, message: 'Webhook verified successfully!' };
      }
    }
    return { success: false, message: `Verification failed. Status: ${response.status}` };
  } catch (error) {
    console.error('Webhook test failed:', error);
    return { success: false, message: 'Failed to connect to the webhook endpoint.' };
  }
}
/**
 * Sends a test message by simulating an incoming message from Facebook.
 * @param recipientId - A mock sender ID to use for the test.
 * @param message - The message text to send.
 */
export async function sendTestMessage(recipientId: string, message: string): Promise<{ success: boolean; message: string }> {
  try {
    const payload = {
      object: 'page',
      entry: [{
        messaging: [{
          sender: { id: recipientId },
          message: { text: message }
        }]
      }]
    };
    const response = await fetch('/api/messenger/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      return { success: true, message: 'Test message sent successfully!' };
    }
    return { success: false, message: `Failed to send test message. Status: ${response.status}` };
  } catch (error) {
    console.error('Sending test message failed:', error);
    return { success: false, message: 'Failed to send the test message.' };
  }
}