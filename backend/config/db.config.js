import mongoose from "mongoose";

export const connectDb = async(req, res) => {
    await mongoose.connect("mongodb+srv://vanshveerbaranwal_db_user:tYWaKaJiy53oWugS@cluster0.dyn78zq.mongodb.net/ServMi")
    .then(() => {
        console.log("database connection successful!");
    });
}