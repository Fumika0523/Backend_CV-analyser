// const express = require('express');
// const router = express.Router();
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// // Final URL: POST http://localhost:5000/api/create-checkout-session
// router.post('/create-checkout-session', async (req, res) => {
//   try {
//     console.log("Checkout request body:", req.body);

//     const session = await stripe.checkout.sessions.create({
//       payment_method_types: ['card'],
//       line_items: [{
//         price_data: {
//           currency: 'usd',
//           product_data: { name: 'Pro Plan' },
//           unit_amount: 999, // in cents = $9.99
//         },
//         quantity: 1,
//       }],
//       mode: 'payment', // use 'subscription' for recurring plans
//       success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
//       cancel_url: `${process.env.CLIENT_URL}/cancel`,
//     });

//     res.json({ url: session.url });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });

// module.exports = router;
const express = require("express");
const router = express.Router();
const stripe = require("stripe")(
  process.env.STRIPE_SECRET_KEY
);

const candidatePlans = {
  "candidate-monthly": {
    name: "Candidate Premium Monthly",
    currency: "gbp",
    amount: 799,
    interval: "month",
  },

  "candidate-yearly": {
    name: "Candidate Premium Yearly",
    currency: "gbp",
    amount: 6999,
    interval: "year",
  },
};

router.post(
  "/create-checkout-session",
  async (req, res) => {
    try {
      console.log("Checkout request body:", req.body);

      // Read the plan information sent from React.
      const { planId, customerType } = req.body;

      // Ensure this request is for a candidate plan.
      if (customerType !== "candidate") {
        return res.status(400).json({
          message: "Invalid customer type",
        });
      }

      // Find the trusted backend plan configuration.
      const selectedPlan = candidatePlans[planId];

      // Reject unknown or manipulated plan IDs.
      if (!selectedPlan) {
        return res.status(400).json({
          message: "Invalid candidate plan",
        });
      }

      console.log("Selected backend plan:", selectedPlan);

      const session =
        await stripe.checkout.sessions.create({
          payment_method_types: ["card"],

          line_items: [
            {
              price_data: {
                currency: selectedPlan.currency,

                product_data: {
                  name: selectedPlan.name,
                },

                // Stripe expects GBP amounts in pence.
                unit_amount: selectedPlan.amount,

                // Makes this a recurring subscription.
                recurring: {
                  interval: selectedPlan.interval,
                },
              },

              quantity: 1,
            },
          ],

          // Required because the price is recurring.
          mode: "subscription",

          success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,

          cancel_url: `${process.env.CLIENT_URL}/candidate/Payment`,
        });

      return res.status(200).json({
        url: session.url,
      });
    } catch (error) {
      console.error(
        "Stripe checkout session error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Unable to create checkout session",
      });
    }
  }
);

module.exports = router;