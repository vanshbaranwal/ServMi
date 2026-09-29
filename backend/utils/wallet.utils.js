import { WalletTransaction } from "../models/walletTransaction.models.js";
import { Withdrawl } from "../models/withdrawl.models.js";


export const createBookingPayoutTransaction = async({ booking, description }) => {
    if(!booking?.providePayoutAmount){
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

export const getWalletSummary = async(userId) => {
    const [rows, withdrawlRows] = await Promise.all([
        WalletTransaction.aggregate([
            
            {
                $match: {
                    user
                }
            },
            {
                $group: {
                    _id: `$type`,
                    total: { $sum: "$amount" }
                }
            }
        ]),

        Withdrawl.aggregate([
            {
                $match: {
                    userId
                }
            },
            {
                $group: {
                    _id: "$status",
                    total: { $sum: "$amount" }
                }
            }
        ])
    ]);

    const totals = rows.reduce((acc, row) => ({ ...acc, [row._id]: row.total }), {});
    const withdrawlTotals = withdrawlRows.reduce((acc, row) => ({ ...acc, [row._id]: row.total }), {});
    const earned = totals.booking_payout || 0;
    const held = totals.withdrawl_hold || 0;
    const reversed = totals.withdrawl_reversal || 0;
    const pendingWithdrawls = (withdrawlTotals.pending || 0) + (withdrawlTotals.processing || 0);
    const paidWithdrawls = withdrawlTotals.paid || 0;

    return {
        earned,
        withdrawOrPending: held - reversed,
        pendingWithdrawls,
        paidWithdrawls,
        available: Math.max(0, earned - held + reversed)
    };
};