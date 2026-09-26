import mongoose from "mongoose";

export const connectDb = async(req, res) => {
    await mongoose.connect(process.env.MONGO_URL) // fixed typo
    .then(() => {
        console.log("database connection successful!");
    });
};