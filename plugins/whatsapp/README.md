# WhatsApp Plugin for SuperDashboard

A comprehensive WhatsApp Business API integration plugin that enables sending and receiving WhatsApp messages directly from SuperDashboard.

## Features

- 📤 **Send Messages**: Send text messages to any WhatsApp number
- 📥 **Receive Messages**: Receive incoming messages via webhooks
- 💬 **Conversations View**: Organized conversation list with unread counts
- ✓ **Message Status**: Track message delivery status (sent, delivered, read)
- 🔄 **Real-time Updates**: Auto-refresh conversations every 5 seconds
- 🎨 **Beautiful UI**: Modern chat interface with WhatsApp-like design

## Prerequisites

1. **WhatsApp Business Account**: Sign up at [Facebook Business](https://business.facebook.com/)
2. **WhatsApp Business API Access**: Set up via [Meta for Developers](https://developers.facebook.com/)
3. **Phone Number**: A verified phone number for WhatsApp Business

## Setup Instructions

### 1. Get WhatsApp Business API Credentials

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app or use an existing one
3. Add WhatsApp product to your app
4. Navigate to **WhatsApp > API Setup**
5. Note down:
   - **Phone Number ID**: Found in the API Setup section
   - **Access Token**: Temporary token (for testing) or System User Token (for production)

### 2. Configure Environment Variables

Create or update your `.env` file in the project root:

```env
# WhatsApp Business API Configuration
WHATSAPP_TOKEN=your_whatsapp_business_api_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_VERIFY_TOKEN=your_webhook_verify_token
WHATSAPP_API_VERSION=v18.0
```

**Environment Variables Explained:**

- `WHATSAPP_TOKEN`: Your WhatsApp Business API access token
- `WHATSAPP_PHONE_NUMBER_ID`: The phone number ID from Meta dashboard
- `WHATSAPP_VERIFY_TOKEN`: A custom token you create for webhook verification (can be any string)
- `WHATSAPP_API_VERSION`: WhatsApp API version (default: v18.0)

### 3. Set Up Webhook (For Receiving Messages)

1. In Meta for Developers, go to **WhatsApp > Configuration**
2. Click **Edit** next to Webhook
3. Set Callback URL to: `https://your-domain.com/plugins/whatsapp/webhook`
4. Set Verify Token to the same value as `WHATSAPP_VERIFY_TOKEN`
5. Subscribe to **messages** field

**Note**: For local development, use a tool like [ngrok](https://ngrok.com/) to expose your local server:

```bash
ngrok http 8000
```

Then use the ngrok URL for the webhook callback.

### 4. Start the Application

```bash
# Backend
cd backend
python main.py

# Frontend (in another terminal)
cd frontend
npm run dev
```

### 5. Verify Setup

1. Navigate to **Tasks** tab in SuperDashboard
2. You should see "WhatsApp Messages" instead of the default tasks view
3. Check the connection status indicator (green = connected, amber = not configured)

## Usage

### Sending Messages

1. Click **+ New Chat** button
2. Enter the recipient's phone number (without + or spaces, e.g., `1234567890`)
3. Type your message
4. Click **Send**

### Viewing Conversations

- All conversations appear in the left sidebar
- Click on a conversation to view message history
- Unread message count displayed as a badge
- Messages auto-refresh every 5 seconds

### Message Status Indicators

- ✓ Single checkmark: Message sent
- ✓✓ Double checkmark: Message delivered
- ✗ Cross: Message failed

## API Endpoints

### Health Check
```
GET /plugins/whatsapp/health
```
Returns plugin health status and configuration state.

### Send Message
```
POST /plugins/whatsapp/messages/send
Content-Type: application/json

{
  "to": "1234567890",
  "message": "Hello, World!",
  "message_type": "text"
}
```

### Get Messages
```
GET /plugins/whatsapp/messages
GET /plugins/whatsapp/messages?phone_number=1234567890
```
Retrieve all messages or filter by phone number.

### Get Conversations
```
GET /plugins/whatsapp/conversations
```
Get list of all conversations with metadata.

### Webhook Verification
```
GET /plugins/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE
```
WhatsApp webhook verification endpoint.

### Receive Messages
```
POST /plugins/whatsapp/webhook
```
Webhook endpoint for receiving messages from WhatsApp.

## Testing

Run the test suite:

```bash
cd plugins/whatsapp/backend
pytest test_main.py -v
```

### Test Coverage

- Health check endpoints
- Webhook verification
- Sending messages
- Receiving messages
- Message status updates
- Conversation management
- Message filtering

## Architecture

```
plugins/whatsapp/
├── backend/
│   ├── main.py          # FastAPI router with all endpoints
│   └── test_main.py     # Comprehensive test suite
├── frontend/
│   └── WhatsAppMessages.jsx  # React component for UI
├── plugin.json          # Plugin manifest
└── README.md           # This file
```

### Backend (`backend/main.py`)

- **FastAPI Router**: RESTful API endpoints
- **WhatsApp Business API Integration**: HTTP client for Meta's API
- **In-Memory Storage**: Messages stored in memory (replace with database for production)
- **Webhook Handling**: Receives incoming messages and status updates
- **Input Validation**: Pydantic models for request/response validation

### Frontend (`frontend/WhatsAppMessages.jsx`)

- **React Component**: Modern, responsive UI
- **Conversation List**: Sidebar with all active conversations
- **Message View**: Chat-like interface for viewing and sending messages
- **Auto-Refresh**: Polls for new messages every 5 seconds
- **Status Indicators**: Visual feedback for connection and message status

## Limitations & Considerations

### Current Limitations

1. **In-Memory Storage**: Messages are stored in memory and will be lost on server restart
   - **Solution**: Implement database storage (PostgreSQL, MongoDB, etc.)

2. **No Media Support**: Currently only supports text messages
   - **Future Enhancement**: Add support for images, documents, audio, video

3. **No Message Search**: No search functionality within messages
   - **Future Enhancement**: Add full-text search capability

4. **No Typing Indicators**: No real-time typing status
   - **Future Enhancement**: Implement WebSocket for real-time features

### Production Considerations

1. **Database Integration**
   - Replace `messages_db` list with database models
   - Recommended: PostgreSQL with SQLAlchemy

2. **Authentication**
   - Add user authentication to restrict access
   - Implement API key validation for webhook security

3. **Rate Limiting**
   - Implement rate limiting to avoid API quota issues
   - WhatsApp has messaging limits based on account tier

4. **Error Handling**
   - Enhanced error messages and logging
   - Implement retry logic for failed messages

5. **Scalability**
   - Use message queue (Redis, RabbitMQ) for high volume
   - Implement caching for conversation list

## Troubleshooting

### "Not Configured" Status

**Problem**: Plugin shows amber status indicator
**Solution**: Verify all environment variables are set correctly in `.env`

### Messages Not Sending

**Problem**: Send button doesn't work or shows error
**Solution**:
- Check access token is valid and not expired
- Verify phone number ID is correct
- Check recipient number format (digits only, no spaces or +)

### Webhook Not Receiving Messages

**Problem**: Incoming messages not appearing
**Solution**:
- Verify webhook URL is publicly accessible
- Check verify token matches in .env and Meta dashboard
- Ensure webhook is subscribed to "messages" field
- Check backend logs for errors

### Tests Failing

**Problem**: pytest shows failures
**Solution**:
- Ensure all dependencies are installed: `pip install pytest httpx`
- Check Python version compatibility (3.8+)
- Run tests with verbose mode: `pytest test_main.py -v`

## Support

For issues, questions, or contributions:

1. Check existing issues in the repository
2. Create a new issue with detailed description
3. Include error logs and environment details

## License

This plugin is part of SuperDashboard and follows the same license.

## Credits

Built with:
- [FastAPI](https://fastapi.tiangolo.com/) - Backend framework
- [React](https://react.dev/) - Frontend library
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp) - Messaging platform
- [HTTPX](https://www.python-httpx.org/) - HTTP client

---

**Happy Messaging! 💬**
