import crypto from "node:crypto";

export const hashBookingAccessToken = (token) => (
    crypto.createHash("sha256").update(token).digest("hex")
);

export const createBookingAccessToken = (booking) => {
    const secret = process.env.JWT_SECRET;
    if (!secret || !booking?._id || !booking?.customerEmail) return "";
    return crypto
        .createHmac("sha256", secret)
        .update(`${booking._id}:${String(booking.customerEmail).toLowerCase()}`)
        .digest("base64url");
};

export const hasBookingAccess = (booking, token) => {
    if (typeof token !== "string" || !token || !booking?.accessTokenHash) return false;
    const expected = Buffer.from(booking.accessTokenHash, "hex");
    const actual = Buffer.from(hashBookingAccessToken(token), "hex");
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

export const getBookingManageUrl = (booking, businessSlug) => {
    const token = createBookingAccessToken(booking);
    if (!token || hashBookingAccessToken(token) !== booking?.accessTokenHash) return "";
    const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
    const query = new URLSearchParams({
        booking_id: String(booking._id),
        access_token: token,
        slug: businessSlug || ""
    });
    return `${clientUrl}/booking/manage?${query}`;
};
