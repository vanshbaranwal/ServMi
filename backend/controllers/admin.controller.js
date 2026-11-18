import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Booking } from "../models/booking.models.js";
import { User } from "../models/user.models.js";
import { WalletTransaction } from "../models/walletTransaction.models.js";
import { Withdrawal } from "../models/withdrawal.models.js";
import { isValidUpiId } from "../utils/payout.utils.js";


const createAdminToken = (email) => {
    return jwt.sign({ email, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "7d" });
};


const terminalWithdrawalStatuses = ["paid", "rejected"];

const sumByKey = (rows) => rows.reduce((acc, row) => ({ ...acc, [row._id]: row.total }), {});

const getAdminSummary = async () => {
  const [usersCount, bookingTotals, walletTotals, withdrawalTotals, paymentReviews] = await Promise.all([
    User.countDocuments(),
    Booking.aggregate([
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          paidBookings: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] },
          },
          grossRevenue: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$amount', 0] },
          },
          platformFees: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$platformFeeAmount', 0] },
          },
          paidProviderPayouts: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$providerPayoutAmount', 0] },
          },
        },
      },
    ]),
    WalletTransaction.aggregate([
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
        },
      },
    ]),
    Withdrawal.aggregate([
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' },
        },
      },
    ]),
    Booking.countDocuments({ paymentReviewRequired: true }),
  ]);

  const bookingSummary = bookingTotals[0] || {};
  const walletMap = sumByKey(walletTotals);
  const withdrawalMap = sumByKey(withdrawalTotals);
  const paidProviderPayouts = bookingSummary.paidProviderPayouts || 0;
  const walletEarned = walletMap.booking_payout || 0;
  const heldWithdrawals = (walletMap.withdrawal_hold || 0) + (walletMap.withdrawl_hold || 0);
  const reversedWithdrawals = (walletMap.withdrawal_reversal || 0) + (walletMap.withdrawl_reversal || 0);
  const pendingWithdrawals = (withdrawalMap.pending || 0) + (withdrawalMap.processing || 0);
  const paidWithdrawals = withdrawalMap.paid || 0;
  const usersAvailableBalance = walletEarned - heldWithdrawals + reversedWithdrawals;

  return {
    users: usersCount,
    bookings: bookingSummary.count || 0,
    paidBookings: bookingSummary.paidBookings || 0,
    grossRevenue: bookingSummary.grossRevenue || 0,
    platformFees: bookingSummary.platformFees || 0,
    providerPayouts: paidProviderPayouts,
    walletEarned,
    payoutLedgerDifference: paidProviderPayouts - walletEarned,
    paymentReviews,
    usersAvailableBalance,
    pendingWithdrawals,
    paidWithdrawals,
    withdrawalHolds: pendingWithdrawals,
  };
};

const isAdminPasswordValid = async(password) => {
    if(process.env.ADMIN_PASSWORD_HASH){
        return bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
    }

    return password === process.env.ADMIN_PASSWORD;
};

export const loginAdmin = async(req, res) => {
    try {
        const { email, password } = req.body || {};
        const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();

        if(!adminEmail || (!process.env.ADMIN_PASSWORD_HASH && !process.env.ADMIN_PASSWORD)){
            return res.status(503).json({
                success: false,
                message: "admin login is not configured"
            });
        }

        if(typeof email !== "string" || typeof password !== "string" || !password || email.toLowerCase().trim() !== adminEmail){
            return res.status(401).json({
                success: false,
                message: "invalid admin credentials"
            });
        }

        const passwordValid = await isAdminPasswordValid(password);
        if(!passwordValid){
            return res.status(401).json({
                success: false,
                message: "invalid credentials"
            });
        }

        res.json({
            message: "Admin logged in successfully",
            token: createAdminToken(adminEmail),
            admin: { email: adminEmail }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "server error",
            error: error.message
        });
    }
};

