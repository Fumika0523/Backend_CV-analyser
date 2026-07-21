const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Final URL: POST http://localhost:5000/api/create-checkout-session
router.post('/create-checkout-session', async (req, res) => {
  try {
    console.log("Checkout request body:", req.body);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Pro Plan' },
          unit_amount: 999, // in cents = $9.99
        },
        quantity: 1,
      }],
      mode: 'payment', // use 'subscription' for recurring plans
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
