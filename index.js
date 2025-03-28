const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const crypto = require('crypto')
const axios = require('axios')

require('dotenv').config()  // Load environment variables from .env file

const SECRET_KEY = process.env.SHOPIFY_SECRET_KEY
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN

app.use(bodyParser.json())  // Use body-parser to parse JSON body

app.post('/webhooks/orders/create', async (req, res) => {
    console.log('Yes, We got an order!')

    // Verify Shopify Webhook Signature
    const hmac = req.get('X-Shopify-Hmac-Sha256')
    const body = JSON.stringify(req.body) // Convert JSON body to string

    const hash = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(body, 'utf8')
        .digest('base64')

    if (hash !== hmac) {
        console.log('Danger! Not from Shopify!')
        return res.sendStatus(403)
    }

    console.log('Phew, it came from Shopify!')
    res.sendStatus(200)

    // Extract Order Details
    const order = req.body
    const phone = order.customer?.phone || 'default_number'
    const firstName = order.customer?.first_name || 'Customer'
    const orderId = order.id || 'Unknown'

    // Send WhatsApp Message
    const config = {
        headers: { 
            Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, 
            'Content-Type': 'application/json'
        }
    }

    const messageData = {
        "messaging_product": "whatsapp", 
        "to": phone, 
        "type": "template", 
        "template": { 
            "name": "order_confirmation", 
            "language": { "code": "en_GB" },
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        { "type": "text", "text": firstName },
                        { "type": "text", "text": orderId }
                    ]
                }
            ] 
        } 
    }

    axios.post("https://graph.facebook.com/v14.0/103738239149898/messages", messageData, config)
        .then(result => console.log(result.data))    
        .catch(err => console.log(err.response?.data || err))
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}!`))
