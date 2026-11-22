const DEVELOPMENT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173"
];

const normalizeOrigin = (value) => String(value || "").trim().replace(/\/+$/, "");

export const getAllowedOrigins = (env = process.env) => {
    const configured = [env.CLIENT_URL, ...(env.CORS_ORIGINS || "").split(",")]
        .map(normalizeOrigin)
        .filter(Boolean);
    const development = env.NODE_ENV === "production" ? [] : DEVELOPMENT_ORIGINS;

    return [...new Set([...configured, ...development])];
};

export const isCorsOriginAllowed = (origin, env = process.env) => (
    !origin || getAllowedOrigins(env).includes(normalizeOrigin(origin))
);

export const getIntegrationStatus = (env = process.env) => ({
    email: Boolean(env.BREVO_API_KEY && (env.BREVO_SENDER_EMAIL || env.EMAIL_FROM)),
    payments: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
    googleCalendar: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URL)
});

export const getCoreConfigErrors = (env = process.env) => {
    const errors = [];
    if (!env.MONGO_URL) errors.push("MONGO_URL is required");
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
        errors.push("JWT_SECRET must contain at least 32 characters");
    }
    if (env.NODE_ENV === "production" && !env.CLIENT_URL) {
        errors.push("CLIENT_URL is required in production");
    }
    return errors;
};
