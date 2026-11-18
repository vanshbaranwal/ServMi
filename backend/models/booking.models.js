import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
        required: true
    },

    customerName: {
        type: String,
        required: true,
        trim: true
    },

    customerEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },

    customerAvatar: {
        type: String,
        default: "A1.png"
    },

    date: {
        type: String,
        required: true,
        index: true
    },

    startTime: {
        type: String,
        required: true
    },

    endTime: {
        type: String,
        required: true
    },
    
    status: {
        type: String,
        enum: ["pending", "pending_payment", "confirmed", "cancelled", "payment_failed"],
        default: "confirmed"
    },

    paymentStatus: {
        type: String,
        enum: ["not_required", "pending", "paid", "failed", "refund_pending", "refunded", "refund_failed"],
        default: "not_required"
    },

    stripeSessionId: {
        type: String,
        default: "",
        index: true
    },

    accessTokenHash: {
        type: String,
        select: false
    },

    holdExpiresAt: {
        type: Date
    },

    stripeRefundId: {
        type: String,
        default: ""
    },

    stripePaymentIntentId: {
        type: String,
        default: "",
        index: true
    },

    paymentReviewRequired: {
        type: Boolean,
        default: false,
        index: true
    },

    paymentReviewReason: {
        type: String,
        default: ""
    },

    payoutRecordedAt: {
        type: Date
    },

    fulfillmentVersion: {
        type: Number,
        default: 0
    },

    calendarSyncedAt: Date,
    calendarSyncLeaseUntil: Date,
    confirmationCustomerEmailSentAt: Date,
    confirmationCustomerEmailLeaseUntil: Date,
    confirmationProviderEmailSentAt: Date,
    confirmationProviderEmailLeaseUntil: Date,

    amount: {
        type: Number,
        default: 0
    },

    platformFeeAmount: {
        type: Number,
        default: 0
    },

    providerPayoutAmount: {
        type: Number,
        default: 0
    },

    payoutStatus: {
        type: String,
        enum: ["not_required", "pending", "available", "withdrawn"],
        default: "not_required"
    },

    currency: {
        type: String,
        default: "inr"
    },

    googleEventId: {
        type: String,
        default: ""
    },

    customerCalendarUrl: {
        type: String,
        default: ""
    },

    notes: {
        type: String,
        default: "",
        trim: true
    },

    reminderSent: {
        type: Boolean,
        default: false
    },

    isRescheduled: {
        type: Boolean,
        default: false
    },

    rescheduleCount: {
        type: Number,
        default: 0
    }
    
}, { timestamps: true });



export const Booking = mongoose.model("Booking", bookingSchema);
