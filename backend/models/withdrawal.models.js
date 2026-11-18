import mongoose from "mongoose";


const withdrawalSchema = new mongoose.Schema({
    
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    amount: {
        type: Number,
        required: true,
        min: 1
    },

    requestId: {
        type: String,
        trim: true,
        maxlength: 128
    },

    currency: {
        type: String,
        default: "inr",
    },

    status: {
        type: String,
        enum: ["pending", "processing", "paid", "rejected"],
        default: "pending",
        index: true
    },

    payoutSnapshot: {
        accountHolderName: String,
        bankName: String,
        accountLast4: String,
        ifsc: String,
        upiId: String
    },

    adminNote: {
        type: String,
        default: "",
        trim: true
    },

    transferReference: {
        type: String,
        default: "",
        trim: true
    }

}, { timestamps: true });

withdrawalSchema.index(
    { userId: 1, requestId: 1 },
    {
        unique: true,
        partialFilterExpression: { requestId: { $exists: true } }
    }
);




export const Withdrawal = mongoose.model("Withdrawal", withdrawalSchema);
