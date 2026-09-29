import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";
import { getGoogleAuthUrl, getGoogleTokens } from "../utils/googleCalendar.utils.js";


const clientRedirect = (res, status) => {
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

    return res.redirect(`${clientUrl}/profile?calendar=${status}`);
};


export const getGoogleConnectUrl = async (req, res) => {
    try {

        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URL) {
            return res.status(503).json({
                success: false,
                message: "google calendar is not configured yet"
            });
        }

        // signed, short-lived state so the callback can't be forged for another user
        const state = jwt.sign(
            { id: req.user.id, purpose: "google-calendar" },
            process.env.JWT_SECRET,
            { expiresIn: "10m" }
        );

        return res.json({
            success: true,
            url: getGoogleAuthUrl(state)
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "server error",
            error: error.message
        });
    }
};

export const handleGoogleCallback = async (req, res) => {
    try {

        const { code, state } = req.query;

        if (!code || !state) {
            return clientRedirect(res, "failed");
        }

        let payload;

        try {
            payload = jwt.verify(state, process.env.JWT_SECRET);
        } catch {
            return clientRedirect(res, "failed");
        }

        if (payload.purpose !== "google-calendar") {
            return clientRedirect(res, "failed");
        }

        const tokens = await getGoogleTokens(code);

        if (!tokens.refresh_token) {
            return clientRedirect(res, "missing-refresh-token");
        }

        const user = await User.findByIdAndUpdate(payload.id, {
            googleRefreshToken: tokens.refresh_token,
            googleCalendarConnected: true,
            googleCalendarId: "primary"
        });

        if (!user) {
            return clientRedirect(res, "failed");
        }

        return clientRedirect(res, "connected");

    } catch (error) {
        return clientRedirect(res, "failed");
    }
};