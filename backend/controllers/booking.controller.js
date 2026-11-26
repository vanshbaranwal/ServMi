import { Booking } from '../models/booking.models.js';
import { Availability } from '../models/availability.models.js';
import { Service } from '../models/service.models.js';
import { User } from '../models/user.models.js';
import { buildCustomerCalendarUrl } from '../utils/calendarLink.utils.js';
import { cancelBookingCalendarEvent, updateBookingCalendarEvent } from '../utils/googleCalendar.utils.js';
import { sendBookingNotification } from '../utils/bookingNotifications.utils.js';
import { withBookingDateLock } from '../utils/bookingDateLock.utils.js';
import { timeOverlap } from '../utils/overlap.utils.js';
import { getDayOfWeek, isValidTimeRange, timeToMinutes } from '../utils/time.utils.js';
import { requestBookingRefund } from '../utils/checkoutFulfillment.utils.js';

const canChangeFreeBooking = (booking) => (
  ['pending', 'confirmed'].includes(booking.status)
  && booking.paymentStatus === 'not_required'
  && Number(booking.amount || 0) === 0
  && booking.payoutStatus === 'not_required'
  && !booking.stripeSessionId
);

const canRescheduleBooking = (booking) => (
  booking.status === 'confirmed'
  && !booking.paymentReviewRequired
  && (
    canChangeFreeBooking(booking)
    || (booking.paymentStatus === 'paid' && Number(booking.amount || 0) > 0 && Boolean(booking.stripeSessionId))
  )
);

const isValidDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
};

const isValidClockTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const businessClock = (business) => {
  const partsFor = (timeZone) => new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  let parts;
  try {
    parts = partsFor(business.timezone || 'Asia/Kolkata');
  } catch {
    parts = partsFor('Asia/Kolkata');
  }
  const part = (type) => parts.find((entry) => entry.type === type)?.value;
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    minute: Number(part('hour')) * 60 + Number(part('minute')),
  };
};

/**
 * Retrieves a list of bookings for the authenticated user based on query parameters.
 * Filters can include booking status and date.
 * Populates service details and appends a customer Google Calendar URL if available.
 * 
 * @param {Object} req - Express request object containing user ID and query parameters.
 * @param {Object} res - Express response object.
 */
