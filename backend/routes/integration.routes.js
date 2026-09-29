import express from "express";
import { getGoogleConnectUrl, handleGoogleCallback } from "../controllers/integration.controller.js";
import auth from "../middleware/auth.middleware.js";



const router = express.Router();



router.get("/google/connect", auth, getGoogleConnectUrl);
router.get("/google/callback", handleGoogleCallback);



export default router;