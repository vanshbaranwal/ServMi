import crypto from "node:crypto";
import mongoose from "mongoose";
import { Booking } from "../models/booking.models.js";
import { Service } from "../models/service.models.js";
import { User } from "../models/user.models.js";
import { buildCustomerCalendarUrl } from "../utils/calendarLink.utils.js";
import { requestEmailOtp, verifyEmailOtp } from "../utils/emailOtp.utils.js";
import { generateSlots } from "../utils/slotGenerator.utils.js";
import { getStripe, isValidServicePrice, toStripeAmount } from "../utils/stripe.utils.js";
import { calculatePlatformSplit } from "../utils/money.utils.js";
import { confirmPaidCheckout, fulfillConfirmedBooking, markCheckoutFailed, validateCheckoutSession } from "../utils/checkoutFulfillment.utils.js";
import { withBookingDateLock } from "../utils/bookingDateLock.utils.js";

const CHECKOUT_MINUTES = 32;
const HOLD_MINUTES = 35;
const normalizeEmail = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isTime = (value) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const timeInMinutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
const isDate = (value) => typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const errorResponse = (res, status, message) => res.status(status).json({ success: false, message });

const getBusinessBySlug = (slug) => User.findOne({ slug });

const toPublicBusiness = (business) => ({
    id: business._id,
    name: business.name,
    slug: business.slug,
    businessName: business.businessName,
    businessDescription: business.businessDescription,
    brandTheme: business.brandTheme,
    brandAccent: business.brandAccent,
    timezone: business.timezone,
    googleCalendarConnected: business.googleCalendarConnected,
    paymentsAvailable: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
});

const toPublicBooking = (booking) => ({
    _id: booking._id,
    serviceId: booking.serviceId,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerAvatar: booking.customerAvatar,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    notes: booking.notes,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    paymentReviewRequired: booking.paymentReviewRequired,
    amount: booking.amount,
    currency: booking.currency,
    customerCalendarUrl: booking.customerCalendarUrl,
    createdAt: booking.createdAt
});

const createAccessToken = () => crypto.randomBytes(32).toString("base64url");
const hashAccessToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const hasAccess = (booking, token) => {
    if (typeof token !== "string" || !booking.accessTokenHash) return false;
    const expected = Buffer.from(booking.accessTokenHash, "hex");
    const actual = Buffer.from(hashAccessToken(token), "hex");
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

const businessClock = (business) => {
    const format = (timeZone) => new Intl.DateTimeFormat("en-GB", {
        timeZone,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date());
    let parts;
    try {
        parts = format(business.timezone || "Asia/Kolkata");
    } catch {
        parts = format("Asia/Kolkata");
    }
    const part = (type) => parts.find((entry) => entry.type === type)?.value;
    return {
        date: `${part("year")}-${part("month")}-${part("day")}`,
        minute: Number(part("hour")) * 60 + Number(part("minute"))
    };
};

const isFutureSlot = ({ date, startTime, clock }) =>
    date > clock.date || (date === clock.date && timeInMinutes(startTime) > clock.minute);

export const getPublicBusiness = async (req, res) => {
    try {
        const business = await getBusinessBySlug(req.params.slug);
        if (!business) return errorResponse(res, 404, "Business not found");

        const services = await Service.find({
            userId: business._id,
            isActive: true,
            isDeleted: { $ne: true }
        }).sort({ name: 1 });
        return res.json({ business: toPublicBusiness(business), services: services.filter((service) => isValidServicePrice(service.price)) });
    } catch (error) {
        console.error("Public business lookup failed:", error);
        return errorResponse(res, 500, "Server error");
    }
};

export const getPublicSlots = async (req, res) => {
    try {
        const { date, serviceId } = req.query;
        if (!isDate(date) || !mongoose.isValidObjectId(serviceId)) {
            return errorResponse(res, 400, "Valid date and serviceId are required");
        }

        const business = await getBusinessBySlug(req.params.slug);
        if (!business) return errorResponse(res, 404, "Business not found");

        const service = await Service.findOne({
            _id: serviceId,
            userId: business._id,
            isActive: true,
            isDeleted: { $ne: true }
        });
        if (!service) return errorResponse(res, 404, "Service not found");
        if (!isValidServicePrice(service.price)) return errorResponse(res, 409, "Service price needs to be updated");

        const clock = businessClock(business);
        if (date < clock.date) return res.json({ slots: [] });
        const slots = await generateSlots({ userId: business._id, service, date });
        return res.json({ slots: slots.filter((slot) => isFutureSlot({ date, startTime: slot.startTime, clock })) });
    } catch (error) {
        console.error("Public slots lookup failed:", error);
        return errorResponse(res, 500, "Server error");
    }
};

export const requestPublicBookingOtp = async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.customerEmail);
        if (!isEmail(email)) return errorResponse(res, 400, "Valid customer email is required");

        const business = await getBusinessBySlug(req.params.slug);
        if (!business) return errorResponse(res, 404, "Business not found");

        const result = await requestEmailOtp({ email, purpose: "booking" });
        return res.json({ success: true, message: "Verification code sent", result });
    } catch (error) {
        console.error("Public booking OTP request failed:", error);
        if (error.statusCode === 429) return errorResponse(res, 429, error.message);
        return errorResponse(res, 503, "Unable to send verification code right now");
    }
};

