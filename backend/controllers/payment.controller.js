import mongoose from 'mongoose';
import { User } from '../models/user.models.js';
import { WalletTransaction } from '../models/walletTransaction.models.js';
import { Withdrawal } from '../models/withdrawal.models.js';
import { Booking } from '../models/booking.models.js';
import { getWalletSummary } from '../utils/wallet.utils.js';
import { isValidUpiId } from '../utils/payout.utils.js';

/**
 * Casts a string to a Mongoose ObjectId type.
 */
const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

/**
 * Masks an account number by returning only the last 4 digits.
 */
const maskAccountNumber = (accountNumber = '') => {
  const digits = String(accountNumber).replace(/\D/g, '');
  return digits.slice(-4);
};

const requestError = (status, message) => Object.assign(new Error(message), { status });

/**
 * Retrieves an overview of the user's payments including payout details,
 * total wallet balance summary, and recent transactions/withdrawals.
 * 
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
export const getPaymentOverview = async (req, res) => {
  try {
    const userId = toObjectId(req.user.id);
    const [user, summary, transactions, withdrawals, paymentReviews] = await Promise.all([
      User.findById(userId).select('payoutDetails'),
      getWalletSummary(userId),
      WalletTransaction.find({ userId }).sort({ createdAt: -1 }).limit(15),
      Withdrawal.find({ userId }).sort({ createdAt: -1 }).limit(10),
      Booking.countDocuments({ userId, paymentReviewRequired: true }),
    ]);

    res.json({
      payoutDetails: user?.payoutDetails || {},
      wallet: { ...summary, available: paymentReviews ? 0 : summary.available, underReview: paymentReviews > 0 },
      transactions,
      withdrawals,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Updates the user's payout (bank/UPI) details.
 * Determines if the payout profile is complete based on provided information.
 * 
 * @param {Object} req - Express request object containing payout details in body.
 * @param {Object} res - Express response object.
 */
export const updatePayoutDetails = async (req, res) => {
  try {
    const accountHolderName = String(req.body?.accountHolderName || '').trim();
    const bankName = String(req.body?.bankName || '').trim();
    const accountNumber = String(req.body?.accountNumber || '').trim();
    const ifsc = String(req.body?.ifsc || '').trim().toUpperCase();
    const upiId = String(req.body?.upiId || '').trim();

    if (!accountHolderName || !isValidUpiId(upiId)) {
      return res.status(400).json({ message: 'Account holder and a valid UPI ID are required for withdrawals' });
    }

    if (accountNumber && (!bankName || !ifsc || maskAccountNumber(accountNumber).length < 4)) {
      return res.status(400).json({ message: 'Bank name, account number, and IFSC are required for bank payouts' });
    }

    const payoutDetails = {
      accountHolderName,
      bankName,
      accountLast4: accountNumber ? maskAccountNumber(accountNumber) : '',
      ifsc,
      upiId,
      isComplete: true,
      updatedAt: new Date(),
    };

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { payoutDetails },
      { new: true }
    ).select('payoutDetails');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Payout details saved', payoutDetails: user.payoutDetails });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Processes a withdrawal request from the user's available wallet balance.
 * Validates minimum amount, available balance, and complete payout details.
 * Creates a withdrawal record and a pending hold transaction.
 * 
 * @param {Object} req - Express request object containing the withdrawal amount.
 * @param {Object} res - Express response object.
 */
export const requestWithdrawal = async (req, res) => {
  const requestId = req.headers?.['idempotency-key'] || req.body?.requestId;
  try {
    const userId = toObjectId(req.user.id);
    const amount = Number(req.body?.amount);
    if (!Number.isSafeInteger(amount) || amount < 100) {
      return res.status(400).json({ message: 'Withdrawal amount must be at least 100 paise' });
    }

    if (requestId !== undefined && (typeof requestId !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(requestId))) {
      return res.status(400).json({ message: 'Invalid idempotency key' });
    }

    let withdrawal;
    let created = false;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        created = false;
        if (requestId) {
          withdrawal = await Withdrawal.findOne({ userId, requestId }).session(session);
          if (withdrawal) {
            if (withdrawal.amount !== amount) {
              throw requestError(409, 'Idempotency key was already used with a different amount');
            }
            return;
          }
        }

        const user = await User.findById(userId).select('payoutDetails').session(session);
        if (!user) throw requestError(404, 'User not found');
        if (!user.payoutDetails?.isComplete || !isValidUpiId(user.payoutDetails.upiId || '')) {
          throw requestError(400, 'Add a valid UPI ID before requesting a withdrawal');
        }

        // Serializes balance checks for concurrent withdrawal requests by this user.
        await User.updateOne({ _id: userId }, { $inc: { walletVersion: 1 } }, { session });
        const paymentReview = await Booking.exists({ userId, paymentReviewRequired: true }).session(session);
        if (paymentReview) {
          throw requestError(409, 'Withdrawals are paused while a payment is under review');
        }
        const summary = await getWalletSummary(userId, session);
        if (amount > summary.available) {
          throw requestError(400, 'Withdrawal amount exceeds available balance');
        }

        [withdrawal] = await Withdrawal.create([{
          userId,
          amount,
          ...(requestId && { requestId }),
          payoutSnapshot: user.payoutDetails,
        }], { session });

        await WalletTransaction.create([{
          userId,
          withdrawalId: withdrawal._id,
          type: 'withdrawal_hold',
          amount,
          status: 'pending',
          description: 'Withdrawal requested',
        }], { session });
        created = true;
      });
    } finally {
      await session.endSession();
    }

    res.status(created ? 201 : 200).json({ message: created ? 'Withdrawal requested' : 'Withdrawal already requested', withdrawal });
  } catch (error) {
    if (error.code === 11000 && typeof requestId === 'string') {
      const existing = await Withdrawal.findOne({
        userId: toObjectId(req.user.id),
        requestId,
      });
      if (existing) {
        if (existing.amount !== Number(req.body?.amount)) {
          return res.status(409).json({ message: 'Idempotency key was already used with a different amount' });
        }
        return res.status(200).json({ message: 'Withdrawal already requested', withdrawal: existing });
      }
    }
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Server error' });
  }
};
