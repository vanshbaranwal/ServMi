import { Availability } from "../models/availability.models.js";
import { isValidTimeRange } from "../utils/time.utils.js";


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
        
        const { dayOfWeek, slots } = req.body;

        if(dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6){
            return res.status(400).json({
                success: false,
                message: "valid day of week is required"
            });
        }

        const cleanedSlots = (slots || []).filter((slot) => (
            slot.startTime && slot.endTime && isValidTimeRange(slot.startTime, slot.endTime)
        ));

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
                upsert: true
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

