import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { Stripe } from "stripe";
import { Availability } from "../models/availability.models.js";
import { Booking } from "../models/booking.models.js";
import { BookingDateLock } from "../models/bookingDateLock.models.js";
import { Service } from "../models/service.models.js";
import { User } from "../models/user.models.js";
import { WalletTransaction } from "../models/walletTransaction.models.js";
import { RateLimitBucket } from "../models/rateLimitBucket.models.js";
import { createPublicBooking, getBookingStatus, requestPublicBookingOtp } from "../controllers/public.controller.js";
import { registerUser, requestRegistrationOTP } from "../controllers/auth.controller.js";
import { updatePayoutDetails } from "../controllers/payment.controller.js";
import { receiveStripeWebhook } from "../controllers/stripeWebhook.controller.js";
import { ensurePayoutRecorded, handleCheckoutEvent, validateCheckoutSession } from "../utils/checkoutFulfillment.utils.js";
import { withBookingDateLock } from "../utils/bookingDateLock.utils.js";
import { generateSlots } from "../utils/slotGenerator.utils.js";
import { isValidServicePrice } from "../utils/stripe.utils.js";
import { isValidTimeRange } from "../utils/time.utils.js";
import { formatBookingDateTime } from "../utils/bookingNotifications.utils.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";

const objectId = "507f1f77bcf86cd799439011";
const serviceId = "507f1f77bcf86cd799439012";

const invoke = async (handler, req) => {
    const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
    await handler(req, res);
    return res;
};

test("Checkout session must match booking ID, amount, and currency", () => {
    const booking = { _id: objectId, stripeSessionId: "cs_test_123", amount: 2500, currency: "inr" };
    const session = { id: "cs_test_123", metadata: { bookingId: objectId }, amount_total: 2500, currency: "inr" };
    assert.doesNotThrow(() => validateCheckoutSession(booking, session));
    assert.throws(() => validateCheckoutSession(booking, { ...session, amount_total: 100 }), /amount or currency/);
    assert.throws(() => validateCheckoutSession(booking, { ...session, id: "cs_other" }), /ID does not match/);
});

test("Public OTP request accepts a valid email and reaches the business lookup", async () => {
    const original = User.findOne;
    User.findOne = async () => null;
    try {
        const response = await invoke(requestPublicBookingOtp, {
            params: { slug: "sample" },
            body: { customerEmail: "  Person@Example.com  " }
        });
        assert.equal(response.statusCode, 404);
        assert.equal(response.body.message, "Business not found");
    } finally {
        User.findOne = original;
    }
});

test("Provider registration rejects short passwords and malformed email", async () => {
    const shortPassword = await invoke(registerUser, {
        body: { name: "Provider", email: "provider@example.com", password: "123" }
    });
    assert.equal(shortPassword.statusCode, 400);

    const badEmail = await invoke(requestRegistrationOTP, {
        body: { email: "not-an-email" }
    });
    assert.equal(badEmail.statusCode, 400);
});

test("Public booking status requires an access token", async () => {
    const response = await invoke(getBookingStatus, {
        query: { booking_id: objectId }
    });
    assert.equal(response.statusCode, 400);
});

test("A booking ID alone cannot reveal guest details", async () => {
    const original = Booking.findOne;
    Booking.findOne = () => ({
        select: async () => ({
            _id: objectId,
            accessTokenHash: crypto.createHash("sha256").update("private-token").digest("hex")
        })
    });
    try {
        const response = await invoke(getBookingStatus, {
            query: { booking_id: objectId, access_token: "wrong-token" }
        });
        assert.equal(response.statusCode, 404);
    } finally {
        Booking.findOne = original;
    }
});

test("Invalid service duration cannot trap slot generation", async () => {
    const slots = await generateSlots({ userId: objectId, date: "2099-11-18", service: { duration: 0 } });
    assert.deepEqual(slots, []);
});

test("Availability times stay within a real day", () => {
    assert.equal(isValidTimeRange("09:00", "10:00"), true);
    assert.equal(isValidTimeRange("25:00", "26:00"), false);
    assert.equal(isValidTimeRange("10:00", "09:00"), false);
});

test("Confirmation email keeps the booked local calendar date", () => {
    const label = formatBookingDateTime({ date: "2099-11-18", startTime: "23:00", endTime: "23:30" });
    assert.match(label, /18 November 2099/);
    assert.match(label, /23:00-23:30/);
});

