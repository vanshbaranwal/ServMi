import { google } from "googleapis";
import { buildCustomerCalendarUrl } from "./calendarLink.utils.js";


const getOAuthClient = () => {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URL
    );
};

const isCalendarConnected = (business) => {
    return Boolean(business.googleCalendarConnected && business.googleRefreshToken);
};

const getCalendarClient = (business) => {
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({ refresh_token: business.googleRefreshToken });

    return google.calendar({ version: "v3", auth: oauth2Client });
};

const buildEventPayload = ({ business, service, booking }) => {
    const timeZone = business.timezone || "Asia/Kolkata";

    const description = [
        `Customer: ${booking.customerName}`,
        `Email: ${booking.customerEmail}`,
        booking.notes ? `Notes: ${booking.notes}` : ""
    ].filter(Boolean).join("\n");

    return {
        summary: `${service.name} - ${booking.customerName}`,
        description,
        start: {
            dateTime: `${booking.date}T${booking.startTime}:00`,
            timeZone
        },
        end: {
            dateTime: `${booking.date}T${booking.endTime}:00`,
            timeZone
        },
        attendees: [{ email: booking.customerEmail }],
        reminders: {
            useDefault: false,
            overrides: [
                { method: "email", minutes: 24 * 60 },
                { method: "popup", minutes: 30 }
            ]
        }
    };
};


export const getGoogleAuthUrl = (userId) => {
    const oauth2Client = getOAuthClient();

    return oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: ["https://www.googleapis.com/auth/calendar.events"],
        state: String(userId)
    });
};

export const getGoogleTokens = async (code) => {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    return tokens;
};

export const createBookingCalendarEvent = async ({ business, service, booking }) => {
    const customerCalendarUrl = buildCustomerCalendarUrl({ business, service, booking });

    if (!isCalendarConnected(business)) {
        return { customerCalendarUrl };
    }

    const calendar = getCalendarClient(business);

    const { data } = await calendar.events.insert({
        calendarId: business.googleCalendarId || "primary",
        requestBody: buildEventPayload({ business, service, booking }),
        sendUpdates: "all"
    });

    return {
        googleEventId: data.id,
        customerCalendarUrl
    };
};

export const updateBookingCalendarEvent = async ({ business, service, booking }) => {
    const customerCalendarUrl = buildCustomerCalendarUrl({ business, service, booking });

    if (!isCalendarConnected(business)) {
        return { customerCalendarUrl };
    }

    if (!booking.googleEventId) {
        return createBookingCalendarEvent({ business, service, booking });
    }

    const calendar = getCalendarClient(business);

    const { data } = await calendar.events.update({
        calendarId: business.googleCalendarId || "primary",
        eventId: booking.googleEventId,
        requestBody: buildEventPayload({ business, service, booking }),
        sendUpdates: "all"
    });

    return {
        googleEventId: data.id,
        customerCalendarUrl
    };
};

export const cancelBookingCalendarEvent = async ({ business, booking }) => {
    if (!isCalendarConnected(business) || !booking.googleEventId) {
        return false;
    }

    const calendar = getCalendarClient(business);

    try {
        await calendar.events.delete({
            calendarId: business.googleCalendarId || "primary",
            eventId: booking.googleEventId,
            sendUpdates: "all"
        });

        return true;
    } catch (error) {
        // event already deleted on Google's side
        if (error.code === 404 || error.code === 410) {
            return false;
        }

        throw error;
    }
};