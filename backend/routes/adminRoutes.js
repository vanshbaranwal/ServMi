import express from "express";
import { getAdminDashboard, loginAdmin, updateWithdrawalStatus } from "../controllers/admin.controller.js";
import adminAuth from "../middleware/adminAuth.middleware.js";

const router = express.Router();


router.post("/login", loginAdmin);
router.get("/dashboard", adminAuth, getAdminDashboard);
router.patch("/withdrawals/:id", adminAuth, updateWithdrawalStatus);


export default router;