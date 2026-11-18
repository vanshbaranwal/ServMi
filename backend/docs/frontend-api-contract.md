# Frontend API contract

Use `/api` as the base path. JSON responses on errors contain `message`; most also contain `success: false`. Amounts returned for bookings and wallets are **integer paise**. `service.price` is entered in rupees and converted to paise when a booking is created.

## Provider account

| Action | Request | Success response |
| --- | --- | --- |
| Request registration code | `POST /api/auth/register/request-otp` `{ email }` | `{ message, result: { sent, email, expiresInMinutes } }` |
| Check registration code | `POST /api/auth/register/verify-otp` `{ email, emailOtp }` | `{ message }` |
| Register | `POST /api/auth/register` `{ name, email, password, businessName?, businessDescription?, timezone?, emailOtp }` | `{ success, token, user }` |
| Log in | `POST /api/auth/login` `{ email, password }` | `{ token, user }` |
| Load account | `GET /api/auth/me` with `Authorization: Bearer <token>` | `{ user }` |
| Update public profile | `PATCH /api/auth/profile` with editable business fields | `{ message, user }` |

The provider's public `slug` is returned in `user` and remains stable when the business name changes. Protected service, availability, booking, integration, and payment routes use the same Bearer token. OTP codes expire after 10 minutes, are limited to five incorrect attempts, and requests for the same email and purpose have a 60 second cooldown (`429`). OTP routes also limit requests per IP over 15 minutes. Services must have an integer duration of at least five minutes; prices must be free or between ₹0.50 and ₹9,999,999.99 with at most two decimal places. Availability windows use 24-hour `HH:mm` times, cannot overlap, and can be cleared by sending an empty `slots` array.

## Guest booking

| Action | Request | Success response |
| --- | --- | --- |
| Load booking page | `GET /api/public/:slug` | `{ business, services }` |
| List slots | `GET /api/public/:slug/slots?date=YYYY-MM-DD&serviceId=<id>` | `{ slots: [{ startTime, endTime }] }` |
| Request booking code | `POST /api/public/:slug/request-otp` `{ customerEmail }` | `{ success, message, result }` |
| Check booking code | `POST /api/public/:slug/verify-otp` `{ customerEmail, emailOtp }` | `{ success, message }` |
| Create booking | `POST /api/public/:slug/book` `{ serviceId, customerName, customerEmail, date, startTime, endTime, emailOtp, notes?, customerAvatar? }` | Free: `{ success, message, booking, accessToken }`; paid: `{ success, message, bookingId, checkoutUrl, accessToken }` |
| Read status | `GET /api/public/booking/status?session_id=<id>&access_token=<token>` or use `booking_id` in place of `session_id` | `{ success, booking }` |
| Leave an unpaid Checkout | `POST /api/public/booking/cancel-payment` `{ booking_id, access_token }` | `{ success, message, booking }` when the Checkout session has expired |

`accessToken` is a private booking credential. Keep it with the booking ID or Checkout session ID. Stripe's success and cancel redirects also contain `access_token` in their query string. The success page should read status with `session_id` and the token. The cancel page should call `cancel-payment` with `booking_id` and the token, then show the returned result. Remove these credentials from the browser address bar after reading them, and avoid sending them to analytics.

`business.paymentsAvailable` tells the page whether paid Checkout can start. When false, keep paid services visible but disable payment submission with a clear explanation; free bookings still work.

The booking endpoint accepts only a slot returned by current weekly availability, including the service duration and active holds. A paid booking reserves its slot while Checkout is open; Checkout expires after about 32 minutes and its hold after about 35 minutes. An open or processing Checkout remains `pending_payment` when status is read. The server also confirms payments through a Stripe webhook, so the booking does not depend on a browser return.

### Booking states for the UI

| `booking.status` / `booking.paymentStatus` | UI state |
| --- | --- |
| `confirmed` / `not_required` | Free booking confirmed |
| `pending_payment` / `pending` | Awaiting or processing Checkout payment |
| `confirmed` / `paid` | Paid booking confirmed |
| `payment_failed` / `failed` | Checkout expired or failed |
| `payment_failed` / `refund_pending` | A paid booking could not be fulfilled; refund is in progress |
| `payment_failed` / `refunded` | Refund completed |
| `payment_failed` / `refund_failed` | Refund failed and needs support review |
| `cancelled` / `not_required` | Free booking cancelled by provider |

