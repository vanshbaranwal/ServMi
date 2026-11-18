import { Availability } from "../models/availability.models.js";
import { Booking } from "../models/booking.models.js";
import { timeOverlap } from "./overlap.utils.js";
import { getDayOfWeek, isValidTimeRange, minutesToTime, timeToMinutes } from "./time.utils.js";


export const generateSlots = async({ userId, service, date }) => {

    if (!Number.isSafeInteger(service?.duration) || service.duration < 5) {
        return [];
    }

    const dayOfWeek = getDayOfWeek(date);
    const availability = await Availability.findOne({ userId, dayOfWeek });

    if(!availability || availability.slots.length === 0){
        return [];
    }

    const now = new Date();
    const bookings = await Booking.find({
        userId,
        date,
        $or: [
            {
                status: "confirmed"
            },
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
    });

    const slots = [];


    availability.slots.filter((window) => isValidTimeRange(window.startTime, window.endTime)).forEach((window) => {
        let cursor = timeToMinutes(window.startTime);
        const end = timeToMinutes(window.endTime);

        while(cursor + service.duration <= end){
            const startTime = minutesToTime(cursor);
            const endTime = minutesToTime(cursor + service.duration);

            const hasConflict = bookings.some((booking) => {
                return timeOverlap(
                    startTime,
                    endTime,
                    booking.startTime,
                    booking.endTime
                );
            });
            
            if(!hasConflict){
                slots.push({ startTime, endTime });
            }

            cursor += service.duration;
        }
    });

    return [...new Map(slots.map((slot) => [`${slot.startTime}-${slot.endTime}`, slot])).values()]
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    
};