export const verifyPublicBookingOtp = async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.customerEmail);
        const code = req.body?.emailOtp;
        if (!isEmail(email) || !code) {
            return errorResponse(res, 400, "Valid customer email and emailOtp are required");
        }

        const business = await getBusinessBySlug(req.params.slug);
        if (!business) return errorResponse(res, 404, "Business not found");

        const result = await verifyEmailOtp({ email, purpose: "booking", code, consume: false });
        if (!result.verified) return errorResponse(res, 400, result.reason || "Invalid verification code");
        return res.json({ success: true, message: "Email verified" });
    } catch (error) {
        console.error("Public booking OTP verification failed:", error);
        return errorResponse(res, 500, "Server error");
    }
};

export const createPublicBooking = async (req, res) => {
    try {
        const {
            serviceId, customerName, customerEmail, customerAvatar,
            date, startTime, endTime, notes, emailOtp
        } = req.body || {};
        const email = normalizeEmail(customerEmail);
        if (!mongoose.isValidObjectId(serviceId) || typeof customerName !== "string" || !customerName.trim()
            || !isEmail(email) || !isDate(date) || !isTime(startTime) || !isTime(endTime)
            || !emailOtp || timeInMinutes(startTime) >= timeInMinutes(endTime)) {
            return errorResponse(res, 400, "Valid booking details and emailOtp are required");
        }

        const business = await getBusinessBySlug(req.params.slug);
        if (!business) return errorResponse(res, 404, "Business not found");

        const service = await Service.findOne({
            _id: serviceId,
            userId: business._id,
            isActive: true,
            isDeleted: { $ne: true }
        });
        if (!service) return errorResponse(res, 404, "Service not found");
        if (!isValidServicePrice(service.price)) return errorResponse(res, 409, "Service price needs to be updated");

        const clock = businessClock(business);
        if (date < clock.date || !isFutureSlot({ date, startTime, clock })) {
            return errorResponse(res, 400, "Choose a future date and time");
        }

        const slots = await generateSlots({ userId: business._id, service, date });
        if (!slots.some((slot) => slot.startTime === startTime && slot.endTime === endTime)) {
            return errorResponse(res, 409, "That slot is no longer available");
        }

        const amount = toStripeAmount(service.price);
        if (!Number.isSafeInteger(amount) || amount < 0) {
            return errorResponse(res, 500, "Service price is invalid");
        }
        const stripe = amount > 0 ? getStripe() : null;
        if (amount > 0 && (!stripe || !process.env.STRIPE_WEBHOOK_SECRET)) {
            return errorResponse(res, 503, "Payments are not configured yet");
        }

        const accessToken = createAccessToken();
        const { platformFeeAmount, providerPayoutAmount } = calculatePlatformSplit(amount);
        const customerCalendarUrl = buildCustomerCalendarUrl({
            business, service,
            booking: { date, startTime, endTime, customerName: customerName.trim(), customerEmail: email, notes }
        });
        const bookingDetails = {
            userId: business._id,
            serviceId,
            customerName: customerName.trim(),
            customerEmail: email,
            customerAvatar: typeof customerAvatar === "string" && customerAvatar ? customerAvatar : "A1.png",
            date, startTime, endTime,
            notes: typeof notes === "string" ? notes : "",
            amount, platformFeeAmount, providerPayoutAmount,
            payoutStatus: amount > 0 ? "pending" : "not_required",
            currency: "inr",
            paymentStatus: amount > 0 ? "pending" : "not_required",
            status: amount > 0 ? "pending_payment" : "confirmed",
            holdExpiresAt: amount > 0 ? new Date(Date.now() + HOLD_MINUTES * 60 * 1000) : undefined,
            accessTokenHash: hashAccessToken(accessToken),
            fulfillmentVersion: 1,
            customerCalendarUrl
        };
        const booking = await withBookingDateLock({
            userId: business._id,
            date,
            work: async () => {
                const freshSlots = await generateSlots({ userId: business._id, service, date });
                if (!freshSlots.some((slot) => slot.startTime === startTime && slot.endTime === endTime)) {
                    return null;
                }
                const otpResult = await verifyEmailOtp({
                    email, purpose: "booking", code: emailOtp, consume: true
                });
                if (!otpResult.verified) {
                    const error = new Error(otpResult.reason || "Email verification is required");
                    error.statusCode = 400;
                    throw error;
                }
                return Booking.create(bookingDetails);
            }
        });
        if (!booking) return errorResponse(res, 409, "That slot is no longer available");

        if (amount === 0) {
            let confirmed = booking;
            try {
                confirmed = await fulfillConfirmedBooking(booking);
            } catch (error) {
                console.error(`Booking ${booking._id} fulfillment failed:`, error);
            }
            return res.status(201).json({
                success: true,
                message: "Booking confirmed",
                booking: toPublicBooking(confirmed),
                accessToken
            });
        }

        let session;
        try {
            const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");
            const redirectParams = `slug=${encodeURIComponent(business.slug)}&access_token=${encodeURIComponent(accessToken)}`;
            session = await stripe.checkout.sessions.create({
                mode: "payment",
                payment_method_types: ["card"],
                customer_email: email,
                expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_MINUTES * 60,
                line_items: [{
                    quantity: 1,
                    price_data: {
                        currency: "inr",
                        unit_amount: amount,
                        product_data: { name: service.name, description: `${date} ${startTime}-${endTime}` }
                    }
                }],
                metadata: { bookingId: String(booking._id) },
                success_url: `${clientUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}&${redirectParams}`,
                cancel_url: `${clientUrl}/booking/cancelled?booking_id=${booking._id}&${redirectParams}`
            }, { idempotencyKey: `booking-checkout-${booking._id}` });

            booking.stripeSessionId = session.id;
            booking.holdExpiresAt = new Date((session.expires_at + 3 * 60) * 1000);
            await booking.save();
        } catch (error) {
            if (session) {
                try {
                    await stripe.checkout.sessions.expire(session.id);
                    await Booking.updateOne(
                        { _id: booking._id, status: "pending_payment" },
                        { $set: { status: "payment_failed", paymentStatus: "failed" } }
                    );
                } catch (expiryError) {
                    console.error(`Could not expire Checkout session ${session.id}:`, expiryError);
                }
            } else {
                await Booking.updateOne(
                    { _id: booking._id, status: "pending_payment" },
                    { $set: { status: "payment_failed", paymentStatus: "failed" } }
                );
            }
            throw error;
        }

        return res.status(201).json({
            success: true,
            message: "Continue to payment",
            bookingId: booking._id,
            checkoutUrl: session.url,
            accessToken
        });
    } catch (error) {
        console.error("Public booking creation failed:", error);
        if (error.statusCode === 400 || error.statusCode === 503) {
            return errorResponse(res, error.statusCode, error.message);
        }
        return errorResponse(res, 500, "Unable to create booking right now");
    }
};

