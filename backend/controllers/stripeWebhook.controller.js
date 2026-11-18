import { getStripe } from "../utils/stripe.utils.js";
import { handleCheckoutEvent } from "../utils/checkoutFulfillment.utils.js";

export const receiveStripeWebhook = async (req, res) => {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !webhookSecret) {
        return res.status(503).json({ message: "Stripe webhook is not configured" });
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            req.headers["stripe-signature"],
            webhookSecret
        );
    } catch (error) {
        console.error("Stripe webhook signature verification failed:", error.message);
        return res.status(400).json({ message: "Invalid Stripe signature" });
    }

    try {
        await handleCheckoutEvent({ event, stripe });
        return res.json({ received: true });
    } catch (error) {
        console.error(`Stripe webhook ${event.id} processing failed:`, error);
        return res.status(500).json({ message: "Webhook processing failed" });
    }
};
