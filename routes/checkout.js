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



const express = require("express");
const router = express.Router();

const stripe = require("stripe")(
  process.env.STRIPE_SECRET_KEY
);

/*
 * All trusted plan names and prices are stored on the backend.
 *
 * The object keys must match the plan IDs sent by the frontend.
 *
 * Stripe expects GBP values in pence:
 * £7.99 = 799
 * £19.99 = 1999
 */
const subscriptionPlans = {
  candidate: {
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
  },

  company: {
    /*
     * Your frontend is currently sending:
     * planId: "company-starter"
     *
     * Therefore, this exact key must exist.
     */
    "company-starter": {
      name: "Company Starter",
      currency: "gbp",

      // £19.99 per month.
      // Change this amount to your actual Starter price.
      amount: 1999,

      interval: "month",
    },

    "company-yearly": {
      name: "Company Premium Yearly",
      currency: "gbp",

      // £199.99 per year.
      // Change this amount to your actual yearly price.
      amount: 19999,

      interval: "year",
    },
  },
};

/*
 * Supports older or alternative plan IDs.
 *
 * This prevents errors if one page sends "monthly"
 * while another page sends "company-monthly".
 */
const planAliases = {
  candidate: {
    monthly: "candidate-monthly",
    yearly: "candidate-yearly",
  },

  company: {
    starter: "company-starter",
    monthly: "company-starter",
    "company-monthly": "company-starter",
    yearly: "company-yearly",
  },
};

/**
 * Converts the received plan ID into a recognised backend plan ID.
 *
 * Examples:
 * company-starter -> company-starter
 * company-monthly -> company-starter
 * monthly         -> company-starter
 */
const normalizePlanId = (planId, customerType) => {
  // Convert the plan ID to clean lowercase text.
  const cleanedPlanId = String(planId || "")
    .trim()
    .toLowerCase();

  /*
   * First check whether the exact plan ID already exists.
   *
   * For example:
   * subscriptionPlans.company["company-starter"]
   */
  if (
    subscriptionPlans[customerType]?.[cleanedPlanId]
  ) {
    return cleanedPlanId;
  }

  /*
   * Otherwise, check whether it is an older
   * or alternative plan ID.
   */
  return (
    planAliases[customerType]?.[cleanedPlanId] ||
    cleanedPlanId
  );
};

/**
 * Creates a Stripe Checkout Session.
 *
 * Final endpoint:
 * POST /api/create-checkout-session
 */
router.post(
  "/create-checkout-session",
  async (req, res) => {
    try {
      console.log(
        "Checkout request body:",
        req.body
      );

      // Read the plan information sent by React.
      const {
        planId: receivedPlanId,
        customerType: receivedCustomerType,
      } = req.body;

      // Normalize the customer type.
      const customerType = String(
        receivedCustomerType || ""
      )
        .trim()
        .toLowerCase();

      // Make sure both required values were provided.
      if (!receivedPlanId || !customerType) {
        return res.status(400).json({
          success: false,
          message:
            "Plan ID and customer type are required.",
        });
      }

      /*
       * Only candidate and company are valid
       * user roles in this application.
       */
      const allowedCustomerTypes = [
        "candidate",
        "company",
      ];

      if (
        !allowedCustomerTypes.includes(customerType)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer type.",
        });
      }

      /*
       * Convert alternative IDs into the correct
       * backend plan ID.
       */
      const normalizedPlanId = normalizePlanId(
        receivedPlanId,
        customerType
      );

      console.log(
        "Normalized checkout details:",
        {
          receivedPlanId,
          normalizedPlanId,
          customerType,
        }
      );

      /*
       * Find the selected plan from the correct
       * candidate or company section.
       */
      const selectedPlan =
        subscriptionPlans[customerType]?.[
          normalizedPlanId
        ];

      // Return a useful error if the plan still cannot be found.
      if (!selectedPlan) {
        console.error(
          "Subscription plan not found:",
          {
            customerType,
            receivedPlanId,
            normalizedPlanId,
            availablePlans: Object.keys(
              subscriptionPlans[customerType] ||
                {}
            ),
          }
        );

        return res.status(400).json({
          success: false,
          message: `Invalid ${customerType} plan: ${receivedPlanId}`,
        });
      }

      console.log(
        "Selected backend plan:",
        selectedPlan
      );

      /*
       * Choose where Stripe should return the user
       * if they cancel the checkout.
       */
      const cancelPath =
        customerType === "company"
          ? "/company/Payment"
          : "/candidate/Payment";

      /*
       * Create the Stripe recurring subscription.
       */
      const session =
        await stripe.checkout.sessions.create({
          // Allow card payments.
          payment_method_types: ["card"],

          // Add the selected subscription plan.
          line_items: [
            {
              price_data: {
                // Charge in British pounds.
                currency:
                  selectedPlan.currency,

                // Name displayed on Stripe Checkout.
                product_data: {
                  name: selectedPlan.name,
                },

                // Amount must be provided in pence.
                unit_amount:
                  selectedPlan.amount,

                // Configure monthly or yearly billing.
                recurring: {
                  interval:
                    selectedPlan.interval,
                },
              },

              // One subscription is being purchased.
              quantity: 1,
            },
          ],

          // Required for recurring payments.
          mode: "subscription",

          /*
           * Save internal information on the
           * Stripe Checkout Session.
           */
          metadata: {
            customerType,
            planId: normalizedPlanId,
          },

          /*
           * Save the same information on the
           * Stripe Subscription itself.
           */
          subscription_data: {
            metadata: {
              customerType,
              planId: normalizedPlanId,
            },
          },

          /*
           * Redirect here after successful checkout.
           */
          success_url:
            `${process.env.CLIENT_URL}/success` +
            "?session_id={CHECKOUT_SESSION_ID}",

          /*
           * Redirect to the correct payment page
           * when checkout is cancelled.
           */
          cancel_url:
            `${process.env.CLIENT_URL}${cancelPath}`,
        });

      // Make sure Stripe returned a checkout URL.
      if (!session.url) {
        return res.status(500).json({
          success: false,
          message:
            "Stripe did not return a checkout URL.",
        });
      }

      // Send the Stripe Checkout URL to React.
      return res.status(200).json({
        success: true,
        url: session.url,
      });
    } catch (error) {
      console.error(
        "Stripe checkout session error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Unable to create the checkout session.",
      });
    }
  }
);

module.exports = router;