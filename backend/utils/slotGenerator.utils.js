import { Availability } from "../models/availability.models.js";
import { Booking } from "../models/booking.models.js";
import { timeOverlap } from "./overlap.utils.js";
import { getDayOfWeek, minutesToTime, timeToMinutes } from "./time.utils.js";


export const generateSlots = async({ userId, service, date }) => {

    const dayOfWeek = getDayOfWeek(date);
    const availability = await Availability.findOne({ userId, dayOfWeek });

    if(!availability || availability.slots.length === 0){
        return [];
    }

    const bookings = await Booking.find({
        userId,
        date,
        $or: [
            {
                status: "confirmed"
            },
            {
                status: "pending_payment",
                createdAt: {
                    $gte: new Date(Date.now() - 30 * 60 * 1000)
                }
            }
        ]
    });

    const slots = [];


    availability.slots.forEach((window) => {
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

    return slots;
    
};

