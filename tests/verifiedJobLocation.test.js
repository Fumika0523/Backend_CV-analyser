const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  createLocationToken,
  verifyLocationToken,
} = require("../utils/locationToken");
const {
  getVerifiedJobLocation,
} = require("../services/verifiedJobLocation");
const { GeoapifyLocationError } = require("../utils/geoapifyLocation");

const secret = "a-dedicated-test-secret-that-is-long-enough";
const now = Date.UTC(2026, 9, 24, 12, 0, 0);

const providerLocations = {
  city: {
    providerPlaceId: "city-id",
    displayName: "London, United Kingdom",
    city: "London",
    county: "Greater London",
    region: "England",
    country: "United Kingdom",
  },
  county: {
    providerPlaceId: "county-id",
    displayName: "Kent, United Kingdom",
    city: "",
    county: "Kent",
    region: "England",
    country: "United Kingdom",
  },
  region: {
    providerPlaceId: "region-id",
    displayName: "Scotland, United Kingdom",
    city: "",
    county: "",
    region: "Scotland",
    country: "United Kingdom",
  },
  country: {
    providerPlaceId: "country-id",
    displayName: "Canada",
    city: "",
    county: "",
    region: "",
    country: "Canada",
  },
};

const requestFor = (locationType, workMode, options = {}) => {
  const providerLocation = providerLocations[locationType];
  const token = createLocationToken({
    providerPlaceId: providerLocation.providerPlaceId,
    locationType,
  }, { secret, now });

  return {
    input: {
      location: {
        providerPlaceId: providerLocation.providerPlaceId,
        locationType,
        city: "browser values are ignored",
        country: "browser values are ignored",
      },
      locationToken: token,
      workMode,
    },
    dependencies: {
      verifyToken: (value) => verifyLocationToken(value, {
        secret,
        now: options.verificationTime ?? now,
      }),
      verifyPlace: async () => ({
        ...providerLocation,
        ...(options.providerOverrides || {}),
      }),
    },
  };
};

test("accepts verified city locations for Office, Hybrid and Remote jobs", async () => {
  for (const workMode of ["Office", "Hybrid", "Remote"]) {
    const { input, dependencies } = requestFor("city", workMode);
    const location = await getVerifiedJobLocation(input, dependencies);
    assert.deepEqual(location, {
      ...providerLocations.city,
      locationType: "city",
    });
  }
});

test("accepts verified county, region and country locations only for Remote jobs", async () => {
  for (const locationType of ["county", "region", "country"]) {
    const { input, dependencies } = requestFor(locationType, "Remote");
    const location = await getVerifiedJobLocation(input, dependencies);
    assert.equal(location.locationType, locationType);
    assert.equal(location.city, "");
  }
});

test("stores a country-wide Remote location without a fictional city", async () => {
  const { input, dependencies } = requestFor("country", "Remote");
  const location = await getVerifiedJobLocation(input, dependencies);
  assert.deepEqual(location, {
    city: "",
    country: "Canada",
    county: "",
    region: "",
    locationType: "country",
    displayName: "Canada",
    providerPlaceId: "country-id",
  });
});

test("uses the signed ID for lookup and accepts a matching response ID", async () => {
  const { input, dependencies } = requestFor("city", "Office");
  dependencies.verifyPlace = async (requestedId) => {
    assert.equal(requestedId, "city-id");
    return providerLocations.city;
  };

  const location = await getVerifiedJobLocation(input, dependencies);
  assert.equal(location.providerPlaceId, "city-id");
});

test("stores a different valid canonical ID returned by Geoapify", async () => {
  const { input, dependencies } = requestFor("city", "Office");
  dependencies.verifyPlace = async (requestedId) => {
    assert.equal(requestedId, "city-id");
    return {
      ...providerLocations.city,
      providerPlaceId: "canonical-city-id",
    };
  };

  const location = await getVerifiedJobLocation(input, dependencies);
  assert.equal(location.providerPlaceId, "canonical-city-id");
  assert.equal(location.city, "London");
});

test("rejects missing, modified and expired location tokens", async () => {
  const missing = requestFor("city", "Office");
  missing.input.locationToken = "";
  await assert.rejects(
    getVerifiedJobLocation(missing.input, missing.dependencies),
    (error) => error.code === "MISSING_LOCATION_TOKEN"
  );

  const modified = requestFor("city", "Office");
  modified.input.locationToken += "changed";
  await assert.rejects(
    getVerifiedJobLocation(modified.input, modified.dependencies),
    (error) => error.code === "INVALID_LOCATION_TOKEN"
  );

  const expired = requestFor("city", "Office", {
    verificationTime: now + (1800 * 1000),
  });
  await assert.rejects(
    getVerifiedJobLocation(expired.input, expired.dependencies),
    (error) => error.code === "EXPIRED_LOCATION_TOKEN"
  );
});

test("rejects browser and work-mode location mismatches", async () => {
  const browserMismatch = requestFor("city", "Office");
  browserMismatch.input.location.locationType = "country";
  await assert.rejects(
    getVerifiedJobLocation(browserMismatch.input, browserMismatch.dependencies),
    (error) => error.code === "LOCATION_TOKEN_MISMATCH"
  );

  for (const workMode of ["Office", "Hybrid"]) {
    const incompatible = requestFor("country", workMode);
    await assert.rejects(
      getVerifiedJobLocation(incompatible.input, incompatible.dependencies),
      (error) => error.code === "INCOMPATIBLE_LOCATION"
    );
  }
});

test("rejects missing or invalid Geoapify details", async () => {
  for (const code of ["INVALID_PLACE_ID", "INVALID_PROVIDER_RESPONSE"]) {
    const { input, dependencies } = requestFor("city", "Office");
    dependencies.verifyPlace = async () => {
      throw new GeoapifyLocationError("unsafe provider detail", code, 400);
    };

    await assert.rejects(
      getVerifiedJobLocation(input, dependencies),
      (error) => error.code === "LOCATION_NOT_VERIFIED" &&
        !error.message.includes("unsafe provider detail")
    );
  }
});

test("returns a safe temporary error when Geoapify is unavailable", async () => {
  const { input, dependencies } = requestFor("city", "Office");
  dependencies.verifyPlace = async () => {
    throw new GeoapifyLocationError(
      "provider detail containing secret data",
      "PROVIDER_UNAVAILABLE",
      503
    );
  };

  await assert.rejects(
    getVerifiedJobLocation(input, dependencies),
    (error) => error.code === "LOCATION_PROVIDER_UNAVAILABLE" &&
      error.status === 503 &&
      !error.message.includes("secret data")
  );
});
