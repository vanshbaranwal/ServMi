import bcrypt from "bcryptjs";
import crypto from "crypto";
import { EmailOtp } from "../models/emailOtp.models.js";
import { EmailOtpCooldown } from "../models/emailOtpCooldown.models.js";
import { sendOtpNotification } from "./bookingNotifications.utils.js";


const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const REQUEST_COOLDOWN_MS = 60 * 1000;


const normalizeEmail = (email) => typeof email === "string" ? email.toLowerCase().trim() : "";


const createCode = () => crypto.randomInt(100000, 1000000).toString();

export const requestEmailOtp = async({ email, purpose }) => {
    const normalizedEmail = normalizeEmail(email);
    if(!normalizedEmail){
        throw new Error("email is required");
    }

    const now = new Date();
    const cooldownKey = crypto.createHash("sha256")
        .update(`${purpose}:${normalizedEmail}`)
        .digest("hex");
    const requestToken = crypto.randomUUID();
    await EmailOtpCooldown.init();
    try {
        await EmailOtpCooldown.findOneAndUpdate(
            { key: cooldownKey, nextAllowedAt: { $lte: now } },
            { $set: {
                nextAllowedAt: new Date(now.getTime() + REQUEST_COOLDOWN_MS),
                expireAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
                requestToken
            } },
            { upsert: true, new: true }
        );
    } catch (error) {
        if (error.code !== 11000) throw error;
        const rateError = new Error("Wait a minute before requesting another code");
        rateError.statusCode = 429;
        throw rateError;
    }

    let record;
    try {
        const code = createCode();
        const codeHash = await bcrypt.hash(code, 10);
        const expireAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

        await EmailOtp.deleteMany({ email: normalizedEmail, purpose, consumeAt: null });
        record = await EmailOtp.create({ email: normalizedEmail, purpose, codeHash, expireAt });
        await sendOtpNotification({ email: normalizedEmail, code, purpose });

        return{
            sent: true,
            email: normalizedEmail,
            expiresInMinutes: OTP_TTL_MINUTES
        };
    } catch (error) {
        if (record) await EmailOtp.deleteOne({ _id: record._id });
        await EmailOtpCooldown.updateOne(
            { key: cooldownKey, requestToken },
            { $set: { nextAllowedAt: new Date(0) } }
        );
        throw error;
    }
};

export const verifyEmailOtp = async({ email, purpose, code, consume = false }) => {
    const normalizedEmail = normalizeEmail(email);

    if(!normalizedEmail || !code){
        return {
            verified: false,
            reason: "email and otp are required"
        };
    }

    const record = await EmailOtp.findOne({
        email: normalizedEmail,
        purpose,
        consumeAt: null,
        expireAt: { $gt: new Date() }

    }).sort({ createdAt: -1 });

    if(!record){
        return{
            verified: false,
            reason: "otp expired or not found"
        };
    }

    if(record.attempts >= MAX_ATTEMPTS){
        return{
            verified: false,
            reason: "too many otp attempts.. requested a new code"
        };
    }

    const isMatch = await bcrypt.compare(String(code).trim(), record.codeHash);
    if(!isMatch){
        await EmailOtp.updateOne(
            { _id: record._id, consumeAt: null, attempts: { $lt: MAX_ATTEMPTS } },
            { $inc: { attempts: 1 } }
        );

        return{
            verified: false,
            reason: "invalid otp" 
        };
    }

    if(consume){
        const consumed = await EmailOtp.findOneAndUpdate(
            {
                _id: record._id,
                consumeAt: null,
                expireAt: { $gt: new Date() },
                attempts: { $lt: MAX_ATTEMPTS }
            },
            { $set: { consumeAt: new Date() } },
            { new: true }
        );
        if (!consumed) {
            return { verified: false, reason: "otp expired or already used" };
        }
    }

    return{
        verified: true,
        email: normalizedEmail
    };
};
