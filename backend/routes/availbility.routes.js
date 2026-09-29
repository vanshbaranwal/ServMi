import express from "express";
import { listAvailability, saveAvailability } from "../controllers/availability.controller.js";
import auth from "../middleware/auth.middleware.js";


const router = express.Router();


router.get("/", auth, listAvailability);
router.put("/", auth, saveAvailability);


export default router;
