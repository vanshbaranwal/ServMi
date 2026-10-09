import Booking from "../models/booking.models.js";
import Service from "../models/service.models.js";
import User from "../models/user.models.js";
import { buildCustomerCalendarUrl } from "../utils/calendarLink.utils.js";
import { createBookingCalendarEvent } from "../utils/googleCalendar.utils.js";
import { sendBookingNotification } from "../utils/bookingNotifications.utils.js";
import { requestEmailOtp, verifyEmailOtp } from "../utils/emailOtp.utils.js";
import { generateSlots } from "../utils/slotGenerator.utils.js";
import { getStripe, toStripeAmount } from "../utils/stripe.utils.js";
import { calculatePlatformSplit } from "../utils/money.utils.js";
import { timeOverlap } from "../utils/overlap.utils.js";
import { createBookingPayoutTransaction } from "../utils/wallet.utils.js";


const getBusinessBySlug = async(slug) => {
    return User.findOne({ slug }).select("-password");
};

const toPublicBusiness = (business) => ({
    id: business._id,
    name: business.name,
    slug: business.slug,
    businessName: business.businessName,
    businessDescription: business.businessDescription,
    brandTheme: business.brandTheme,
    brandAccount: business.brandAccount,
    timezone: business.timezone,
    googleCalendarConnected: business.googleCalendarConnected
});

const holdWindowStart = () => Date(Date.now() - 30 * 60 * 1000);

const findActiveSlotBookings = ({ userId, date }) => {
    return Booking.find({
        userId,
        date,
        $or: [
            { status: "confirmed" },
            { 
                status: "pending_payment",
                createdAt: { $gte: holdWindowStart() }
            }
        ]
    });
};

export const getPublicBusiness = async(req, res) => {
    try {
        const business = await getBusinessBySlug(req.params.slug);

        if(!business){
            return res.status(404).json({
                success: false,
                message: "business not found"
            });
        }

        const services = await Service.find({
            userId: business._id,
            isActive: true,
            isDeleted: { $ne: true }
        }).sort({ name: 1 });

        res.json({ business: toPublicBusiness(business), services });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "server error",
            error: error.message
        });
    }
};

export const getPublicSlots = async(req, res) => {
    try {
        const { date, serviceId } = req.query;

        if(!date || !serviceId){
            return res.status(400).json({
                success: false,
                message: "date and services are required"
            });
        }

        const business = await getBusinessBySlug(req.params.slug);

        if(!business){
            return res.status(404).json({
                success: false,
                message: "business not found"
            });
        }

        const service = await Service.findOne({
            _id: serviceId,
            userId: business._id,
            isActive: true,
            isDeleted: { $ne: true }
        });

        if(!service){
            return res.status(404).json({
                success: false,
                message: "service not found"
            });
        }

        const slots = await generateSlots({ userId: business._id, service, date });

        res.json({ slots });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "server error",
            error: error.message
        });
    }
};

