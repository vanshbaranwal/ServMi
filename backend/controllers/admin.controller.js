import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Booking } from "../models/booking.models.js";
import { User } from "../models/user.models.js";
import { WalletTransaction } from "../models/walletTransaction.models.js";
import { Withdrawal } from "../models/withdrawal.models.js";


const createAdminToken = (email) => {
    return jwt.sign({ email, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "7d" });
};


const terminalWithdrawalStatuses = ["paid", "rejected"];

const sumByKey = (rows) => rows.reduce((acc, row) => ({ ...acc, [row._id]: row.total }), {});

const getAdminSummary = async () => {
  const [usersCount, bookingTotals, walletTotals, withdrawalTotals] = await Promise.all([
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
          confirmedProviderPayouts: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, '$providerPayoutAmount', 0] },
          },
          activeProviderPayouts: {
            $sum: {
              $cond: [
                { $in: ['$status', ['cancelled', 'payment_failed']] },
                0,
                '$providerPayoutAmount',
              ],
            },
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
  ]);

  const bookingSummary = bookingTotals[0] || {};
  const walletMap = sumByKey(walletTotals);
  const withdrawalMap = sumByKey(withdrawalTotals);
  const paidProviderPayouts = bookingSummary.paidProviderPayouts || 0;
  const confirmedProviderPayouts = bookingSummary.confirmedProviderPayouts || 0;
  const activeProviderPayouts = bookingSummary.activeProviderPayouts || 0;
  const walletEarned = walletMap.booking_payout || 0;
  const heldWithdrawals = walletMap.withdrawal_hold || 0;
  const reversedWithdrawals = walletMap.withdrawal_reversal || 0;
  const providerPayouts = Math.max(
    paidProviderPayouts,
    confirmedProviderPayouts,
    activeProviderPayouts,
    walletEarned,
  );
  const pendingWithdrawals = (withdrawalMap.pending || 0) + (withdrawalMap.processing || 0);
  const paidWithdrawals = withdrawalMap.paid || 0;
  const usersAvailableBalance = Math.max(0, walletEarned - heldWithdrawals + reversedWithdrawals);
  const walletWithdrawalHold = usersAvailableBalance + pendingWithdrawals;
  const bookingWithdrawalHold = Math.max(0, providerPayouts - paidWithdrawals);

  return {
    users: usersCount,
    bookings: bookingSummary.count || 0,
    paidBookings: bookingSummary.paidBookings || 0,
    grossRevenue: bookingSummary.grossRevenue || 0,
    platformFees: bookingSummary.platformFees || 0,
    providerPayouts,
    walletEarned,
    usersAvailableBalance,
    pendingWithdrawals,
    paidWithdrawals,
    withdrawalHolds: Math.max(walletWithdrawalHold, bookingWithdrawalHold),
  };
};

const isAdminPasswordValid = async(password) => {
    if(process.env.ADMIN_PASSWORD_HASH){
        return bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
    }

    return password = process.env.ADMIN_PASSWORD;
};

export const loginAdmin = async(req, res) => {
    try {
        const { email, password } = req.body;
        const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();

        if(!adminEmail || (!process.env.ADMIN_EMAIL && !process.env.ADMIN_PASSWORD_HASH)){
            return res.status(503).json({
                success: false,
                message: "admin login is not configured"
            });
        }

        if(!email || !password || email.toLowerCase().trim() !== adminEmail){
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
            message: "Admin logginn successfully",
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
    ] = await Promise.all([
      User.find().select('name email businessName slug payoutDetails createdAt').sort({ createdAt: -1 }).limit(100),
      getAdminSummary(),
      Withdrawal.find().populate('userId', 'name email businessName').sort({ createdAt: -1 }).limit(50),
      Booking.find({ paymentStatus: 'paid' })
        .populate('userId', 'name email businessName')
        .populate('serviceId', 'name')
        .sort({ updatedAt: -1 })
        .limit(10),
    ]);

    res.json({
      summary,
      users,
      withdrawals,
      recentBookings,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const updateWithdrawalStatus = async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const allowedStatuses = ['pending', 'processing', 'paid', 'rejected'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid withdrawal status' });
    }

    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found' });
    }

    if (terminalWithdrawalStatuses.includes(withdrawal.status)) {
      return res.status(400).json({
        message: `Withdrawal is already ${withdrawal.status} and cannot be changed`,
      });
    }

    if (status === 'rejected' && withdrawal.status !== 'rejected') {
      const existingReversal = await WalletTransaction.findOne({
        withdrawalId: withdrawal._id,
        type: 'withdrawal_reversal',
      });

      if (!existingReversal) {
        await WalletTransaction.create({
          userId: withdrawal.userId,
          withdrawalId: withdrawal._id,
          type: 'withdrawal_reversal',
          amount: withdrawal.amount,
          status: 'reversed',
          description: 'Withdrawal rejected and funds returned',
        });
      }
    }

    withdrawal.status = status;
    withdrawal.adminNote = adminNote || withdrawal.adminNote;
    await withdrawal.save();
    const [summary] = await Promise.all([
      getAdminSummary(),
      withdrawal.populate('userId', 'name email businessName'),
    ]);

    res.json({ message: `Withdrawal marked as ${status}`, withdrawal, summary });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};