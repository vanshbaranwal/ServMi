import bcrypt from "bcryptjs";
import crypto from "crypto";
import { EmailOtp } from "../models/emailOtp.models.js";
import { sendOtpNotification } from "./bookingNotifications.utils.js";


const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;


const normalizeEmail = (email = "") => email.toLowerCase().trim();


const createCode = () => crypto.randomInt(100000, 1000000).toString();

export const requestEmailOtp = async({ email, purpose }) => {
    const normalizedEmail = normalizeEmail(email);
    if(!normalizedEmail){
        throw new Error("email is requied");
    }

    const code = createCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expireAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await EmailOtp.deleteMany({ email: normalizedEmail, purpose, consumeAt: null });

    await EmailOtp.create({
        email: normalizedEmail,
        purpose,
        codeHash,
        expireAt
    });

    await sendOtpNotification({ email: normalizedEmail, code, purpose });

    return{
        sent: true,
        email: normalizedEmail,
        expiresInMinutes: OTP_TTL_MINUTES
    };
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
        record.attempts += 1;
        await record.save();

        return{
            verified: false,
            reason: "invalid otp" 
        };
    }

    if(consume){
        record.consumeAt = new Date();

        await record.save();
    }

    return{
        verified: true,
        email: normalizedEmail
    };
};