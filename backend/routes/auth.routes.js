import express from "express";
import { getMe, loginUser, registerUser, requestRegistrationOTP, updateProfile, verifyRegistrationOtp } from "../controllers/auth.controller.js";
import auth from "../middleware/auth.middleware.js";


const router = express.Router();


router.post("/register", registerUser);
router.post("/register/request-otp", requestRegistrationOTP);
router.post("/register/verify-otp", verifyRegistrationOtp);
router.post("/login", loginUser);
router.get("/me", auth, getMe);
router.patch("/profile", auth, updateProfile);


export default router;