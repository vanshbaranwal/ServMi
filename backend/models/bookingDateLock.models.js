import mongoose from "mongoose";

const bookingDateLockSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    date: { type: String, required: true },
    lockToken: { type: String, default: "" },
    lockedUntil: { type: Date, default: () => new Date(0) }
});

bookingDateLockSchema.index({ userId: 1, date: 1 }, { unique: true });

export const BookingDateLock = mongoose.model("BookingDateLock", bookingDateLockSchema);
