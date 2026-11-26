import express from "express";
import { getMe, loginUser, registerUser, requestPasswordResetOTP, requestRegistrationOTP, resetPassword, updateProfile, verifyRegistrationOtp } from "../controllers/auth.controller.js";
import auth from "../middleware/auth.middleware.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";


const router = express.Router();


router.post("/register", registerUser);
router.post("/register/request-otp", rateLimit({ scope: "registration-otp", limit: 100, windowMs: 15 * 60 * 1000 }), requestRegistrationOTP);
router.post("/register/verify-otp", verifyRegistrationOtp);
router.post("/login", rateLimit({ scope: "provider-login", limit: 30, windowMs: 15 * 60 * 1000 }), loginUser);
router.post("/password/request-otp", rateLimit({ scope: "password-reset-otp", limit: 10, windowMs: 15 * 60 * 1000 }), requestPasswordResetOTP);
router.post("/password/reset", rateLimit({ scope: "password-reset", limit: 20, windowMs: 15 * 60 * 1000 }), resetPassword);
router.get("/me", auth, getMe);
router.patch("/profile", auth, updateProfile);


export default router;
