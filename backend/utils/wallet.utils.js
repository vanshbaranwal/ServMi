import mongoose from "mongoose";
import { WalletTransaction } from "../models/walletTransaction.models.js";
import { Withdrawal } from "../models/withdrawal.models.js";


export const createBookingPayoutTransaction = async({ booking, description }) => {
    if(booking?.paymentStatus !== "paid" || !booking.providerPayoutAmount || booking.providerPayoutAmount <= 0){
        return null;
    }

    try {
        
        return await WalletTransaction.create({
            userId: booking.userId,
            bookingId: booking._id,
            type: "booking_payout",
            amount: booking.providerPayoutAmount,
            currency: booking.currency,
            status: "available",
            description: description || "booking payout after platform fee"
        });

    } catch (error) {
        if(error.code === 11000){
            return WalletTransaction.findOne({ bookingId: booking._id, type: "booking_payout" });
        }

        throw error;
    }
};

export const createBookingRefundTransaction = async ({ booking, description }) => {
    if (!booking?.providerPayoutAmount || booking.providerPayoutAmount <= 0) return null;
    const payout = await WalletTransaction.findOne({ bookingId: booking._id, type: "booking_payout" });
    if (!payout) return null;
    try {
        return await WalletTransaction.create({
            userId: booking.userId,
            bookingId: booking._id,
            type: "booking_refund",
            amount: booking.providerPayoutAmount,
            currency: booking.currency,
            status: "refunded",
            description: description || "Provider payout reversed after customer refund"
        });
    } catch (error) {
        if (error.code === 11000) {
            return WalletTransaction.findOne({ bookingId: booking._id, type: "booking_refund" });
        }
        throw error;
    }
};

export const getWalletSummary = async(userId, session) => {
    const ownerId = userId instanceof mongoose.Types.ObjectId
        ? userId
        : new mongoose.Types.ObjectId(String(userId));

    const walletQuery = WalletTransaction.aggregate([
        { $match: { userId: ownerId } },
        { $group: { _id: "$type", total: { $sum: "$amount" } } }
    ]);
    const withdrawalQuery = Withdrawal.aggregate([
        { $match: { userId: ownerId } },
        { $group: { _id: "$status", total: { $sum: "$amount" } } }
    ]);

    if(session){
        walletQuery.session(session);
        withdrawalQuery.session(session);
    }

    // MongoDB transactions cannot run operations in parallel on one session.
    const rows = await walletQuery;
    const withdrawalRows = await withdrawalQuery;

    const totals = rows.reduce((acc, row) => ({ ...acc, [row._id]: row.total }), {});
    const withdrawalTotals = withdrawalRows.reduce((acc, row) => ({ ...acc, [row._id]: row.total }), {});
    const earned = (totals.booking_payout || 0) - (totals.booking_refund || 0);
    const held = (totals.withdrawal_hold || 0) + (totals.withdrawl_hold || 0);
    const reversed = (totals.withdrawal_reversal || 0) + (totals.withdrawl_reversal || 0);
    const pendingWithdrawals = (withdrawalTotals.pending || 0) + (withdrawalTotals.processing || 0);
    const paidWithdrawals = withdrawalTotals.paid || 0;

    return {
        earned,
        withdrawnOrPending: held - reversed,
        pendingWithdrawals,
        paidWithdrawals,
        available: Math.max(0, earned - held + reversed)
    };
};
