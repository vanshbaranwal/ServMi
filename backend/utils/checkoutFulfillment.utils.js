import { Booking } from "../models/booking.models.js";
import { Service } from "../models/service.models.js";
import { User } from "../models/user.models.js";
import { cancelBookingCalendarEvent, createBookingCalendarEvent } from "./googleCalendar.utils.js";
import { getEmailConfigStatus, sendBookingNotification } from "./bookingNotifications.utils.js";
import { timeOverlap } from "./overlap.utils.js";
import { createBookingPayoutTransaction } from "./wallet.utils.js";
import { withBookingDateLock } from "./bookingDateLock.utils.js";
import mongoose from "mongoose";
import { getStripe } from "./stripe.utils.js";

const sessionBookingId = (session) => session?.metadata?.bookingId;
const paymentIntentId = (session) => typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;

const markPaymentReview = async (booking, reason) => {
    await Booking.updateOne(
        { _id: booking._id, paymentReviewRequired: { $ne: true } },
        { $set: { paymentReviewRequired: true, paymentReviewReason: reason } }
    );
    await User.updateOne({ _id: booking.userId }, { $inc: { walletVersion: 1 } });
};

export const validateCheckoutSession = (booking, session) => {
    if (!booking || !session || sessionBookingId(session) !== String(booking._id)) {
        throw new Error("Checkout session does not match the booking");
    }
    if (booking.stripeSessionId && booking.stripeSessionId !== session.id) {
        throw new Error("Checkout session ID does not match the booking");
    }
    if (session.amount_total !== booking.amount || session.currency?.toLowerCase() !== booking.currency?.toLowerCase()) {
        throw new Error("Checkout session amount or currency does not match the booking");
    }
};

const attachSessionIfNeeded = async (booking, session) => {
    if (booking.stripeSessionId) return booking;

    await Booking.updateOne(
        { _id: booking._id, stripeSessionId: "" },
        { $set: { stripeSessionId: session.id } }
    );
    return Booking.findById(booking._id);
};

export const markCheckoutFailed = async ({ booking, session }) => {
    validateCheckoutSession(booking, session);
    return Booking.findOneAndUpdate(
        { _id: booking._id, status: "pending_payment", paymentStatus: "pending" },
        { $set: { status: "payment_failed", paymentStatus: "failed" } },
        { new: true }
    );
};

const refundUnfulfillablePayment = async ({ booking, session, stripe }) => {
    const paymentIntent = paymentIntentId(session);
    if (!paymentIntent) {
        throw new Error("Paid Checkout session has no payment intent to refund");
    }

    let refund;
    if (booking.stripeRefundId) {
        refund = await stripe.refunds.retrieve(booking.stripeRefundId);
    } else {
        const existing = await stripe.refunds.list({ payment_intent: paymentIntent, limit: 100 });
        refund = existing.data.find((candidate) =>
            candidate.metadata?.bookingId === String(booking._id)
        );
        if (!refund) {
            refund = await stripe.refunds.create(
                { payment_intent: paymentIntent, metadata: { bookingId: String(booking._id) } },
                { idempotencyKey: `booking-conflict-refund-${booking._id}` }
            );
        }
    }
    const paymentStatus = refund.status === "succeeded" ? "refunded"
        : ["failed", "canceled"].includes(refund.status) ? "refund_failed"
        : "refund_pending";
    await Booking.updateOne(
        { _id: booking._id, paymentStatus: "refund_pending" },
        { $set: { paymentStatus, stripeRefundId: refund.id, stripePaymentIntentId: paymentIntent } }
    );
    return Booking.findById(booking._id);
};

export const ensurePayoutRecorded = async (booking) => {
    if (booking.paymentStatus !== "paid" || booking.payoutRecordedAt) return;
    await createBookingPayoutTransaction({
        booking,
        description: `Booking payment from ${booking.customerName || "Customer"}`
    });
    await Booking.updateOne(
        { _id: booking._id, payoutRecordedAt: null },
        { $set: { payoutRecordedAt: new Date() } }
    );
};