export const getBookingStatus = async (req, res) => {
    try {
        const { session_id: sessionId, booking_id: bookingId } = req.query;
        const accessToken = req.get?.("X-Booking-Access-Token") || req.query.access_token;
        if ((Boolean(sessionId) === Boolean(bookingId)) || !accessToken
            || (bookingId && !mongoose.isValidObjectId(bookingId))) {
            return errorResponse(res, 400, "One booking identifier and an access token are required");
        }

        const booking = await Booking.findOne(sessionId
            ? { stripeSessionId: sessionId }
            : { _id: bookingId }
        ).select("+accessTokenHash");
        if (!booking || !hasAccess(booking, accessToken)) {
            return errorResponse(res, 404, "Booking not found");
        }

        if (["pending", "failed", "refund_pending"].includes(booking.paymentStatus) && booking.stripeSessionId) {
            const stripe = getStripe();
            if (!stripe) return errorResponse(res, 503, "Payments are not configured yet");
            const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId);
            validateCheckoutSession(booking, session);

            if (session.payment_status === "paid") {
                await confirmPaidCheckout({ session, stripe });
            } else if (session.status === "expired") {
                await markCheckoutFailed({ booking, session });
            }
        } else if (booking.status === "confirmed" && booking.paymentStatus === "paid") {
            try {
                await fulfillConfirmedBooking(booking);
            } catch (error) {
                console.error(`Booking ${booking._id} fulfillment repair failed:`, error);
            }
        }

        const current = await Booking.findById(booking._id).populate("serviceId", "name duration price");
        return res.json({ success: true, booking: toPublicBooking(current) });
    } catch (error) {
        console.error("Public booking status failed:", error);
        return errorResponse(res, 503, "Booking status is temporarily unavailable");
    }
};

