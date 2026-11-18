import express from "express";
import { cancelPublicBookingPayment, createPublicBooking, getBookingStatus, getPublicBusiness, getPublicSlots, requestPublicBookingOtp, verifyPublicBookingOtp } from "../controllers/public.controller.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";



const router = express.Router();


router.get("/booking/status", getBookingStatus);
router.post("/booking/cancel-payment", cancelPublicBookingPayment);
router.get("/:slug", getPublicBusiness);
router.get("/:slug/slots", getPublicSlots);
router.post("/:slug/request-otp", rateLimit({ scope: "booking-otp", limit: 100, windowMs: 15 * 60 * 1000 }), requestPublicBookingOtp);
router.post("/:slug/verify-otp", verifyPublicBookingOtp);
router.post("/:slug/book", createPublicBooking);


export default router;