const claimFulfillmentStep = (bookingId, doneField, leaseField) => {
    const now = new Date();
    return Booking.findOneAndUpdate(
        {
            _id: bookingId,
            status: "confirmed",
            [doneField]: null,
            $or: [
                { [leaseField]: null },
                { [leaseField]: { $lte: now } }
            ]
        },
        { $set: { [leaseField]: new Date(now.getTime() + 2 * 60 * 1000) } },
        { new: true }
    );
};

const releaseFulfillmentStep = (claimed, leaseField) => Booking.updateOne(
    { _id: claimed._id, [leaseField]: claimed[leaseField] },
    { $set: { [leaseField]: new Date(0) } }
);

const syncBookingCalendar = async ({ booking, business, service }) => {
    const leaseField = "calendarSyncLeaseUntil";
    const claimed = await claimFulfillmentStep(booking._id, "calendarSyncedAt", leaseField);
    if (!claimed) return;
    try {
        const result = await createBookingCalendarEvent({ business, service, booking: claimed });
        const saved = await Booking.updateOne(
            { _id: claimed._id, status: "confirmed", [leaseField]: claimed[leaseField] },
            { $set: {
                googleEventId: result.googleEventId || claimed.googleEventId || "",
                customerCalendarUrl: result.customerCalendarUrl || claimed.customerCalendarUrl,
                calendarSyncedAt: new Date(),
                [leaseField]: new Date(0)
            } }
        );
        if (saved.matchedCount === 0) {
            const current = await Booking.findById(claimed._id);
            if (current?.status === "cancelled" && result.googleEventId) {
                await cancelBookingCalendarEvent({
                    business,
                    booking: {
                        _id: claimed._id,
                        fulfillmentVersion: claimed.fulfillmentVersion,
                        googleEventId: result.googleEventId
                    }
                });
            }
        }
    } catch (error) {
        console.error(`Booking ${booking._id} calendar creation failed:`, error);
        const current = await Booking.findById(claimed._id);
        if (current?.status === "cancelled") {
            try {
                await cancelBookingCalendarEvent({ business, booking: current });
            } catch (cancelError) {
                console.error(`Booking ${booking._id} calendar cleanup failed:`, cancelError);
            }
        }
        await releaseFulfillmentStep(claimed, leaseField);
    }
};

const sendConfirmationEmail = async ({ booking, business, service, recipientType }) => {
    const customer = recipientType === "customer";
    const doneField = customer ? "confirmationCustomerEmailSentAt" : "confirmationProviderEmailSentAt";
    const leaseField = customer ? "confirmationCustomerEmailLeaseUntil" : "confirmationProviderEmailLeaseUntil";
    const claimed = await claimFulfillmentStep(booking._id, doneField, leaseField);
    if (!claimed) return;
    try {
        const current = await Booking.findById(claimed._id);
        if (current?.status !== "confirmed") {
            await releaseFulfillmentStep(claimed, leaseField);
            return;
        }
        const result = await sendBookingNotification({
            business, service, booking: current, type: "confirmed", recipientType
        });
        if (result.skipped) {
            await releaseFulfillmentStep(claimed, leaseField);
            return;
        }
        await Booking.updateOne(
            { _id: claimed._id, [leaseField]: claimed[leaseField] },
            { $set: { [doneField]: new Date(), [leaseField]: new Date(0) } }
        );
    } catch (error) {
        console.error(`Booking ${booking._id} ${recipientType} email failed:`, error);
        await releaseFulfillmentStep(claimed, leaseField);
    }
};

