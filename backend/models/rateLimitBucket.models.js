import mongoose from "mongoose";

const rateLimitBucketSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 0 },
    expireAt: { type: Date, required: true, index: { expires: 0 } }
});

export const RateLimitBucket = mongoose.model("RateLimitBucket", rateLimitBucketSchema);