test("Service prices follow the INR Checkout amount range", () => {
    assert.equal(isValidServicePrice(0), true);
    assert.equal(isValidServicePrice(0.49), false);
    assert.equal(isValidServicePrice(0.5), true);
    assert.equal(isValidServicePrice(10.01), true);
    assert.equal(isValidServicePrice(10.001), false);
    assert.equal(isValidServicePrice(10_000_000), false);
});

test("Updating UPI payout details preserves an existing bank destination", async () => {
    const original = User.findById;
    const user = {
        payoutDetails: {
            accountHolderName: "Provider",
            bankName: "Example Bank",
            accountLast4: "4321",
            ifsc: "EXAM0001234",
            upiId: "old@bank",
            isComplete: true
        },
        async save() { return this; }
    };
    User.findById = () => ({ select: async () => user });
    try {
        const response = await invoke(updatePayoutDetails, {
            user: { id: objectId },
            body: { accountHolderName: "Provider", upiId: "new@bank" }
        });
        assert.equal(response.statusCode, 200);
        assert.equal(response.body.payoutDetails.upiId, "new@bank");
        assert.equal(response.body.payoutDetails.bankName, "Example Bank");
        assert.equal(response.body.payoutDetails.accountLast4, "4321");
        assert.equal(response.body.payoutDetails.ifsc, "EXAM0001234");
    } finally {
        User.findById = original;
    }
});

