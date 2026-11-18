import mongoose from "mongoose";

const emailOtpCooldownSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    nextAllowedAt: { type: Date, required: true },
    expireAt: { type: Date, required: true, index: { expires: 0 } },
    requestToken: { type: String, required: true }
});

export const EmailOtpCooldown = mongoose.model("EmailOtpCooldown", emailOtpCooldownSchema);
