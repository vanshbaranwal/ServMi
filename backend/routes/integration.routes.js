import express from "express";
import { disconnectGoogleCalendar, getGoogleConnectUrl, handleGoogleCallback } from "../controllers/integration.controller.js";
import auth from "../middleware/auth.middleware.js";



const router = express.Router();



router.get("/google/connect", auth, getGoogleConnectUrl);
router.get("/google/callback", handleGoogleCallback);
router.delete("/google", auth, disconnectGoogleCalendar);



export default router;
