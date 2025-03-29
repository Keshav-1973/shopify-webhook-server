require('dotenv').config();
const express = require('express');
const getRawBody = require('raw-body');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Load sensitive keys from environment variables
const SHOPIFY_SECRET_KEY = process.env.SHOPIFY_SECRET_KEY;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

// Middleware to handle raw body (needed for HMAC verification)
app.use(express.json());

app.post('/webhooks/orders/create', async (req, res) => {
    console.log('✅ Received a Shopify Order Webhook');

    try {
        // Retrieve HMAC header from Shopify request
        const hmac = req.get('X-Shopify-Hmac-Sha256');
        console.log('🔍 Shopify HMAC Header:', hmac);

        // Read raw request body
        const rawBody = await getRawBody(req);
        console.log('📦 Raw Body:', rawBody.toString());

        // Generate HMAC hash for verification
        const generatedHash = crypto
            .createHmac('sha256', SHOPIFY_SECRET_KEY)
            .update(rawBody, 'utf8', 'hex')
            .digest('base64');

        console.log('🔑 Generated Hash:', generatedHash);

        // Verify if the request is from Shopify
        if (generatedHash !== hmac) {
            console.log('❌ HMAC Mismatch! Unauthorized request');
            return res.status(403).send('Unauthorized');
        }

        console.log('✅ Shopify HMAC Verified!');

        // Parse order details
        const orderData = JSON.parse(rawBody.toString());
        console.log('📦 Order Data:', orderData);

        // Extract customer details
        const customerName = orderData.customer?.first_name || 'Customer';
        const customerPhone = orderData.customer?.phone;
        const orderId = orderData.id;

        if (!customerPhone) {
            console.log('⚠️ No phone number found. Skipping WhatsApp message.');
            return res.sendStatus(200);
        }

        // Prepare WhatsApp API request
        const whatsappData = {
            messaging_product: 'whatsapp',
            to: customerPhone,
            type: 'template',
            template: {
                name: 'order_confirmation',
                language: { code: 'en_GB' },
                components: [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: customerName },
                            { type: 'text', text: orderId.toString() }
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

        console.log('📲 Sending WhatsApp Notification to:', customerPhone);

        // Send WhatsApp message
        const response = await axios.post(
            'https://graph.facebook.com/v14.0/103738239149898/messages',
            whatsappData,
            config
        );

        console.log('✅ WhatsApp Message Sent:', response.data);
        res.sendStatus(200);

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.sendStatus(500);
    }
});

// Start the server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
