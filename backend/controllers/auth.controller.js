import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";
import { requestEmailOtp, verifyEmailOtp } from "../utils/emailOtp.utils.js";
import slugify from "../utils/slug.utils.js";

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isValidTimezone = (value) => {
    if (typeof value !== "string" || !value.trim()) return false;
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: value });
        return true;
    } catch {
        return false;
    }
};
const isValidAccent = (value) => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);


const createToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

const toUserResponse = (user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        slug: user.slug,
        businessName: user.businessName,
        businessDescription: user.businessDescription,
        brandTheme: user.brandTheme,
        brandAccent: user.brandAccent,
        timezone: user.timezone,
        googleCalendarConnected: user.googleCalendarConnected,
        googleCalendarId: user.googleCalendarId,
        payoutDetails: user.payoutDetails,
        stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
    });


export const registerUser = async(req, res) => {
    try {
        
        const { name, email, password, businessName, businessDescription, timezone, emailOtp } = req.body || {};
        if(typeof name !== "string" || !name.trim() || typeof email !== "string" || !isValidEmail(email.trim())
            || typeof password !== "string" || password.length < 6
            || (timezone !== undefined && !isValidTimezone(timezone))
            || (businessName !== undefined && typeof businessName !== "string")
            || (businessDescription !== undefined && typeof businessDescription !== "string")){
            return res.status(400).json({
                success: false,
                message: "Valid name, email, password (at least 6 characters), and business details are required"
            });
        }

        const normalizedEmail = email.toLowerCase().trim();
        
        const existingUser = await User.findOne({ email: normalizedEmail });

        if(existingUser){
            return res.status(400).json({
                success: false,
                message: "user already exists"
            });
        }

        const otpResult = await verifyEmailOtp({
            email: normalizedEmail,
            purpose: "registration",
            code: emailOtp,
            consume: true
        });

        if(!otpResult.verified){
            return res.status(400).json({
                success: false,
                message: otpResult.reason || "email verification is required"
            });
        }

        const baseSlug = slugify(businessName || name) || "business";
        let finalSlug = baseSlug;
        let counter = 1;

        while(await User.findOne({ slug: finalSlug })){
            finalSlug = `${baseSlug}-${counter}`;
            counter += 1;
        };

        const hashPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email: normalizedEmail,
            password: hashPassword,
            slug: finalSlug,
            businessName: businessName || "",
            businessDescription: businessDescription || "",
            timezone: timezone || "Asia/Kolkata"
        });

        const token = createToken(user._id);

        res.status(200).json({
            success: true,
            message: "registered successfully",
            token,
            user: toUserResponse(user)
        });


        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "server error",
                error: error.message
            });
    }
};



export const requestRegistrationOTP = async(req, res) => {
    try {
        const { email } = req.body || {};
        const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";

        if(!isValidEmail(normalizedEmail)){
            return res.status(400).json({
                success: false,
                message: "valid email is required"
            });
        }
        
        const existingUser = await User.findOne({ email: normalizedEmail });
        if(existingUser){
            return res.status(400).json({
                message: "email already exists"
            });
        }

        const result = await requestEmailOtp({ email: normalizedEmail, purpose: "registration" });
        res.json({
            message: "verification code send",
            result
        });

    } catch (error) {
        return res.status(error.statusCode === 429 ? 429 : 503).json({
            success: false,
            message: error.statusCode === 429 ? error.message : "Unable to send verification code right now"
        });
    }
};


export const verifyRegistrationOtp = async(req, res) => {
    try {
        const { email, emailOtp } = req.body || {};

        const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";

        if(!isValidEmail(normalizedEmail) || !emailOtp){
            return res.status(400).json({
                success: false,
                message: "email and otp are required"
            });
        }

        const existingUser = await User.findOne({ email: normalizedEmail });
        if(existingUser){
            return res.status(400).json({
                success: false,
                message: "email already exists"
            });
        }
        
        const otpResult = await verifyEmailOtp({
            email: normalizedEmail,
            purpose: "registration",
            code: emailOtp,
            consume: false
        });

        if(!otpResult.verified){
            return res.status(400).json({
                success: false,
                message: otpResult.reason || "invalid otp"
            });
        }

        res.json({
            message: "otp verified",
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "server error",
            error: error.message
        });
    }
};


export const loginUser = async(req, res) => {
    try {
        const { email, password } = req.body || {};

        if(typeof email !== "string" || !email.trim() || typeof password !== "string" || !password){
            return res.status(400).json({
                success: false,
                message: "email and password are required"
            });
        }
        
        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });

        if(!user){
            return res.status(401).json({
                success: false,
                message: "invalid credentials"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch){
            return res.status(401).json({
                success: false,
                message: "invalid credentials"
            });
        }

        const token = createToken(user._id);

        res.json({
            message: "logged inn successfully",
            token,
            user: toUserResponse(user)
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "server error",
            error: error.message
        });
    }
};


export const getMe = async(req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");

        if(!user){
            return res.status(404).json({
                success: false,
                message: "user not found"
            });
        }

        res.json({ user: toUserResponse(user) });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "server error",
            error: error.message
        });
    }
};


export const updateProfile = async(req, res) => {
    try {
        const { businessName, businessDescription, timezone, brandTheme, brandAccent } = req.body || {};

        if ((businessName !== undefined && typeof businessName !== "string")
            || (businessDescription !== undefined && typeof businessDescription !== "string")
            || (timezone !== undefined && !isValidTimezone(timezone))
            || (brandTheme !== undefined && !["emerald", "indigo", "rose", "amber", "slate"].includes(brandTheme))
            || (brandAccent !== undefined && !isValidAccent(brandAccent))) {
            return res.status(400).json({ success: false, message: "Invalid profile details" });
        }

        const user = await User.findById(req.user.id);
        if(!user){
            return res.status(404).json({
                success: false,
                message: "user not found"
            });
        }
        
        if(businessName !== undefined) user.businessName = businessName;
        if(businessDescription !== undefined) user.businessDescription = businessDescription;
        if(timezone !== undefined) user.timezone = timezone;
        if(brandTheme !== undefined) user.brandTheme = brandTheme;
        if(brandAccent !== undefined) user.brandAccent = brandAccent;

        await user.save();

        res.json({
            message: "profile updated successfully",
            user: toUserResponse(user)
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "server error",
            error: error.message
        });
    }
};
