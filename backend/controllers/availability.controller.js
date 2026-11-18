import { Availability } from "../models/availability.models.js";
import { isValidTimeRange, timeToMinutes } from "../utils/time.utils.js";


export const listAvailability = async(req, res) => {
    try {
        
        const availability = await Availability.find({ userId: req.user.id }).sort({ dayOfWeek: 1 });

        res.json({
            success: true,
            availability
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "server error",
            error: error.message
        });
    }
};

export const saveAvailability = async(req, res) => {
    try {
        
        const { dayOfWeek, slots } = req.body || {};

        if(!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || !Array.isArray(slots)){
            return res.status(400).json({
                success: false,
                message: "Valid day of week and slots are required"
            });
        }

        if (!slots.every((slot) => slot && isValidTimeRange(slot.startTime, slot.endTime))) {
            return res.status(400).json({ success: false, message: "Every availability window needs valid times" });
        }
        const cleanedSlots = [...slots].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        if (cleanedSlots.some((slot, index) => index > 0
            && timeToMinutes(slot.startTime) < timeToMinutes(cleanedSlots[index - 1].endTime))) {
            return res.status(400).json({ success: false, message: "Availability windows cannot overlap" });
        }

        const availability = await Availability.findOneAndUpdate(
            {
                userId: req.user.id,
                dayOfWeek
            },
            {
                slots: cleanedSlots
            },
            {
                new: true,
                upsert: true,
                runValidators: true
            }
        );

        return res.json({
            success: true,
            message: "availability saved",
            availability
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "server error",
            error: error.message
        });
    }
};

