const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  createLocationToken,
  verifyLocationToken,
} = require("../utils/locationToken");

const secret = "a-dedicated-test-secret-that-is-long-enough";
const now = Date.UTC(2026, 9, 23, 12, 0, 0);

test("accepts a default location token before its 30-minute expiry", () => {
  const token = createLocationToken({
    providerPlaceId: "geoapify-place-id",
    locationType: "region",
  }, { secret, now });

  assert.deepEqual(verifyLocationToken(token, {
    secret,
    now: now + (1799 * 1000),
  }), {
    providerPlaceId: "geoapify-place-id",
    locationType: "region",
    expiresAt: Math.floor(now / 1000) + 1800,
  });
});

test("rejects a default location token after 30 minutes", () => {
  const token = createLocationToken({
    providerPlaceId: "geoapify-place-id",
    locationType: "city",
  }, { secret, now });

  assert.throws(
    () => verifyLocationToken(token, { secret, now: now + (1800 * 1000) }),
    (error) => error.code === "EXPIRED_TOKEN"
  );
});

test("rejects a modified location token", () => {
  const token = createLocationToken({
    providerPlaceId: "geoapify-place-id",
    locationType: "city",
  }, { secret, now });
  const [payload, signature] = token.split(".");

  assert.throws(
    () => verifyLocationToken(`${payload}x.${signature}`, { secret, now }),
    (error) => error.code === "INVALID_TOKEN"
  );
});

test("rejects unsupported types, unsafe secrets and invalid lifetimes", () => {
  assert.throws(
    () => createLocationToken({ providerPlaceId: "id", locationType: "district" }, { secret }),
    (error) => error.code === "INVALID_PAYLOAD"
  );
  assert.throws(
    () => createLocationToken({ providerPlaceId: "id", locationType: "city" }, { secret: "short" }),
    (error) => error.code === "MISSING_SIGNING_SECRET"
  );
  assert.throws(
    () => createLocationToken({ providerPlaceId: "id", locationType: "city" }, {
      secret, ttlSeconds: 10,
    }),
    (error) => error.code === "INVALID_TTL"
  );
});
