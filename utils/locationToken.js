const crypto = require("crypto");

const LOCATION_TOKEN_PURPOSE = "job-location-selection";
const LOCATION_TOKEN_VERSION = 1;
const DEFAULT_TOKEN_TTL_SECONDS = 1800;
const SUPPORTED_LOCATION_TYPES = new Set([
  "city", "county", "region", "country",
]);

class LocationTokenError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "LocationTokenError";
    this.code = code;
  }
}

const requireSecret = (secret) => {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new LocationTokenError(
      "Location token signing secret is not configured securely.",
      "MISSING_SIGNING_SECRET"
    );
  }
  return secret;
};

const assertLocationTokenConfiguration = (
  secret = process.env.LOCATION_TOKEN_SECRET
) => {
  requireSecret(secret);
};

const encode = (value) =>
  Buffer.from(value, "utf8").toString("base64url");

const sign = (encodedPayload, secret) =>
  crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

const createLocationToken = (
  { providerPlaceId, locationType },
  {
    secret = process.env.LOCATION_TOKEN_SECRET,
    ttlSeconds = DEFAULT_TOKEN_TTL_SECONDS,
    now = Date.now(),
  } = {}
) => {
  requireSecret(secret);

  if (typeof providerPlaceId !== "string" || !providerPlaceId.trim()) {
    throw new LocationTokenError("A provider place ID is required.", "INVALID_PAYLOAD");
  }
  if (!SUPPORTED_LOCATION_TYPES.has(locationType)) {
    throw new LocationTokenError("Location type is not supported.", "INVALID_PAYLOAD");
  }
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 1800) {
    throw new LocationTokenError("Location token lifetime is invalid.", "INVALID_TTL");
  }

  const payload = {
    pid: providerPlaceId.trim(),
    type: locationType,
    exp: Math.floor(now / 1000) + ttlSeconds,
    purpose: LOCATION_TOKEN_PURPOSE,
    ver: LOCATION_TOKEN_VERSION,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
};

const verifyLocationToken = (
  token,
  {
    secret = process.env.LOCATION_TOKEN_SECRET,
    now = Date.now(),
  } = {}
) => {
  requireSecret(secret);

  if (typeof token !== "string" || token.length > 2048) {
    throw new LocationTokenError("Location token is invalid.", "INVALID_TOKEN");
  }

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new LocationTokenError("Location token is invalid.", "INVALID_TOKEN");
  }

  const expectedSignature = Buffer.from(sign(parts[0], secret), "base64url");
  const suppliedSignature = Buffer.from(parts[1], "base64url");
  if (expectedSignature.length !== suppliedSignature.length ||
      !crypto.timingSafeEqual(expectedSignature, suppliedSignature)) {
    throw new LocationTokenError("Location token signature is invalid.", "INVALID_TOKEN");
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    throw new LocationTokenError("Location token payload is invalid.", "INVALID_TOKEN");
  }

  if (!payload || typeof payload !== "object" ||
      typeof payload.pid !== "string" || !payload.pid.trim() ||
      !SUPPORTED_LOCATION_TYPES.has(payload.type) ||
      payload.purpose !== LOCATION_TOKEN_PURPOSE ||
      payload.ver !== LOCATION_TOKEN_VERSION ||
      !Number.isInteger(payload.exp)) {
    throw new LocationTokenError("Location token payload is invalid.", "INVALID_TOKEN");
  }

  if (payload.exp <= Math.floor(now / 1000)) {
    throw new LocationTokenError("Location token has expired.", "EXPIRED_TOKEN");
  }

  return {
    providerPlaceId: payload.pid,
    locationType: payload.type,
    expiresAt: payload.exp,
  };
};

module.exports = {
  LocationTokenError,
  assertLocationTokenConfiguration,
  createLocationToken,
  verifyLocationToken,
};
