const express = require('express')
const app = express()
const getRawBody = require('raw-body')
const crypto = require('crypto')
const axios = require('axios').default
const secretKey = 'put-your-secret-key-here'

let key = 'put-your-access-token'

app.post('/webhooks/orders/create', async (req, res) => {
  console.log('Yes, We got an order!')
  
  // We'll compare the hmac to our own hash
  const hmac = req.get('X-Shopify-Hmac-Sha256')

  // Use raw-body to get the body (buffer)
  const body = await getRawBody(req)

  // Create a hash using the body and our key
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(body, 'utf8', 'hex')
    .digest('base64')

  // Compare our hash to Shopify's hash
  if (hash === hmac) {
    // It's a match! All good
    console.log('Phew, it came from Shopify!')
    res.sendStatus(200)
  } else {
    // No match! This request didn't originate from Shopify
    console.log('Danger! Not from Shopify!')
    res.sendStatus(403)
  }

  const config = {
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'}
  };

  const d = {
    "messaging_product": "whatsapp", 
    "to": `${outputData[0].customer.phone}`, 
    "type": "template", 
    "template": { 
      "name": "order_confirmation", 
      "language": { "code": "en_GB" },
      "components": [
        {
          "type": "body",
          "parameters": [
            {
              "type": "text",
              "text": `${outputData[0].customer.first_name}`
            },
            {
              "type": "text",
              "text": `${outputData[0].id}`
            }
          ]
        }
      ] 
    } 
  } 

axios.post("https://graph.facebook.com/v14.0/103738239149898/messages", d, config)
    .then(result=> console.log(result))    
    .catch(err=>console.log(err))
})

app.listen(3000, () => console.log('Now running on port 3000!'))