export const cancelPublicBookingPayment = async (req, res) => {
    try {
        const { booking_id: bookingId, access_token: accessToken } = req.body || {};
        if (!mongoose.isValidObjectId(bookingId) || !accessToken) {
            return errorResponse(res, 400, "booking_id and access_token are required");
        }

        const booking = await Booking.findById(bookingId).select("+accessTokenHash");
        if (!booking || !hasAccess(booking, accessToken)) {
            return errorResponse(res, 404, "Booking not found");
        }
        if (["refund_pending", "refunded", "refund_failed"].includes(booking.paymentStatus)) {
            return errorResponse(res, 409, "This payment is in the refund process and cannot be cancelled here");
        }
        if (booking.status === "payment_failed") {
            return res.json({ success: true, message: "Payment was not completed", booking: toPublicBooking(booking) });
        }
        if (booking.status !== "pending_payment") {
            return errorResponse(res, 409, "This booking cannot be cancelled through Checkout");
        }
        if (!booking.stripeSessionId) {
            return errorResponse(res, 409, "Checkout is still being prepared; try again shortly");
        }

        const stripe = getStripe();
        if (!stripe) return errorResponse(res, 503, "Payments are not configured yet");
        let session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId);
        validateCheckoutSession(booking, session);

        if (session.status === "open") {
            try {
                session = await stripe.checkout.sessions.expire(session.id);
            } catch (error) {
                session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId);
                if (session.status === "open") throw error;
            }
            validateCheckoutSession(booking, session);
        }

        if (session.payment_status === "paid") {
            await confirmPaidCheckout({ session, stripe });
            return errorResponse(res, 409, "Payment has completed; this booking cannot be cancelled through Checkout");
        }
        if (session.status !== "expired") {
            return errorResponse(res, 409, "Payment is processing; check booking status shortly");
        }

        await markCheckoutFailed({ booking, session });
        const current = await Booking.findById(booking._id);
        return res.json({ success: true, message: "Payment was not completed", booking: toPublicBooking(current) });
    } catch (error) {
        console.error("Public Checkout cancellation failed:", error);
        return errorResponse(res, 503, "Unable to cancel payment right now");
    }
};
