import crypto from "node:crypto";
import { BookingDateLock } from "../models/bookingDateLock.models.js";

const LOCK_LEASE_MS = 2 * 60_000;
const RENEW_INTERVAL_MS = 30_000;
const MAX_ATTEMPTS = 50;
const RETRY_DELAY_MS = 100;

export const withBookingDateLock = async ({ userId, date, work }) => {
    const lockToken = crypto.randomUUID();
    let acquired = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        const now = new Date();
        try {
            const lock = await BookingDateLock.findOneAndUpdate(
                {
                    userId,
                    date,
                    $or: [
                        { lockedUntil: { $lte: now } },
                        { lockedUntil: { $exists: false } }
                    ]
                },
                {
                    $set: {
                        lockToken,
                        lockedUntil: new Date(now.getTime() + LOCK_LEASE_MS)
                    }
                },
                { upsert: true, new: true }
            );
            if (lock?.lockToken === lockToken) {
                acquired = true;
                break;
            }
        } catch (error) {
            if (error.code !== 11000) throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }

    if (!acquired) {
        const error = new Error("Booking date is busy. Try again shortly.");
        error.statusCode = 503;
        throw error;
    }

    const renewal = setInterval(async () => {
        try {
            await BookingDateLock.updateOne(
                { userId, date, lockToken },
                { $set: { lockedUntil: new Date(Date.now() + LOCK_LEASE_MS) } }
            );
        } catch (error) {
            console.error(`Booking date lock renewal failed for ${userId} ${date}:`, error);
        }
    }, RENEW_INTERVAL_MS);
    renewal.unref();

    try {
        return await work();
    } finally {
        clearInterval(renewal);
        try {
            await BookingDateLock.updateOne(
                { userId, date, lockToken },
                { $set: { lockedUntil: new Date(0) }, $unset: { lockToken: "" } }
            );
        } catch (error) {
            console.error(`Booking date lock release failed for ${userId} ${date}:`, error);
        }
    }
};
