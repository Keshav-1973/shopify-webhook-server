const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Environment variables
const SECRET_KEY = process.env.SHOPIFY_SECRET_KEY;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Middleware to capture raw body for HMAC validation
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

app.post('/webhooks/orders/create', async (req, res) => {
    console.log('✅ Received a Shopify Order Webhook');

    const hmac = req.get('X-Shopify-Hmac-Sha256');
    if (!hmac || !SECRET_KEY) {
        console.log('❌ Missing HMAC or SECRET_KEY');
        return res.sendStatus(403);
    }

    const computedHmac = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(req.rawBody.toString('utf8'))
        .digest('base64');

    if (computedHmac !== hmac) {
        console.log('❌ HMAC verification failed! Possible tampering detected.');
        return res.sendStatus(403);
    }

    console.log('✅ HMAC verification passed!');
    res.sendStatus(200); // Respond to Shopify

    // Extract Order Details
    const order = req.body;

    // Safely get the customer's phone number
    let phone =
        order.customer?.phone ||
        order.shipping_address?.phone ||
        order.billing_address?.phone ||
        null;

    if (!phone) {
        console.log('❌ No phone number found in the order!');
        return;
    }

    // Sanitize phone number (remove non-digits)
    const sanitizedPhone = phone.replace(/[^\d]/g, '');

    // Optional: Ensure the phone number includes the country code
    if (!sanitizedPhone.startsWith('91')) {
        console.log('⚠️ Phone number may not be in international format:', sanitizedPhone);
    }

    // WhatsApp API request body
   const messageData = {
  messaging_product: 'whatsapp',
  to: sanitizedPhone,
  type: 'template',
  template: {
    name: 'order_confirmed', // <-- use your actual template name here
    language: { code: 'en_US' }, // or 'en_GB' if that's the available translation
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: order.customer?.first_name || 'there' },        // {{1}} Name
          { type: 'text', text: `#${order.id}` },                                // {{2}} Order ID
          { type: 'text', text: '2 12-pack of Jasper\'s paper towels' },         // {{3}} Items
          { type: 'text', text: 'Jan 1, 2024' }                                   // {{4}} ETA
        ]
      }
    ]
  }
};


    // WhatsApp API request config
    const config = {
        headers: {
            Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        }
    };

    // Send message
    try {
        const response = await axios.post(
            `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
            messageData,
            config
        );
        console.log('✅ WhatsApp Message Sent:', response.data);
    } catch (err) {
        console.error('❌ WhatsApp API Error:', err.response?.data || err.message);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}!`));
