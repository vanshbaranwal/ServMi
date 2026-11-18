import { Stripe } from "stripe";

export const getStripe = () => {
    if(!process.env.STRIPE_SECRET_KEY){
        return null;
    }

    return new Stripe(process.env.STRIPE_SECRET_KEY);
};

export const toStripeAmount = (price) => {
    return Math.round(Number(price || 0) * 100);
};

// INR card payments need at least 50 paise; the upper bound also fits Amex's 9-digit minor-unit limit.
export const isValidServicePrice = (price) => {
    if (typeof price !== "number" || !Number.isFinite(price) || price < 0) return false;
    const amount = price * 100;
    const rounded = Math.round(amount);
    return Math.abs(amount - rounded) < 0.000001
        && rounded <= 999_999_999
        && (rounded === 0 || rounded >= 50);
};
