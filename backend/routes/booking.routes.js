import express from 'express';
import { listBookings, rescheduleBooking, updateBookingStatus } from '../controllers/booking.controller.js';
import auth from '../middleware/auth.middleware.js';

const router = express.Router();


router.get('/', auth, listBookings);
router.patch('/:id', auth, updateBookingStatus);
router.patch('/:id/reschedule', auth, rescheduleBooking);


export default router;