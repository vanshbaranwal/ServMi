import express from "express";
import { getAdminDashboard, loginAdmin, updateWithdrawalStatus } from "../controllers/admin.controller.js";
import adminAuth from "../middleware/adminAuth.middleware.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";

const router = express.Router();


router.post("/login", rateLimit({ scope: "admin-login", limit: 20, windowMs: 15 * 60 * 1000 }), loginAdmin);
router.get("/dashboard", adminAuth, getAdminDashboard);
router.patch("/withdrawals/:id", adminAuth, updateWithdrawalStatus);


export default router;
