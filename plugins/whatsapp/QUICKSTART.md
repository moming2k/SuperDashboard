# WhatsApp Plugin - Quick Start Guide

## ✅ Can Normal Users Send Messages?

**YES!** All providers support receiving messages from normal WhatsApp users:

| Provider | Can Receive from Normal Users? | Setup Difficulty | Cost |
|----------|-------------------------------|------------------|------|
| **Twilio Sandbox** | ✅ Yes (after "join" command) | ⭐ Easy (5 min) | 💰 FREE |
| **Twilio Production** | ✅ Yes (no opt-in needed) | ⭐⭐ Medium | 💰 $0.005/msg |
| **Meta WhatsApp Business** | ✅ Yes | ⭐⭐⭐ Hard | 💰 Free tier available |
| **whatsapp-web.js** | ✅ Yes | ⭐ Easy (10 min) | 💰 FREE |

---

## 🚀 Fastest Setup: Twilio Sandbox (5 minutes)

### Step 1: Sign Up for Twilio
1. Go to https://www.twilio.com/try-twilio
2. Sign up for a free account
3. Verify your email and phone

### Step 2: Get Your Credentials
1. Go to https://console.twilio.com/
2. From the dashboard, copy:
   - **Account SID**
   - **Auth Token**
3. Go to **Messaging > Try it out > Send a WhatsApp message**
4. Note the **Sandbox Number** (e.g., `+1 415 523 8886`)

### Step 3: Configure Your .env File
```env
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

### Step 4: Start Your App
```bash
# Terminal 1: Start backend
cd backend
python main.py

# Terminal 2: Start frontend
cd frontend
npm run dev
```

### Step 5: Test It!
1. **Enable your test phone on Twilio Sandbox:**
   - From your personal WhatsApp, send: `join <your-sandbox-keyword>` to `+1 415 523 8886`
   - You'll get a confirmation message

2. **Send a message from SuperDashboard:**
   - Open http://localhost:5173
   - Click "Tasks" (will show WhatsApp Messages)
   - Click "+ New Chat"
   - Enter your phone number (without +, e.g., `1234567890`)
   - Type a message and send!

3. **Receive messages:**
   - Send a WhatsApp message from your phone to the sandbox number
   - It will appear in SuperDashboard automatically!

**That's it!** 🎉 You're now receiving and sending WhatsApp messages.

---

## 🔧 Production Setup: Twilio Production

For production (no "join" message needed):

### Step 1: Request Twilio WhatsApp Sender Approval
1. Go to Twilio Console > Messaging > Senders > WhatsApp senders
2. Click "Request to enable my Twilio numbers for WhatsApp"
3. Fill out the form (business info, use case, etc.)
4. Wait for approval (usually 1-3 business days)

### Step 2: Get Your WhatsApp-Enabled Number
Once approved:
```env
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890  # Your approved number
```

Now ANY WhatsApp user can message you without opt-in!

---

## 💻 Free Option: whatsapp-web.js (No API Keys!)

Uses your personal WhatsApp account via WhatsApp Web protocol.

### Step 1: Install whatsapp-web.js Server

Create a simple server:

```bash
# Create a new directory
mkdir whatsapp-server
cd whatsapp-server

# Initialize Node.js project
npm init -y

# Install dependencies
npm install whatsapp-web.js express qrcode-terminal
```

### Step 2: Create Server File

Create `server.js`:

```javascript
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    console.log('Scan this QR code with your WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WhatsApp Client is ready!');
});

client.on('message', async (msg) => {
    // Forward to SuperDashboard webhook
    const webhookUrl = 'http://localhost:8000/plugins/whatsapp/webhook';
    await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event: 'message',
            data: {
                from: msg.from,
                to: msg.to,
                body: msg.body,
                timestamp: msg.timestamp,
                id: { id: msg.id.id }
            }
        })
    });
});

// API endpoint to send messages
app.post('/send-message', async (req, res) => {
    const { chatId, message } = req.body;

    try {
        const result = await client.sendMessage(chatId, message);
        res.json({ success: true, id: result.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log('WhatsApp server running on port 3000');
});

client.initialize();
```

### Step 3: Start the Server

```bash
node server.js
```

A QR code will appear - **scan it with your WhatsApp!**

### Step 4: Configure SuperDashboard

```env
WHATSAPP_PROVIDER=whatsapp-web
WHATSAPP_WEB_SERVER_URL=http://localhost:3000
```

### Step 5: Test It!

Now you can send/receive messages using your personal WhatsApp account!

**Important Notes:**
- ⚠️ Keep your phone connected to internet
- ⚠️ Server must stay running
- ⚠️ Against WhatsApp ToS (use for personal projects only)
- ⚠️ WhatsApp may ban your number if detected

---

## 📊 Provider Comparison

### Twilio Sandbox (RECOMMENDED FOR TESTING)
✅ **Pros:**
- FREE
- Setup in 5 minutes
- Receive from normal users (after opt-in)
- Great for development

❌ **Cons:**
- Users must send "join" message first
- Limited to 1 sandbox number
- Twilio branding on messages

### Twilio Production
✅ **Pros:**
- No opt-in message needed
- Your own phone number
- Professional
- Reliable

❌ **Cons:**
- Costs $0.005 per message
- Requires business approval
- 1-3 days approval time

### whatsapp-web.js
✅ **Pros:**
- 100% FREE
- No approval needed
- Instant setup
- No API limits

❌ **Cons:**
- Against WhatsApp ToS
- Risk of account ban
- Phone must stay online
- Not suitable for production

### Meta WhatsApp Business API
✅ **Pros:**
- Official solution
- Most features
- Free tier available

❌ **Cons:**
- Complex setup
- Requires business verification
- Facebook dependency

---

## 🎯 Which Should You Choose?

**For Testing/Development:**
→ **Twilio Sandbox** (easiest, free, works great)

**For Production (Small Scale):**
→ **Twilio Production** (reliable, cheap, easy to maintain)

**For Personal Projects:**
→ **whatsapp-web.js** (free, but risky)

**For Enterprise:**
→ **Meta WhatsApp Business API** (official, scalable)

---

## 🆘 Common Issues

### "Not Configured" Error
**Fix:** Make sure you've set the correct environment variables for your chosen provider

### Twilio: "User not opted in"
**Fix:** Send `join <keyword>` message to the Twilio sandbox number first

### whatsapp-web.js: Not receiving messages
**Fix:**
1. Check if your phone is connected
2. Check if QR code was scanned
3. Check server logs

### Messages not appearing in dashboard
**Fix:**
1. Check webhook URL is correct
2. Verify backend is running
3. Check browser console for errors

---

## 💡 Tips

1. **Start with Twilio Sandbox** - it's the fastest way to test
2. **Use ngrok for webhooks** during development:
   ```bash
   ngrok http 8000
   # Use the ngrok URL for webhooks
   ```
3. **Check Twilio logs** - very helpful for debugging
4. **Test with your own number first** before inviting others

---

Need help? Check the main [README.md](README.md) or open an issue!
