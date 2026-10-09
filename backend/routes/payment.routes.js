import express from "express";
import { getPaymentOverview, requestWithdrawal, updatePayoutDetails } from "../controllers/payment.controller.js";
import auth from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", auth, getPaymentOverview);
router.get("/payout-details", auth, updatePayoutDetails);
router.get("/withdrawls", auth, requestWithdrawal); 



export default router;