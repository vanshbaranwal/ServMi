import crypto from "node:crypto";
import { RateLimitBucket } from "../models/rateLimitBucket.models.js";

export const rateLimit = ({ scope, limit, windowMs }) => async (req, res, next) => {
    const window = Math.floor(Date.now() / windowMs);
    const key = crypto.createHash("sha256")
        .update(`${scope}:${req.ip || req.socket?.remoteAddress || "unknown"}:${window}`)
        .digest("hex");
    const update = {
        $inc: { count: 1 },
        $setOnInsert: { expireAt: new Date((window + 1) * windowMs + 60 * 60 * 1000) }
    };

    try {
        let bucket;
        try {
            bucket = await RateLimitBucket.findOneAndUpdate(
                { key }, update, { upsert: true, new: true }
            );
        } catch (error) {
            if (error.code !== 11000) throw error;
            bucket = await RateLimitBucket.findOneAndUpdate(
                { key }, { $inc: { count: 1 } }, { new: true }
            );
        }
        if (bucket.count > limit) {
            res.set("Retry-After", String(Math.ceil(((window + 1) * windowMs - Date.now()) / 1000)));
            return res.status(429).json({ success: false, message: "Too many requests. Try again later." });
        }
        return next();
    } catch (error) {
        console.error(`${scope} rate limit failed:`, error);
        return res.status(503).json({ success: false, message: "Request temporarily unavailable" });
    }
};
