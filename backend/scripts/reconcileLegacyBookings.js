import "dotenv/config";
import mongoose from "mongoose";
import { Booking } from "../models/booking.models.js";
import { BookingDateLock } from "../models/bookingDateLock.models.js";
import { WalletTransaction } from "../models/walletTransaction.models.js";
import { Withdrawal } from "../models/withdrawal.models.js";
import { User } from "../models/user.models.js";
import { confirmPaidCheckout, ensurePayoutRecorded, markCheckoutFailed } from "../utils/checkoutFulfillment.utils.js";
import { calculatePlatformSplit } from "../utils/money.utils.js";
import { timeOverlap } from "../utils/overlap.utils.js";
import { getStripe } from "../utils/stripe.utils.js";

// A dry run must not let Mongoose create collections or indexes on connection.
mongoose.set("autoCreate", false);
mongoose.set("autoIndex", false);

const usage = `Usage: node scripts/reconcileLegacyBookings.js [--apply]

Default: inspect legacy Checkout bookings and report proposed actions without writes.
--apply: recheck each candidate against Stripe and apply only safe repairs.
Run from backend/ with MONGO_URL and STRIPE_SECRET_KEY configured.`;

const legacyFilter = {
    stripeSessionId: { $type: "string", $ne: "" },
    $or: [{ fulfillmentVersion: 0 }, { fulfillmentVersion: { $exists: false } }]
};

const log = (record) => console.log(JSON.stringify(record));
const paymentIntentId = (session) => typeof session.payment_intent === "string"
    ? session.payment_intent : session.payment_intent?.id;
const sameCurrency = (a, b) => typeof a === "string" && typeof b === "string"
    && a.toLowerCase() === b.toLowerCase();
const manual = (reason) => ({ category: "manual_review", reason });

const isFutureLegacySlot = async (booking) => {
    const business = await User.findById(booking.userId).select("timezone").lean();
    if (!business || !/^\d{4}-\d{2}-\d{2}$/.test(booking.date)
        || !/^([01]\d|2[0-3]):[0-5]\d$/.test(booking.startTime)) return false;
    try {
        const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: business.timezone || "Asia/Kolkata",
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", hourCycle: "h23"
        }).formatToParts(new Date());
        const part = (type) => parts.find((entry) => entry.type === type)?.value;
        const localDate = `${part("year")}-${part("month")}-${part("day")}`;
        const localTime = `${part("hour")}:${part("minute")}`;
        return booking.date > localDate
            || (booking.date === localDate && booking.startTime > localTime);
    } catch {
        return false;
    }
};

const hasUnbackedPaidWithdrawal = async (userId) => {
    const paidWithdrawals = await Withdrawal.find({ userId, status: "paid" })
        .select("_id amount").lean();
    for (const withdrawal of paidWithdrawals) {
        // Legacy rows used both misspelled field and type names. The raw read keeps
        // those records visible despite the corrected Mongoose schema enum.
        const hold = await WalletTransaction.collection.findOne({
            userId,
            $or: [
                { withdrawalId: withdrawal._id },
                { withdrawlId: withdrawal._id }
            ],
            type: { $in: ["withdrawal_hold", "withdrawl_hold"] }
        });
        if (!hold || Number(hold.amount) !== withdrawal.amount) return true;
    }
    return false;
};

const hasConflictingBooking = async (booking) => {
    const now = new Date();
    const active = await Booking.find({
        _id: { $ne: booking._id },
        userId: booking.userId,
        date: booking.date,
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
    }).select("status startTime endTime createdAt");

    const ownHoldValid = booking.holdExpiresAt
        ? booking.holdExpiresAt > now
        : booking.createdAt >= new Date(now.getTime() - 30 * 60 * 1000);
    return active.some((candidate) => timeOverlap(
        booking.startTime, booking.endTime, candidate.startTime, candidate.endTime
    ) && (candidate.status === "confirmed" || !ownHoldValid
        || candidate.createdAt < booking.createdAt
        || (candidate.createdAt.getTime() === booking.createdAt.getTime()
            && String(candidate._id) < String(booking._id))));
};

const hasConfirmedConflict = async (booking) => {
    const confirmed = await Booking.find({
        _id: { $ne: booking._id },
        userId: booking.userId,
        date: booking.date,
        status: "confirmed"
    }).select("startTime endTime");
    return confirmed.some((candidate) => timeOverlap(
        booking.startTime, booking.endTime, candidate.startTime, candidate.endTime
    ));
};