Booking status returns the guest-facing fields: `_id`, `serviceId`, customer name/email/avatar, date, start/end time, notes, status, payment status, amount/currency, calendar URL, and creation time. The token hash, Stripe IDs, and provider wallet amounts are not returned.

If `booking.paymentReviewRequired` is true, show a support or review state even if the booking is otherwise marked paid. This flag is set when Stripe reports an external refund or dispute that needs manual wallet reconciliation.

## Provider bookings and wallet

Provider bookings: `GET /api/bookings` lists bookings, with optional `date` or `status` filters. `PATCH /api/bookings/:id` with `{ status: "cancelled" }` cancels a free booking. `PATCH /api/bookings/:id/reschedule` with `{ date, startTime, endTime }` reschedules a free booking if the new service slot is available. Paid booking cancellation and rescheduling currently return `409` because they require a complete refund and wallet reversal policy.

Wallet: `GET /api/payments` returns `{ payoutDetails, wallet, transactions, withdrawals }`. Wallet fields are `earned`, `withdrawnOrPending`, `pendingWithdrawals`, `paidWithdrawals`, `available`, and `underReview`. When `underReview` is true, `available` is zero and withdrawal requests return `409` until an external Stripe refund or dispute is reconciled. `PUT /api/payments/payout-details` accepts `{ accountHolderName, upiId, bankName?, accountNumber?, ifsc? }`. A valid UPI ID is required for withdrawals. Only the last four digits of a bank account are retained; bank-only payout details cannot authorize withdrawals. `POST /api/payments/withdrawals` accepts `{ amount }` as an integer number of paise, minimum 100. Send an `Idempotency-Key` header containing a UUID or other 8–128 character key and reuse it when retrying the same request. A new withdrawal returns `201`, an identical retry returns `200`, and reusing a key for a different amount returns `409`.

## Admin

`POST /api/admin/login` with `{ email, password }` returns `{ token, admin }`. Send that token as `Authorization: Bearer <token>` to `GET /api/admin/dashboard` and `PATCH /api/admin/withdrawals/:id` with `{ status, adminNote?, transferReference? }`. Marking a withdrawal `paid` requires a transfer reference of at least six characters, a usable UPI destination, and no unresolved provider payment reviews. Withdrawal statuses are `pending`, `processing`, `paid`, and `rejected`. Terminal `paid`/`rejected` requests cannot be changed. The dashboard includes `summary`, `users`, `withdrawals`, `recentBookings`, and `paymentReviews`. In `summary`, `providerPayouts` is the expected payout from paid bookings, `walletEarned` is the posted ledger amount, `payoutLedgerDifference` exposes a mismatch, and `paymentReviews` counts external refund or dispute cases needing manual work. `withdrawalHolds` is the amount of pending or processing withdrawal requests.

## Errors and server setup

Handle `400` for invalid inputs, `401`/`403` for authentication, `404` for missing or inaccessible records, `409` for an unavailable slot or incompatible state, `429` for OTP cooldown, and `503` for a temporarily unavailable dependency or busy booking date. Keep the user's form values when a retry is possible. A `402` response is not used for an open Checkout session.

Configure `JWT_SECRET`, `MONGO_URL`, `CLIENT_URL`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` on the backend. Set `TRUST_PROXY_HOPS` to the actual number of trusted reverse proxies when deployed behind them, so IP request limits use the client IP. Register `POST /api/webhooks/stripe` in Stripe for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `refund.created`, `refund.updated`, `refund.failed`, `charge.dispute.created`, `charge.dispute.funds_withdrawn`, and `charge.dispute.closed`. Stripe signature verification needs the raw request body; this route is mounted before JSON parsing. Configure Brevo email credentials for OTP and booking emails. MongoDB must support transactions (Atlas or a replica set) for withdrawal requests and admin withdrawal decisions. The server creates its critical booking date lock, wallet transaction, OTP cooldown, request limit, and withdrawal request indexes before listening. If an index fails because legacy rows conflict, reconcile those rows before starting the server.
