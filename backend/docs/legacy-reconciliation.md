# Legacy Stripe booking reconciliation

Run this from `backend/` after configuring `MONGO_URL` and `STRIPE_SECRET_KEY`:

```sh
node scripts/reconcileLegacyBookings.js
```

The default is a read-only dry run. It examines bookings with a Stripe Checkout session and an old or missing `fulfillmentVersion`, then reports one JSON line per booking plus summary counts. It checks the Checkout amount and booking ID, the PaymentIntent, existing refunds and disputes, and wallet payout rows. Booking IDs are printed; customer emails and credentials are not.

Review every `manual_review` result before enabling withdrawals. The script does not repair refunds or disputes already present, mismatched payment amounts, inconsistent ledger entries, conflicting paid bookings, or paid pending bookings whose slot has passed. It also leaves provider balances with unlinked payout rows or paid withdrawals lacking matching holds for manual reconciliation. Old bank-only withdrawal snapshots need separate review. Bookings with no saved `stripeSessionId` are outside this audit and require a separate Stripe search.

After reviewing the dry run, use `node scripts/reconcileLegacyBookings.js --apply` to recheck candidates and make these limited repairs:

- Credit a confirmed, paid booking that has no refund, dispute, or existing payout row.
- Send an old `payment_failed` booking with a verified paid Checkout through the existing conflict refund flow.
- Confirm a paid pending booking only when its slot has no conflict; the existing date lock checks again during confirmation.
- Mark an unpaid, expired Checkout as failed.

The apply mode requires the unique booking payout and booking date lock indexes in MongoDB. It does not send old calendar invitations or confirmation emails. A payment or booking state that changes between inspection and application is skipped. Run the dry run again afterward and manually compare the results with Stripe and the admin `payoutLedgerDifference`. Pause manual Stripe refunds and provider withdrawals during reconciliation to reduce payment state races. The script does not run automatically during server startup.

This audit covers only pre-change Checkout bookings. Before paying out providers, separately reconcile newer bookings against Stripe Dashboard refunds and disputes; those external events are not covered by this script.
