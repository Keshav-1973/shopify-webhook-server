const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();

const SECRET_KEY = process.env.SHOPIFY_SECRET_KEY;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

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
    console.log('❌ HMAC verification failed!');
    return res.sendStatus(403);
  }

  console.log('✅ HMAC verification passed!');
  res.sendStatus(200); // Respond to Shopify ASAP

  const order = req.body;

// Step 1: Extract customer phone number and add country code if needed
let phone =
  order.customer?.phone ||
  order.shipping_address?.phone ||
  order.billing_address?.phone;

if (!phone) {
  console.log('❌ No phone number found in the order!');
  return;
}

const sanitizedPhone = phone.replace(/[^\d]/g, '');  // Remove non-digits
const countryCode = order.shipping_address?.country_code || 'IN'; // Default to 'IN' if country code is not found

// If phone number doesn't already include country code, prepend it
const formattedPhone = `+${countryCode}${sanitizedPhone}`;

console.log(`Formatted Phone: ${formattedPhone}`);


  // Step 2: Prepare template variables
  const customerName = order.customer?.first_name || 'Customer';        // {{1}}
  const orderPurpose = 'purchase';                                      // {{2}} (static)
  const orderId = order.name || `#${order.id}`;                         // {{3}}

  const lineItems = order.line_items || [];
  const productSummary = lineItems
    .map(item => `${item.quantity} x ${item.name}`)
    .join(', ') || 'your items';                                        // {{4}}

const orderToken = order.id || '1234567890abcdef';                      // {{5}}

  // Step 3: Send WhatsApp message
 const messageData = {
  messaging_product: 'whatsapp',
  to: formattedPhone,
  type: 'template',
  template: {
    name: 'shopify_order_comfirmation', // your approved template name
    language: { code: 'en_US' },
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: customerName },  // {{1}}
          { type: 'text', text: orderPurpose },   // {{2}}
          { type: 'text', text: orderId },        // {{3}}
          { type: 'text', text: productSummary }, // {{4}}
          { type: 'text', text: orderToken }      // {{5}} - Token used in message body
        ]
      },
      {
        type: 'button',
        sub_type: 'url',
        index: 0,
        parameters: [
          { type: 'text', text: orderToken }      // {{5}} - Token used in button URL
        ]
      }
    ]
  }
};

  const config = {
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      messageData,
      config
    );
    console.log('✅ WhatsApp message sent:', response.data);
  } catch (err) {
    console.error('❌ WhatsApp API Error:', err.response?.data || err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}!`));