export const fulfillConfirmedBooking = async (booking) => {
    if (booking.status !== "confirmed") return booking;
    await ensurePayoutRecorded(booking);
    if (booking.fulfillmentVersion !== 1) return booking;

    const [business, service] = await Promise.all([
        User.findById(booking.userId),
        Service.findById(booking.serviceId)
    ]);
    if (!business || !service) {
        console.error(`Booking ${booking._id} was confirmed but its business or service is missing`);
        return booking;
    }

    await syncBookingCalendar({ booking, business, service });
    if (getEmailConfigStatus().configured) {
        await sendConfirmationEmail({ booking, business, service, recipientType: "customer" });
        await sendConfirmationEmail({ booking, business, service, recipientType: "provider" });
    }
    return Booking.findById(booking._id);
};

export const repairMissingFulfillment = async () => {
    const needsWork = [
        { paymentStatus: "paid", payoutRecordedAt: null },
        { calendarSyncedAt: null }
    ];
    if (getEmailConfigStatus().configured) {
        needsWork.push({ confirmationCustomerEmailSentAt: null });
        needsWork.push({ confirmationProviderEmailSentAt: null });
    }
    const bookings = Booking.find({
        fulfillmentVersion: 1,
        status: "confirmed",
        paymentStatus: { $in: ["paid", "not_required"] },
        $or: needsWork
    }).cursor();
    for await (const booking of bookings) {
        try {
            await fulfillConfirmedBooking(booking);
        } catch (error) {
            console.error(`Booking ${booking._id} fulfillment repair failed:`, error);
        }
    }
};

export const repairPendingRefunds = async () => {
    const stripe = getStripe();
    if (!stripe) return;
    const bookings = Booking.find({
        paymentStatus: "refund_pending",
        stripeSessionId: { $ne: "" }
    }).cursor();
    for await (const booking of bookings) {
        try {
            const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId);
            validateCheckoutSession(booking, session);
            if (session.payment_status === "paid") {
                await confirmPaidCheckout({ session, stripe });
            }
        } catch (error) {
            console.error(`Booking ${booking._id} refund repair failed:`, error);
        }
    }
};

export const confirmPaidCheckout = async ({ session, stripe }) => {
    const bookingId = sessionBookingId(session);
    if (!bookingId) return null;

    let booking = await Booking.findById(bookingId);
    if (!booking) return null;
    validateCheckoutSession(booking, session);
    if (session.payment_status !== "paid") return booking;
    const paymentIntent = paymentIntentId(session);
    if (!paymentIntent) throw new Error("Paid Checkout session has no payment intent");

    booking = await attachSessionIfNeeded(booking, session);
    validateCheckoutSession(booking, session);

    if (booking.paymentStatus === "refunded") return booking;
    if (booking.paymentStatus === "refund_pending") {
        return refundUnfulfillablePayment({ booking, session, stripe });
    }

    const result = await withBookingDateLock({
        userId: booking.userId,
        date: booking.date,
        work: async () => {
            const current = await Booking.findById(booking._id);
            validateCheckoutSession(current, session);
            if (current.paymentStatus === "refunded" || current.paymentStatus === "refund_pending") {
                return { booking: current };
            }
            if (current.status === "confirmed" && current.paymentStatus === "paid") {
                return { booking: current };
            }

            const now = new Date();
            const activeBookings = await Booking.find({
                _id: { $ne: current._id },
                userId: current.userId,
                date: current.date,
                $or: [
                    { status: "confirmed" },
                    {
                        status: "pending_payment",
                        $or: [
                            { holdExpiresAt: { $gt: now } },
                            {
                                holdExpiresAt: { $exists: false },
                                createdAt: { $gte: new Date(now.getTime() - 30 * 60 * 1000) }
                            }
                        ]
                    }
                ]
            });
            const currentHoldValid = current.holdExpiresAt
                ? current.holdExpiresAt > now
                : current.createdAt >= new Date(now.getTime() - 30 * 60 * 1000);
            const hasConflict = activeBookings.some((candidate) =>
                timeOverlap(current.startTime, current.endTime, candidate.startTime, candidate.endTime)
                && (candidate.status === "confirmed" || !currentHoldValid
                    || candidate.createdAt < current.createdAt
                    || (candidate.createdAt.getTime() === current.createdAt.getTime()
                        && String(candidate._id) < String(current._id)))
            );
            if (hasConflict || current.status !== "pending_payment" || current.paymentStatus !== "pending") {
                const refundBooking = await Booking.findOneAndUpdate(
                    { _id: current._id, paymentStatus: { $in: ["pending", "failed"] } },
                    { $set: {
                        status: "payment_failed",
                        paymentStatus: "refund_pending",
                        stripePaymentIntentId: paymentIntent
                    } },
                    { new: true }
                );
                return { booking: refundBooking || await Booking.findById(current._id) };
            }

            const confirmed = await Booking.findOneAndUpdate(
                { _id: current._id, status: "pending_payment", paymentStatus: "pending" },
                { $set: {
                    status: "confirmed",
                    paymentStatus: "paid",
                    stripePaymentIntentId: paymentIntent,
                    payoutStatus: current.providerPayoutAmount > 0 ? "available" : "not_required"
                } },
                { new: true }
            );
            return { booking: confirmed || await Booking.findById(current._id), claimed: Boolean(confirmed) };
        }
    });

    if (result.booking.paymentStatus === "refund_pending") {
        return refundUnfulfillablePayment({ booking: result.booking, session, stripe });
    }
    if (result.booking.paymentStatus === "paid") {
        return fulfillConfirmedBooking(result.booking);
    }
    return result.booking;
};