export const getAdminDashboard = async (req, res) => {
  try {
    const [
      users,
      summary,
      withdrawals,
      recentBookings,
      paymentReviews,
    ] = await Promise.all([
      User.find().select('name email businessName slug payoutDetails createdAt').sort({ createdAt: -1 }).limit(100),
      getAdminSummary(),
      Withdrawal.find().populate('userId', 'name email businessName').sort({ createdAt: -1 }).limit(50),
      Booking.find({ paymentStatus: 'paid' })
        .populate('userId', 'name email businessName')
        .populate('serviceId', 'name')
        .sort({ updatedAt: -1 })
        .limit(10),
      Booking.find({ paymentReviewRequired: true })
        .populate('userId', 'name email businessName')
        .populate('serviceId', 'name')
        .sort({ updatedAt: -1 })
        .limit(50),
    ]);

    res.json({
      summary,
      users,
      withdrawals,
      recentBookings,
      paymentReviews,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const updateWithdrawalStatus = async (req, res) => {
  try {
    const { status, adminNote, transferReference } = req.body || {};
    const allowedStatuses = ['pending', 'processing', 'paid', 'rejected'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid withdrawal status' });
    }
    if (status === 'paid' && (typeof transferReference !== 'string' || transferReference.trim().length < 6)) {
      return res.status(400).json({ message: 'A transfer reference is required before marking a withdrawal paid' });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid withdrawal identifier' });
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const withdrawal = await Withdrawal.findById(req.params.id).session(session);
        if (!withdrawal) {
          throw Object.assign(new Error('Withdrawal not found'), { statusCode: 404 });
        }

        if (terminalWithdrawalStatuses.includes(withdrawal.status)) {
          throw Object.assign(
            new Error(`Withdrawal is already ${withdrawal.status} and cannot be changed`),
            { statusCode: 400 },
          );
        }

        const ledgerFilter = {
          userId: withdrawal.userId,
          $or: [
            { withdrawalId: withdrawal._id },
            { withdrawlId: withdrawal._id },
          ],
        };
        const heldTransaction = ['processing', 'paid', 'rejected'].includes(status)
          ? await WalletTransaction.collection.findOne(
            { ...ledgerFilter, type: { $in: ['withdrawal_hold', 'withdrawl_hold'] } },
            { session },
          )
          : null;

        if (['processing', 'paid'].includes(status) &&
            (!heldTransaction || Number(heldTransaction.amount) !== withdrawal.amount)) {
          throw Object.assign(new Error('Withdrawal has no matching held funds'), { statusCode: 409 });
        }
        if (['processing', 'paid'].includes(status)
            && !isValidUpiId(withdrawal.payoutSnapshot?.upiId)) {
          throw Object.assign(new Error('Withdrawal has no usable UPI payout destination'), { statusCode: 409 });
        }
        if (['processing', 'paid'].includes(status)
            && await Booking.exists({ userId: withdrawal.userId, paymentReviewRequired: true }).session(session)) {
          throw Object.assign(new Error('Provider has a payment under review'), { statusCode: 409 });
        }

        withdrawal.status = status;
        if (typeof adminNote === 'string') withdrawal.adminNote = adminNote;
        if (status === 'paid') withdrawal.transferReference = transferReference.trim();
        await withdrawal.save({ session });

        if (status === 'rejected') {
          const reversal = heldTransaction && await WalletTransaction.collection.findOne(
            { ...ledgerFilter, type: { $in: ['withdrawal_reversal', 'withdrawl_reversal'] } },
            { session },
          );

          if (heldTransaction && Number(heldTransaction.amount) > 0 && !reversal) {
            await WalletTransaction.updateOne(
              { withdrawalId: withdrawal._id, type: 'withdrawal_reversal' },
              {
                $setOnInsert: {
                  userId: withdrawal.userId,
                  amount: heldTransaction.amount,
                  status: 'reversed',
                  description: 'Withdrawal rejected and funds returned',
                },
              },
              { upsert: true, session },
            );
          }
        }
      });
    } finally {
      await session.endSession();
    }

    const [summary, withdrawal] = await Promise.all([
      getAdminSummary(),
      Withdrawal.findById(req.params.id).populate('userId', 'name email businessName'),
    ]);

    res.json({ message: `Withdrawal marked as ${status}`, withdrawal, summary });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Server error', error: error.message });
  }
};
