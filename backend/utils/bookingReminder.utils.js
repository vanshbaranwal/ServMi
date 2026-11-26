import { Booking } from "../models/booking.models.js";
import { Service } from "../models/service.models.js";
import { User } from "../models/user.models.js";
import { getEmailConfigStatus, sendBookingNotification } from "./bookingNotifications.utils.js";

const partsAt = (date, timeZone) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hourCycle: "h23"
    }).formatToParts(date);
    const value = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
    return {
        year: value("year"), month: value("month"), day: value("day"),
        hour: value("hour"), minute: value("minute"), second: value("second")
    };
};

export const bookingDateTimeToUtc = ({ date, time, timeZone = "Asia/Kolkata" }) => {
    const [year, month, day] = String(date).split("-").map(Number);
    const [hour, minute] = String(time).split(":").map(Number);
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
    let guess = desired;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const observed = partsAt(new Date(guess), timeZone);
        const observedAsUtc = Date.UTC(
            observed.year, observed.month - 1, observed.day,
            observed.hour, observed.minute, observed.second
        );
        guess += desired - observedAsUtc;
    }
    return new Date(guess);
};

const dateWindow = (now) => {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 1);
    const end = new Date(now);
    end.setUTCDate(end.getUTCDate() + 2);
    return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
};

export const sendUpcomingBookingReminders = async ({ now = new Date() } = {}) => {
    if (!getEmailConfigStatus().configured) return { checked: 0, sent: 0 };
    const reminderHours = Math.min(72, Math.max(1, Number(process.env.BOOKING_REMINDER_HOURS || 24)));
    const [fromDate, toDate] = dateWindow(now);
    const candidates = Booking.find({
        status: "confirmed",
        reminderSent: false,
        date: { $gte: fromDate, $lte: toDate }
    }).cursor();
    let checked = 0;
    let sent = 0;

    for await (const booking of candidates) {
        checked += 1;
        const [business, service] = await Promise.all([
            User.findById(booking.userId),
            Service.findById(booking.serviceId)
        ]);
        if (!business || !service) continue;

        let appointment;
        try {
            appointment = bookingDateTimeToUtc({
                date: booking.date,
                time: booking.startTime,
                timeZone: business.timezone || "Asia/Kolkata"
            });
        } catch (error) {
            console.error(`Booking ${booking._id} reminder timezone failed:`, error.message);
            continue;
        }
        const millisecondsUntil = appointment.getTime() - now.getTime();
        if (millisecondsUntil <= 0 || millisecondsUntil > reminderHours * 60 * 60 * 1000) continue;

        const leaseUntil = new Date(now.getTime() + 2 * 60 * 1000);
        const claimed = await Booking.findOneAndUpdate(
            {
                _id: booking._id,
                status: "confirmed",
                reminderSent: false,
                $or: [
                    { reminderLeaseUntil: null },
                    { reminderLeaseUntil: { $exists: false } },
                    { reminderLeaseUntil: { $lte: now } }
                ]
            },
            { $set: { reminderLeaseUntil: leaseUntil } },
            { new: true, select: "+accessTokenHash" }
        );
        if (!claimed) continue;

        try {
            const result = await sendBookingNotification({
                business, service, booking: claimed, type: "reminder", recipientType: "customer"
            });
            if (!result.skipped) {
                const updated = await Booking.updateOne(
                    { _id: claimed._id, status: "confirmed", reminderSent: false, reminderLeaseUntil: leaseUntil },
                    { $set: { reminderSent: true, reminderSentAt: new Date(), reminderLeaseUntil: new Date(0) } }
                );
                if (updated.modifiedCount) sent += 1;
            }
        } catch (error) {
            console.error(`Booking ${booking._id} reminder failed:`, error.message);
            await Booking.updateOne(
                { _id: claimed._id, reminderLeaseUntil: leaseUntil },
                { $set: { reminderLeaseUntil: new Date(0) } }
            );
        }
    }
    return { checked, sent };
};
