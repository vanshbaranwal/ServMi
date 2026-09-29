import mongoose, { mongo } from "mongoose";


const slotSchema = new mongoose.Schema({

    startTime: {
        type: String,
        required: true
    },

    endTime: {
        type: String,
        required: true
    }

}, { _id: false });

const availabilitySchema = new mongoose.Schema({
    
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    dayOfWeek: {
        type: Number,
        required: true,
        min: 0,
        max: 6
    },

    slots: {
        type: [slotSchema],
        default: [],
    }

}, { timestamps: true });


availabilitySchema.index({ userId: 1, dayOfWeek: 1 }, { unique: true });


export const Availability = mongoose.model("Availability", availabilitySchema);