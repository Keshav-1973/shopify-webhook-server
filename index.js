const express = require('express');
const bodyParser = require('body-parser');
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
        console.log('❌ HMAC verification failed! Possible tampering detected.');
        return res.sendStatus(403);
    }

    console.log('✅ HMAC verification passed!');
    res.sendStatus(200);

    // Extract Order Details
    const order = req.body;
    const phone = '918619318876'; // Default phone if missing
    
    // WhatsApp API request
    const messageData = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
            name: 'hello_world',
            language: { code: 'en_US' }
        }
    };

    const config = {
        headers: {
            Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        }
    };

    axios.post(`https://graph.facebook.com/v22.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, messageData, config)
        .then(result => console.log('✅ WhatsApp Message Sent:', result.data))
        .catch(err => console.log('❌ WhatsApp API Error:', err.response?.data || err));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}!`));