test("IP request limit returns 429 after its budget is used", async () => {
    const original = RateLimitBucket.findOneAndUpdate;
    let count = 0;
    RateLimitBucket.findOneAndUpdate = async () => ({ count: ++count });
    const limiter = rateLimit({ scope: "test", limit: 1, windowMs: 15 * 60 * 1000 });
    const res = {
        statusCode: 200,
        set() { return this; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
    try {
        let allowed = 0;
        await limiter({ ip: "127.0.0.1" }, res, () => { allowed += 1; });
        await limiter({ ip: "127.0.0.1" }, res, () => { allowed += 1; });
        assert.equal(allowed, 1);
        assert.equal(res.statusCode, 429);
    } finally {
        RateLimitBucket.findOneAndUpdate = original;
    }
});

test("Public booking rejects a time outside the service availability", async () => {
    const originals = {
        userFindOne: User.findOne,
        serviceFindOne: Service.findOne,
        availabilityFindOne: Availability.findOne,
        bookingFind: Booking.find
    };
    User.findOne = async () => ({ _id: objectId, timezone: "Asia/Kolkata" });
    Service.findOne = async () => ({ _id: serviceId, duration: 30, price: 0 });
    Availability.findOne = async () => ({ slots: [{ startTime: "09:00", endTime: "10:00" }] });
    Booking.find = async () => [];
    try {
        const response = await invoke(createPublicBooking, {
            params: { slug: "sample" },
            body: {
                serviceId,
                customerName: "Customer",
                customerEmail: "person@example.com",
                date: "2099-11-18",
                startTime: "11:00",
                endTime: "11:30",
                emailOtp: "123456"
            }
        });
        assert.equal(response.statusCode, 409);
        assert.match(response.body.message, /slot is no longer available/);
    } finally {
        User.findOne = originals.userFindOne;
        Service.findOne = originals.serviceFindOne;
        Availability.findOne = originals.availabilityFindOne;
        Booking.find = originals.bookingFind;
    }
});

test("Booking date lock serializes simultaneous writes", async () => {
    const originals = {
        findOneAndUpdate: BookingDateLock.findOneAndUpdate,
        updateOne: BookingDateLock.updateOne
    };
    let lockToken = "";
    let lockedUntil = new Date(0);
    BookingDateLock.findOneAndUpdate = async (query, update) => {
        if (lockedUntil > query.$or[0].lockedUntil.$lte) {
            throw Object.assign(new Error("Locked"), { code: 11000 });
        }
        lockToken = update.$set.lockToken;
        lockedUntil = update.$set.lockedUntil;
        return { lockToken };
    };
    BookingDateLock.updateOne = async (query) => {
        if (query.lockToken === lockToken) lockedUntil = new Date(0);
    };
    try {
        let active = 0;
        let maximumActive = 0;
        const work = async () => {
            active += 1;
            maximumActive = Math.max(maximumActive, active);
            await new Promise((resolve) => setTimeout(resolve, 110));
            active -= 1;
        };
        await Promise.all([
            withBookingDateLock({ userId: objectId, date: "2099-11-18", work }),
            withBookingDateLock({ userId: objectId, date: "2099-11-18", work })
        ]);
        assert.equal(maximumActive, 1);
    } finally {
        BookingDateLock.findOneAndUpdate = originals.findOneAndUpdate;
        BookingDateLock.updateOne = originals.updateOne;
    }
});

test("Stripe webhook rejects a bad signature and accepts a signed event", async () => {
    const priorKey = process.env.STRIPE_SECRET_KEY;
    const priorSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_placeholder";
    try {
        const payload = JSON.stringify({ id: "evt_test", type: "ping", data: { object: {} } });
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const signature = stripe.webhooks.generateTestHeaderString({
            payload,
            secret: process.env.STRIPE_WEBHOOK_SECRET
        });
        const signed = await invoke(receiveStripeWebhook, {
            body: Buffer.from(payload),
            headers: { "stripe-signature": signature }
        });
        assert.equal(signed.statusCode, 200);
        assert.equal(signed.body.received, true);

        const unsigned = await invoke(receiveStripeWebhook, {
            body: Buffer.from(payload),
            headers: { "stripe-signature": "bad" }
        });
        assert.equal(unsigned.statusCode, 400);
    } finally {
        if (priorKey === undefined) delete process.env.STRIPE_SECRET_KEY;
        else process.env.STRIPE_SECRET_KEY = priorKey;
        if (priorSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
        else process.env.STRIPE_WEBHOOK_SECRET = priorSecret;
    }
});

test("Refund webhook keeps pending refunds pending and marks successful refunds complete", async () => {
    const originals = { findById: Booking.findById, updateOne: Booking.updateOne };
    const booking = {
        _id: objectId,
        amount: 2500,
        currency: "inr",
        paymentStatus: "refund_pending",
        stripePaymentIntentId: "pi_test_123",
        stripeRefundId: "re_test_123"
    };
    Booking.findById = async () => booking;
    Booking.updateOne = async (_query, update) => {
        booking.paymentStatus = update.$set.paymentStatus;
    };
    const event = (status) => ({
        type: "refund.updated",
        data: { object: {
            id: "re_test_123",
            metadata: { bookingId: objectId },
            payment_intent: "pi_test_123",
            amount: 2500,
            currency: "inr",
            status
        } }
    });
    try {
        await handleCheckoutEvent({ event: event("pending"), stripe: null });
        assert.equal(booking.paymentStatus, "refund_pending");
        await handleCheckoutEvent({ event: event("succeeded"), stripe: null });
        assert.equal(booking.paymentStatus, "refunded");
    } finally {
        Booking.findById = originals.findById;
        Booking.updateOne = originals.updateOne;
    }
});

test("An external refund pauses provider withdrawals for manual review", async () => {
    const originals = {
        findOne: Booking.findOne,
        updateOne: Booking.updateOne,
        userUpdateOne: User.updateOne
    };
    let reviewRequired = false;
    let walletVersionUpdated = false;
    Booking.findOne = async () => ({
        _id: objectId,
        userId: objectId,
        paymentStatus: "paid",
        stripePaymentIntentId: "pi_test_123",
        stripeRefundId: ""
    });
    Booking.updateOne = async (_query, update) => {
        reviewRequired = update.$set.paymentReviewRequired;
    };
    User.updateOne = async () => { walletVersionUpdated = true; };
    try {
        await handleCheckoutEvent({
            event: {
                type: "refund.created",
                data: { object: {
                    id: "re_external",
                    metadata: {},
                    payment_intent: "pi_test_123",
                    status: "pending"
                } }
            },
            stripe: null
        });
        assert.equal(reviewRequired, true);
        assert.equal(walletVersionUpdated, true);
    } finally {
        Booking.findOne = originals.findOne;
        Booking.updateOne = originals.updateOne;
        User.updateOne = originals.userUpdateOne;
    }
});

test("A confirmed paid booking can repair a missing wallet credit", async () => {
    const originals = { create: WalletTransaction.create, updateOne: Booking.updateOne };
    let created = false;
    let recorded = false;
    WalletTransaction.create = async (transaction) => {
        created = transaction.type === "booking_payout" && transaction.amount === 2250;
        return transaction;
    };
    Booking.updateOne = async (_query, update) => {
        recorded = Boolean(update.$set.payoutRecordedAt);
    };
    try {
        await ensurePayoutRecorded({
            _id: objectId,
            userId: objectId,
            paymentStatus: "paid",
            providerPayoutAmount: 2250,
            currency: "inr"
        });
        assert.equal(created, true);
        assert.equal(recorded, true);
    } finally {
        WalletTransaction.create = originals.create;
        Booking.updateOne = originals.updateOne;
    }
});
