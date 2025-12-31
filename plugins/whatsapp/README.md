# WhatsApp AI Agent Plugin

A Twilio-powered WhatsApp integration plugin for SuperDashboard that automatically responds to incoming messages using your AI agent.

## Features

- 📱 **WhatsApp Messaging**: Send and receive WhatsApp messages via Twilio
- 🤖 **AI Auto-Responses**: Automatically respond to incoming messages with GPT-4
- 💬 **Conversation Management**: Track and manage multiple WhatsApp conversations
- 🔄 **Real-time Updates**: Messages update automatically every 3 seconds
- 📊 **Message History**: View full conversation history for each contact

## Prerequisites

1. **Twilio Account** (for WhatsApp messaging)
2. **OpenAI API Key** (for AI responses)

## Getting API Tokens

### 1. Twilio Setup

#### Step 1: Create a Twilio Account

1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up for a free account (you'll get trial credits)
3. Verify your email and phone number

#### Step 2: Get Your Credentials

1. After logging in, go to the [Twilio Console](https://console.twilio.com/)
2. You'll see your **Account SID** and **Auth Token** on the dashboard
3. Copy both values - you'll need them for the `.env` file

#### Step 3: Set Up WhatsApp

You have two options:

**Option A: WhatsApp Sandbox (For Testing)**

1. In the Twilio Console, navigate to **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Follow the instructions to join your sandbox by sending a specific code to the Twilio sandbox number
3. Your sandbox number will be in the format: `whatsapp:+14155238886`
4. This is **FREE** and perfect for testing

**Option B: Production WhatsApp Number (For Production)**

1. In the Twilio Console, navigate to **Messaging** → **WhatsApp** → **Senders**
2. Click **Get Started**
3. Follow the process to:
   - Get a Twilio phone number (costs money)
   - Register your business with Meta/Facebook
   - Complete the WhatsApp Business API setup
4. This process can take a few days and requires business verification

**Recommendation**: Start with the Sandbox for development and testing.

### 2. OpenAI API Key

#### Step 1: Create OpenAI Account

1. Go to [https://platform.openai.com/signup](https://platform.openai.com/signup)
2. Sign up or log in to your account

#### Step 2: Get API Key

1. Navigate to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click **Create new secret key**
3. Give it a name (e.g., "SuperDashboard WhatsApp")
4. Copy the key immediately (you won't be able to see it again)

#### Step 3: Add Credits (if needed)

1. Go to [https://platform.openai.com/account/billing](https://platform.openai.com/account/billing)
2. Add a payment method and credits
3. New accounts often get free trial credits

## Configuration

### 1. Update Environment Variables

Add these variables to your `backend/.env` file:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886  # Use your sandbox or production number

# OpenAI Configuration (for AI responses)
OPENAI_API_KEY=sk-proj-...your_key_here
```

### 2. Configure Twilio Webhook

For incoming messages to work, Twilio needs to know where to send them.

#### For Local Development (using ngrok):

1. Install ngrok: [https://ngrok.com/download](https://ngrok.com/download)

2. Start your backend server:
   ```bash
   cd backend
   python main.py
   ```

3. In a new terminal, start ngrok:
   ```bash
   ngrok http 8000
   ```

4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

5. Go to Twilio Console → **Messaging** → **WhatsApp Sandbox Settings** (or your production number settings)

6. Set the webhook:
   - **When a message comes in**: `https://abc123.ngrok.io/plugins/whatsapp/webhook`
   - **Method**: POST

#### For Production:

1. Deploy your backend to a server with a public domain (e.g., `https://yourdomain.com`)

2. Configure the webhook in Twilio:
   - **When a message comes in**: `https://yourdomain.com/plugins/whatsapp/webhook`
   - **Method**: POST

### 3. Restart Backend Server

After updating `.env`, restart your backend:

```bash
cd backend
python main.py
```

## Usage

### 1. Access the Plugin

1. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

2. Open SuperDashboard in your browser

3. Click **WhatsApp AI Agent** in the sidebar

### 2. Send a Message

1. Click **+ New Chat**
2. Enter a phone number (without the + sign, e.g., `1234567890`)
3. Type your message and click **Send**

### 3. Receive Messages (with AI Auto-Response)

1. Send a WhatsApp message to your Twilio number from your phone
2. The message will appear in the dashboard
3. **If AI is enabled**, the agent will automatically respond
4. You'll see both the incoming message and AI response in the conversation

### 4. Manual Reply

1. Select a conversation from the left sidebar
2. Type your message in the input box
3. Press Enter or click **Send**

## How AI Auto-Response Works

When someone sends a WhatsApp message to your Twilio number:

1. Twilio receives the message and sends it to your webhook endpoint
2. Your backend stores the message in memory
3. The backend sends the message to OpenAI's GPT-4 model
4. GPT-4 generates a response
5. The backend sends the AI response back via WhatsApp
6. Both messages are stored and displayed in the dashboard

## API Endpoints

### Backend Endpoints

- `GET /plugins/whatsapp/health` - Check configuration status
- `POST /plugins/whatsapp/send` - Send a WhatsApp message
- `POST /plugins/whatsapp/webhook` - Receive incoming messages (Twilio webhook)
- `GET /plugins/whatsapp/messages` - Get message history
- `GET /plugins/whatsapp/conversations` - Get all conversations
- `POST /plugins/whatsapp/chat` - Chat with AI (frontend only)
- `DELETE /plugins/whatsapp/messages` - Clear message history
- `GET /plugins/whatsapp/config-instructions` - Get setup instructions

## Troubleshooting

### Messages Not Being Received

1. **Check Twilio Webhook Configuration**
   - Verify the webhook URL is correct
   - Ensure it's using HTTPS (ngrok provides this)
   - Check Twilio Console → Debugger for webhook errors

2. **Check Backend Logs**
   - Look for "📱 Incoming WhatsApp message" in the console
   - Check for any error messages

3. **Verify Environment Variables**
   - Ensure all credentials are set in `.env`
   - Restart the backend after updating `.env`

### AI Not Responding

1. **Check OpenAI API Key**
   - Verify `OPENAI_API_KEY` is set in `.env`
   - Check you have credits: [https://platform.openai.com/account/usage](https://platform.openai.com/account/usage)

2. **Check Backend Logs**
   - Look for "🤖 AI Response" in the console
   - Check for error messages like "insufficient_quota"

### Sandbox Limitations

If using Twilio Sandbox:

- Only pre-approved phone numbers can receive messages
- Add numbers by having them send the join code to the sandbox
- Messages have "Sent from your Twilio trial account" prefix
- Limited message templates

### Production Number Required

If you need:

- Multiple users to receive messages without joining
- Custom branding (no Twilio prefix)
- Higher message limits
- WhatsApp Business features

Then you'll need to set up a production WhatsApp number (Option B above).

## Cost Information

### Twilio Costs

- **Sandbox**: FREE (for testing only)
- **WhatsApp Messages**: ~$0.005 per message (inbound) + $0.0042 per message (outbound)
- **Phone Number**: ~$1-2/month (if you need a production number)
- **Trial Credits**: Twilio provides free trial credits to start

### OpenAI Costs

- **GPT-4**: ~$0.03 per 1K input tokens, ~$0.06 per 1K output tokens
- **Average Response**: ~$0.01-0.05 per AI response (varies by message length)
- **Trial Credits**: OpenAI provides free trial credits for new users

**Example**: 100 WhatsApp conversations with AI responses ≈ $3-5 total

## Security Notes

1. **Never commit your `.env` file** - it contains sensitive credentials
2. **Use environment variables** - don't hardcode API keys
3. **Webhook Security**: In production, implement Twilio's signature validation (currently commented in code)
4. **Rate Limiting**: Consider adding rate limiting for the webhook endpoint
5. **Access Control**: Add authentication to prevent unauthorized API access

## Development Tips

1. **Use ngrok for local testing** - makes your local server accessible to Twilio
2. **Check Twilio Debugger** - shows all webhook requests and errors
3. **Monitor OpenAI usage** - keep an eye on costs in the OpenAI dashboard
4. **Test with sandbox first** - don't pay for production until you're ready

## Support

### Twilio Resources

- [Twilio WhatsApp Docs](https://www.twilio.com/docs/whatsapp)
- [Twilio Console](https://console.twilio.com/)
- [Twilio Support](https://support.twilio.com/)

### OpenAI Resources

- [OpenAI Platform Docs](https://platform.openai.com/docs)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [OpenAI Help Center](https://help.openai.com/)

## License

MIT License - Copyright 2025 Chris Chan