export const listBookings = async (req, res) => {
  try {
    const query = { userId: req.user.id };

    if (req.query.status) {
      if (req.query.status === 'rescheduled') {
        query.isRescheduled = true;
      } else {
        query.status = req.query.status;
      }
    }
    if (!req.query.status || req.query.status === 'rescheduled') {
      query.status = { $nin: ['pending_payment', 'payment_failed'] };
    }
    if (req.query.date) query.date = req.query.date;

    const [bookings, business] = await Promise.all([
      Booking.find(query)
        .populate('serviceId', 'name duration price')
        .sort({ createdAt: -1 })
        .lean(),
      User.findById(req.user.id).select('name businessName').lean(),
    ]);

    const bookingsWithCalendarUrls = bookings.map((booking) => {
      if (booking.customerCalendarUrl || !business || !booking.serviceId) {
        return booking;
      }

      return {
        ...booking,
        customerCalendarUrl: buildCustomerCalendarUrl({
          business,
          service: booking.serviceId,
          booking,
        }),
      };
    });

    res.json({ bookings: bookingsWithCalendarUrls });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Cancels an unpaid booking and notifies the customer.
 * 
 * @param {Object} req - Express request object containing booking ID in params and new status in body.
 * @param {Object} res - Express response object.
 */
export const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body || {};

    if (status !== 'cancelled') {
      return res.status(400).json({ message: 'Only cancellation is supported here' });
    }

    const currentBooking = await Booking.findOne({ _id: req.params.id, userId: req.user.id });
    if (!currentBooking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const isPaidBooking = currentBooking.status === 'confirmed'
      && currentBooking.paymentStatus === 'paid'
      && Number(currentBooking.amount || 0) > 0;
    if (!canChangeFreeBooking(currentBooking) && !isPaidBooking) {
      return res.status(409).json({ message: 'This booking cannot be cancelled in its current state.' });
    }

    let booking;
    if (isPaidBooking) {
      booking = await requestBookingRefund({ booking: currentBooking, reason: 'provider_cancelled' });
      booking = await booking.populate('serviceId', 'name duration price');
    } else {
      booking = await Booking.findOneAndUpdate(
      {
        _id: currentBooking._id,
        userId: req.user.id,
        status: currentBooking.status,
        paymentStatus: 'not_required',
        amount: 0,
        payoutStatus: 'not_required',
        stripeSessionId: { $in: ['', null] },
      },
      { $set: { status: 'cancelled' } },
      { new: true }
    ).populate('serviceId', 'name duration price');
    }

    if (!booking) {
      return res.status(409).json({ message: 'Booking changed. Refresh and try again.' });
    }

    const business = await User.findById(req.user.id);
    if (business) {
      try {
        await cancelBookingCalendarEvent({ business, booking });
      } catch (calendarError) {
        console.error('Google Calendar cancellation failed:', calendarError.message);
      }
    }

    let emailResult = null;
    if (business && booking.serviceId) {
      emailResult = { sent: 'processing' };
      sendBookingNotification({
        business,
        service: booking.serviceId,
        booking,
        type: 'cancelled',
      }).catch(emailError => console.error('Booking status email failed:', emailError.message));
    }

    res.json({ message: 'Booking updated', booking, email: emailResult });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Server error' });
  }
};

/**
 * Reschedules an existing booking to a new date and time slot.
 * Validates the service duration, weekly availability, and active slot holds.
 * Updates the existing Google Calendar event and sends a reschedule notification email.
 * 
 * @param {Object} req - Express request object containing booking ID in params and new date/time in body.
 * @param {Object} res - Express response object.
 */
export const rescheduleBooking = async (req, res) => {
  try {
    const { date, startTime, endTime } = req.body || {};

    if (!isValidDate(date) || !isValidClockTime(startTime) || !isValidClockTime(endTime)
      || !isValidTimeRange(startTime, endTime)) {
      return res.status(400).json({ message: 'A valid date and time range are required' });
    }

    const booking = await Booking.findOne({ _id: req.params.id, userId: req.user.id });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (!canRescheduleBooking(booking)) {
      return res.status(409).json({
        message: 'This booking cannot be rescheduled while its payment or booking status is under review.',
      });
    }

    const [business, service] = await Promise.all([
      User.findById(req.user.id),
      Service.findOne({ _id: booking.serviceId, userId: req.user.id, isDeleted: { $ne: true } }),
    ]);

    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    if (!service) {
      return res.status(409).json({ message: 'The booked service is no longer available' });
    }

    if (timeToMinutes(endTime) - timeToMinutes(startTime) !== service.duration) {
      return res.status(400).json({ message: 'The new time must match the service duration' });
    }

    const result = await withBookingDateLock({
      userId: req.user.id,
      date,
      work: async () => {
        const clock = businessClock(business);
        if (date < clock.date || (date === clock.date && timeToMinutes(startTime) <= clock.minute)) {
          return { error: 'Choose a future date and time', status: 400 };
        }

        const availability = await Availability.findOne({
          userId: req.user.id,
          dayOfWeek: getDayOfWeek(date),
        });
        const withinAvailability = availability?.slots?.some((slot) => (
          timeToMinutes(startTime) >= timeToMinutes(slot.startTime)
          && timeToMinutes(endTime) <= timeToMinutes(slot.endTime)
          && (timeToMinutes(startTime) - timeToMinutes(slot.startTime)) % service.duration === 0
        ));
        if (!withinAvailability) return { error: 'The selected time is outside your availability', status: 409 };

        const now = new Date();
        const conflictingBookings = await Booking.find({
          _id: { $ne: booking._id },
          userId: req.user.id,
          date,
          $or: [
            { status: 'confirmed' },
            {
              status: 'pending_payment',
              $or: [
                { holdExpiresAt: { $gt: now } },
                {
                  holdExpiresAt: { $exists: false },
                  createdAt: { $gte: new Date(now.getTime() - 30 * 60 * 1000) },
                },
              ],
            },
          ],
        });

        const hasConflict = conflictingBookings.some((candidate) => (
          timeOverlap(startTime, endTime, candidate.startTime, candidate.endTime)
        ));
        if (hasConflict) return { error: 'That slot is already booked' };

        const updatedBooking = await Booking.findOneAndUpdate(
          {
            _id: booking._id,
            userId: req.user.id,
            status: booking.status,
            paymentStatus: booking.paymentStatus,
            amount: booking.amount,
            payoutStatus: booking.payoutStatus,
            stripeSessionId: booking.stripeSessionId,
            paymentReviewRequired: { $ne: true },
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
          },
          {
            $set: {
              date, startTime, endTime, isRescheduled: true,
              reminderSent: false, reminderSentAt: null, reminderLeaseUntil: null,
            },
            $inc: { rescheduleCount: 1 },
          },
          { new: true }
        );
        if (!updatedBooking) return { error: 'Booking changed. Refresh and try again.' };

        return { updatedBooking };
      },
    });

    if (result.error) {
      return res.status(result.status || 409).json({ message: result.error });
    }

    const { updatedBooking } = result;
    const isCurrentReschedule = (current) => current
      && current.status === updatedBooking.status
      && current.date === date
      && current.startTime === startTime
      && current.endTime === endTime
      && current.rescheduleCount === updatedBooking.rescheduleCount;

    const beforeCalendar = await Booking.findById(updatedBooking._id);
    if (!isCurrentReschedule(beforeCalendar)) {
      return res.status(409).json({ message: 'Booking changed during reschedule. Refresh and try again.' });
    }

    if (business && service) {
      try {
        const calendarResult = await updateBookingCalendarEvent({ business, service, booking: updatedBooking });
        const googleEventId = calendarResult.googleEventId || updatedBooking.googleEventId || '';
        const metadataUpdate = await Booking.updateOne(
          {
            _id: updatedBooking._id,
            status: updatedBooking.status,
            date, startTime, endTime,
            rescheduleCount: updatedBooking.rescheduleCount,
          },
          { $set: {
            googleEventId,
            customerCalendarUrl: calendarResult.customerCalendarUrl || updatedBooking.customerCalendarUrl,
          } }
        );
        if (!metadataUpdate.matchedCount) {
          const current = await Booking.findById(updatedBooking._id);
          if (current?.status === 'cancelled' && googleEventId) {
            await cancelBookingCalendarEvent({
              business,
              booking: { ...updatedBooking.toObject(), googleEventId },
            });
          }
          return res.status(409).json({ message: 'Booking changed during reschedule. Refresh and try again.' });
        }
      } catch (calendarError) {
        console.error('Google Calendar reschedule failed:', calendarError.message);
      }
    }

    const populatedBooking = await Booking.findById(updatedBooking._id).populate('serviceId', 'name duration price');
    if (!isCurrentReschedule(populatedBooking)) {
      return res.status(409).json({ message: 'Booking changed during reschedule. Refresh and try again.' });
    }

    let emailResult = null;
    if (business && service) {
      emailResult = { sent: 'processing' };
      sendBookingNotification({ business, service, booking: populatedBooking, type: 'rescheduled' })
        .catch(emailError => console.error('Booking reschedule email failed:', emailError.message));
    }

    res.json({ message: 'Booking rescheduled', booking: populatedBooking, email: emailResult });
  } catch (error) {
    if (error.statusCode === 503) {
      return res.status(503).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
