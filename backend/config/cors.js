const normalizeOrigin = (value = "") => String(value).trim().replace(/\/$/, "");

const getAllowedOrigins = () => {
  const origins = new Set();

  const clientUrl = normalizeOrigin(process.env.CLIENT_URL);
  if (clientUrl) origins.add(clientUrl);

  const extra = process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGINS || "";
  for (const part of extra.split(",")) {
    const origin = normalizeOrigin(part);
    if (origin) origins.add(origin);
  }

  // Common Vercel preview pattern when CLIENT_URL is the production domain only
  if (process.env.VERCEL_URL) {
    origins.add(normalizeOrigin(`https://${process.env.VERCEL_URL}`));
  }

  return [...origins];
};

const createCorsOptions = () => {
  const allowedOrigins = getAllowedOrigins();

  return {
    origin(origin, callback) {
      // Same-origin tools, server-to-server, mobile apps
      if (!origin) {
        return callback(null, true);
      }

      const normalized = normalizeOrigin(origin);

      if (allowedOrigins.length === 0) {
        console.warn(
          `CORS: allowing ${origin} because no CLIENT_URL is configured`,
        );
        return callback(null, true);
      }

      if (allowedOrigins.includes(normalized)) {
        return callback(null, true);
      }

      console.warn(
        `CORS blocked origin: ${origin} (allowed: ${allowedOrigins.join(", ")})`,
      );
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  };
};

const logCorsConfig = () => {
  const origins = getAllowedOrigins();
  if (origins.length === 0) {
    console.warn(
      "⚠️  CLIENT_URL is not set — CORS will allow all origins (not recommended for production)",
    );
    return;
  }
  console.log(`✅ CORS allowed origins: ${origins.join(", ")}`);
};

module.exports = {
  getAllowedOrigins,
  createCorsOptions,
  logCorsConfig,
};
