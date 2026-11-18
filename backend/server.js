import express from "express";
import cors from "cors";
import "dotenv/config";
import http from "http";
import mongoose from "mongoose";
import { connectDb } from "./config/db.config.js";
import authRoutes from "./routes/auth.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import availabilityRoutes from "./routes/availbility.routes.js";
import integrationRoutes from "./routes/integration.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import publicRoutes from "./routes/public.routes.js";
import adminRoutes from "./routes/adminRoutes.js"
import { receiveStripeWebhook } from "./controllers/stripeWebhook.controller.js";
import { repairMissingFulfillment, repairPendingRefunds } from "./utils/checkoutFulfillment.utils.js";
import { BookingDateLock } from "./models/bookingDateLock.models.js";
import { EmailOtpCooldown } from "./models/emailOtpCooldown.models.js";
import { WalletTransaction } from "./models/walletTransaction.models.js";
import { Withdrawal } from "./models/withdrawal.models.js";
import { RateLimitBucket } from "./models/rateLimitBucket.models.js";
import { User } from "./models/user.models.js";
import { Availability } from "./models/availability.models.js";
import { Booking } from "./models/booking.models.js";


const PORT = process.env.PORT || 5000;

const app = express();
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isInteger(trustProxyHops) && trustProxyHops > 0 && trustProxyHops <= 5) {
    app.set("trust proxy", trustProxyHops);
}

// middlewares
app.use(cors());
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), receiveStripeWebhook);
app.use(express.json());



// routes
app.get("/", (req, res) => {
    res.send("api is working");
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/integrations", integrationRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/public", publicRoutes);
app.use("/public", publicRoutes);

const server = http.createServer(app);
server.on("error", (error) => {
    if(error.code === "EADDRINUSE"){
        console.error(`PORT ${PORT} is already in use`);
        process.exit(1);
    }

    throw error;
});

const start = async () => {
    await connectDb();
    await Promise.all([
        BookingDateLock.createIndexes(),
        EmailOtpCooldown.createIndexes(),
        WalletTransaction.createIndexes(),
        Withdrawal.createIndexes(),
        RateLimitBucket.createIndexes(),
        User.createIndexes(),
        Availability.createIndexes(),
        Booking.createIndexes()
    ]);

    let repairRunning = false;
    const runRepair = async () => {
        if (repairRunning) return;
        repairRunning = true;
        try {
            await repairMissingFulfillment();
            await repairPendingRefunds();
        } catch (error) {
            console.error("Booking fulfillment repair failed:", error);
        } finally {
            repairRunning = false;
        }
    };
    void runRepair();
    setInterval(runRepair, 5 * 60 * 1000).unref();

    server.listen(PORT, () => {
        console.log(`server started on http://localhost:${PORT}`);
    });
};

start().catch(async (error) => {
    console.error("Server startup failed:", error);
    await mongoose.disconnect();
    process.exit(1);
});