export const handleCheckoutEvent = async ({ event, stripe }) => {
    if (["refund.created", "refund.updated", "refund.failed"].includes(event.type)) {
        const refund = event.data.object;
        const bookingId = refund.metadata?.bookingId;
        const intentId = typeof refund.payment_intent === "string"
            ? refund.payment_intent : refund.payment_intent?.id;
        let booking = mongoose.isValidObjectId(bookingId) ? await Booking.findById(bookingId) : null;
        if (!booking && intentId) booking = await Booking.findOne({ stripePaymentIntentId: intentId });
        if (!booking) return;

        const managedRefund = booking.paymentStatus === "refund_pending"
            && (!booking.stripeRefundId || booking.stripeRefundId === refund.id)
            && booking.amount === refund.amount
            && booking.currency?.toLowerCase() === refund.currency?.toLowerCase()
            && booking.stripePaymentIntentId === intentId;
        if (managedRefund) {
            const paymentStatus = refund.status === "succeeded" ? "refunded"
                : ["failed", "canceled"].includes(refund.status) ? "refund_failed"
                : "refund_pending";
            await Booking.updateOne(
                { _id: booking._id, paymentStatus: "refund_pending" },
                { $set: { paymentStatus, stripeRefundId: refund.id } }
            );
        } else if (booking.stripeRefundId !== refund.id) {
            await markPaymentReview(booking, "external_refund");
        }
        return;
    }

    if (["charge.dispute.created", "charge.dispute.funds_withdrawn", "charge.dispute.closed"].includes(event.type)) {
        const dispute = event.data.object;
        let intentId = typeof dispute.payment_intent === "string"
            ? dispute.payment_intent : dispute.payment_intent?.id;
        if (!intentId && dispute.charge) {
            const charge = await stripe.charges.retrieve(dispute.charge);
            intentId = typeof charge.payment_intent === "string"
                ? charge.payment_intent : charge.payment_intent?.id;
        }
        if (!intentId) return;
        const booking = await Booking.findOne({ stripePaymentIntentId: intentId });
        if (booking) await markPaymentReview(booking, "stripe_dispute");
        return;
    }

    const supported = [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.async_payment_failed",
        "checkout.session.expired"
    ];
    if (!supported.includes(event.type)) return;

    const session = event.data.object;
    const bookingId = sessionBookingId(session);
    if (!bookingId) return;

    const booking = await Booking.findById(bookingId);
    if (!booking) return;
    validateCheckoutSession(booking, session);

    if (session.payment_status === "paid") {
        await confirmPaidCheckout({ session, stripe });
    } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
        await markCheckoutFailed({ booking, session });
    }
};