const inspect = async ({ booking, stripe }) => {
    const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId);
    if (session.id !== booking.stripeSessionId
        || session.metadata?.bookingId !== String(booking._id)
        || session.amount_total !== booking.amount
        || !sameCurrency(session.currency, booking.currency)) {
        return manual("checkout_session_mismatch");
    }

    const intentId = paymentIntentId(session);
    if (session.payment_status === "unpaid") {
        if (session.status !== "expired") {
            return booking.status === "pending_payment" && booking.paymentStatus === "pending"
                ? { category: "awaiting_payment" }
                : manual("unpaid_open_session_local_state_mismatch");
        }
        const unexpectedCredit = await WalletTransaction.exists({
            bookingId: booking._id, type: "booking_payout"
        });
        if (unexpectedCredit) return manual("unpaid_session_has_payout_credit");
        if (intentId) {
            const intent = await stripe.paymentIntents.retrieve(intentId);
            if (intent.status === "succeeded" || Number(intent.amount_received) > 0) {
                return manual("expired_session_has_received_payment");
            }
        }
        if (booking.status === "pending_payment" && booking.paymentStatus === "pending") {
            return { category: "unpaid_expired", session };
        }
        if (booking.status === "payment_failed" && booking.paymentStatus === "failed") {
            return { category: "already_failed" };
        }
        return manual("unpaid_session_local_state_mismatch");
    }
    if (session.payment_status !== "paid" || session.status !== "complete" || !intentId) {
        return manual("ambiguous_checkout_payment_state");
    }

    const intent = await stripe.paymentIntents.retrieve(intentId);
    if (intent.id !== intentId || intent.status !== "succeeded"
        || intent.amount_received !== booking.amount
        || !sameCurrency(intent.currency, booking.currency)) {
        return manual("payment_intent_mismatch");
    }

    const [refunds, disputes] = await Promise.all([
        stripe.refunds.list({ payment_intent: intentId, limit: 1 }),
        stripe.disputes.list({ payment_intent: intentId, limit: 1 })
    ]);
    if (refunds.data.length > 0 || disputes.data.length > 0) {
        return {
            ...manual(refunds.data.length > 0 && disputes.data.length > 0
                ? "refund_and_dispute_present"
                : refunds.data.length > 0 ? "refund_present" : "dispute_present"),
            ...(refunds.data[0] && { refundStatus: refunds.data[0].status }),
            ...(disputes.data[0] && { disputeStatus: disputes.data[0].status })
        };
    }

    const { platformFeeAmount, providerPayoutAmount } = calculatePlatformSplit(booking.amount);
    if (!Number.isSafeInteger(booking.amount) || booking.amount <= 0
        || booking.platformFeeAmount !== platformFeeAmount
        || booking.providerPayoutAmount !== providerPayoutAmount
        || providerPayoutAmount <= 0) {
        return manual("booking_payout_amount_mismatch");
    }

    const credits = await WalletTransaction.find({
        bookingId: booking._id, type: "booking_payout"
    }).limit(2).lean();
    if (credits.length > 1 || (credits.length === 1 && (
        String(credits[0].userId) !== String(booking.userId)
        || credits[0].amount !== providerPayoutAmount
        || !sameCurrency(credits[0].currency, booking.currency)
    ))) {
        return manual("booking_payout_ledger_mismatch");
    }
    if (credits.length === 0) {
        if (booking.payoutRecordedAt) return manual("payout_marker_without_credit");
        const orphanPayout = await WalletTransaction.exists({
            userId: booking.userId, type: "booking_payout", bookingId: null
        });
        if (orphanPayout || await hasUnbackedPaidWithdrawal(booking.userId)) {
            return manual("provider_legacy_ledger_ambiguity");
        }
    }

    if (booking.status === "confirmed" && booking.paymentStatus === "paid") {
        if (credits.length === 1) return { category: "paid_and_credited" };
        if (await hasConfirmedConflict(booking)) return manual("confirmed_booking_slot_conflict");
        return { category: "missing_payout_credit", session };
    }
    if (credits.length > 0) return manual("unconfirmed_booking_has_payout_credit");
    if (booking.status === "payment_failed" && booking.paymentStatus === "failed") {
        return { category: "paid_local_failed", session };
    }
    if (booking.status === "pending_payment" && booking.paymentStatus === "pending") {
        if (!await isFutureLegacySlot(booking)) return manual("paid_pending_slot_not_future");
        if (await hasConflictingBooking(booking)) return manual("paid_pending_slot_conflict");
        return { category: "paid_pending_no_conflict", session };
    }
    return manual("paid_session_local_state_mismatch");
};

const requireIndexesForApply = async () => {
    const [walletIndexes, lockIndexes] = await Promise.all([
        WalletTransaction.collection.indexes(), BookingDateLock.collection.indexes()
    ]);
    const exactUnique = (indexes, fields) => indexes.some((index) => index.unique
        && Object.keys(index.key).length === fields.length
        && fields.every((field) => index.key[field] === 1));
    if (!exactUnique(walletIndexes, ["bookingId", "type"])
        || !exactUnique(lockIndexes, ["userId", "date"])) {
        throw Object.assign(new Error("Required unique index is missing"), {
            code: "MISSING_RECONCILIATION_INDEX"
        });
    }
};

const applyRepair = async ({ booking, stripe, expectedCategory }) => {
    // Re-read both systems immediately before an action. The called helpers perform
    // their own conditional updates and date locking against concurrent bookings.
    const current = await Booking.findById(booking._id);
    if (!current || current.fulfillmentVersion !== 0
        || current.stripeSessionId !== booking.stripeSessionId) {
        return "skipped_booking_changed";
    }
    const fresh = await inspect({ booking: current, stripe });
    if (fresh.category !== expectedCategory) return "skipped_state_changed";

    if (expectedCategory === "missing_payout_credit") {
        await ensurePayoutRecorded(current);
        const credit = await WalletTransaction.findOne({
            bookingId: current._id, type: "booking_payout"
        }).lean();
        return credit && credit.amount === current.providerPayoutAmount
            && String(credit.userId) === String(current.userId)
            && sameCurrency(credit.currency, current.currency)
            ? "credited" : "needs_manual_review";
    }
    if (expectedCategory === "paid_local_failed"
        || expectedCategory === "paid_pending_no_conflict") {
        const result = await confirmPaidCheckout({ session: fresh.session, stripe });
        if (result?.paymentStatus === "paid" && result.status === "confirmed") {
            return "confirmed";
        }
        if (["refund_pending", "refunded"].includes(result?.paymentStatus)) {
            return "refund_started_or_completed";
        }
        return "needs_manual_review";
    }
    if (expectedCategory === "unpaid_expired") {
        const result = await markCheckoutFailed({ booking: current, session: fresh.session });
        return result ? "marked_failed" : "skipped_state_changed";
    }
    return "skipped_no_safe_action";
};

const run = async () => {
    const args = process.argv.slice(2);
    if (args.includes("--help") || args.includes("-h")) {
        console.log(usage);
        return;
    }
    if (args.some((arg) => arg !== "--apply") || args.filter((arg) => arg === "--apply").length > 1) {
        console.error(usage);
        process.exitCode = 1;
        return;
    }
    const apply = args.includes("--apply");
    if (!process.env.MONGO_URL || !process.env.STRIPE_SECRET_KEY) {
        console.error("MONGO_URL and STRIPE_SECRET_KEY are required");
        process.exitCode = 1;
        return;
    }
    const stripe = getStripe();
    const summary = { mode: apply ? "apply" : "dry_run", scanned: 0, categories: {}, reasons: {}, actions: {}, errors: 0 };
    await mongoose.connect(process.env.MONGO_URL, { autoCreate: false, autoIndex: false });
    try {
        if (apply) await requireIndexesForApply();
        for await (const booking of Booking.find(legacyFilter).sort({ _id: 1 }).cursor()) {
            summary.scanned += 1;
            const bookingId = String(booking._id);
            try {
                const finding = await inspect({ booking, stripe });
                summary.categories[finding.category] = (summary.categories[finding.category] || 0) + 1;
                const record = { bookingId, category: finding.category };
                if (finding.reason) {
                    record.reason = finding.reason;
                    summary.reasons[finding.reason] = (summary.reasons[finding.reason] || 0) + 1;
                }
                if (finding.refundStatus) record.refundStatus = finding.refundStatus;
                if (finding.disputeStatus) record.disputeStatus = finding.disputeStatus;
                if (apply && ["missing_payout_credit", "paid_local_failed", "paid_pending_no_conflict", "unpaid_expired"].includes(finding.category)) {
                    record.action = await applyRepair({ booking, stripe, expectedCategory: finding.category });
                    summary.actions[record.action] = (summary.actions[record.action] || 0) + 1;
                }
                log(record);
            } catch {
                summary.errors += 1;
                summary.categories.manual_review = (summary.categories.manual_review || 0) + 1;
                summary.reasons.inspection_or_action_error = (summary.reasons.inspection_or_action_error || 0) + 1;
                log({ bookingId, category: "manual_review", reason: "inspection_or_action_error" });
            }
        }
        log({ summary });
        if (summary.errors) process.exitCode = 2;
    } finally {
        await mongoose.disconnect();
    }
};

run().catch((error) => {
    // Stripe and database exception messages can contain customer data; keep output generic.
    console.error(error.code === "MISSING_RECONCILIATION_INDEX"
        ? "Apply stopped: required unique booking payout or date lock index is missing"
        : "Legacy reconciliation stopped due to a configuration or database error");
    process.exitCode = 1;
});
