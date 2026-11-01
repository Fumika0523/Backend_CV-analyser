const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  GeoapifyLocationError,
  PLACE_DETAILS_URL,
  verifyGeoapifyPlace,
} = require("../utils/geoapifyLocation");

const makeHttpClient = (implementation) => ({ get: implementation });

test("verifies a place ID and returns canonical location details", async () => {
  const httpClient = makeHttpClient(async (url, options) => {
    assert.equal(url, PLACE_DETAILS_URL);
    assert.deepEqual(options.params, {
      id: "autocomplete-place-id",
      apiKey: "test-key",
    });
    assert.equal(options.timeout, 5000);

    return {
      data: {
        type: "FeatureCollection",
        features: [{
          properties: {
            feature_type: "details",
            place_id: "canonical-place-id",
            formatted: "London, Greater London, United Kingdom",
            city: "London",
            county: "Greater London",
            state: "England",
            country: "United Kingdom",
          },
        }],
      },
    };
  });

  assert.deepEqual(await verifyGeoapifyPlace(" autocomplete-place-id ", {
    apiKey: " test-key ",
    httpClient,
  }), {
    providerPlaceId: "canonical-place-id",
    displayName: "London, Greater London, United Kingdom",
    city: "London",
    county: "Greater London",
    region: "England",
    country: "United Kingdom",
  });
});

test("finds the details feature by type rather than array position", async () => {
  const httpClient = makeHttpClient(async () => ({
    data: {
      features: [
        { properties: { feature_type: "building", country: "Wrong" } },
        {
          properties: {
            feature_type: "details",
            place_id: "canonical-state-id",
            name: "Scotland",
            country: "United Kingdom",
          },
        },
      ],
    },
  }));

  const place = await verifyGeoapifyPlace("place-id", {
    apiKey: "test-key",
    httpClient,
  });

  assert.equal(place.providerPlaceId, "canonical-state-id");
  assert.equal(place.displayName, "Scotland");
  assert.equal(place.region, "");
  assert.equal(place.country, "United Kingdom");
});

test("rejects invalid inputs before making a request", async () => {
  let requestCount = 0;
  const httpClient = makeHttpClient(async () => {
    requestCount += 1;
  });

  await assert.rejects(
    verifyGeoapifyPlace(" ", { apiKey: "test-key", httpClient }),
    (error) => error instanceof GeoapifyLocationError &&
      error.code === "INVALID_PLACE_ID"
  );
  await assert.rejects(
    verifyGeoapifyPlace("place-id", { apiKey: " ", httpClient }),
    (error) => error instanceof GeoapifyLocationError &&
      error.code === "MISSING_API_KEY"
  );
  await assert.rejects(
    verifyGeoapifyPlace("x".repeat(513), { apiKey: "test-key", httpClient }),
    (error) => error.code === "INVALID_PLACE_ID"
  );
  for (const timeout of [99, 30001, 1.5, "5000", NaN]) {
    await assert.rejects(
      verifyGeoapifyPlace("place-id", { apiKey: "test-key", httpClient, timeout }),
      (error) => error.code === "INVALID_TIMEOUT"
    );
  }
  assert.equal(requestCount, 0);
});

test("rejects responses without canonical identity or country", async () => {
  for (const data of [
    {},
    { features: [] },
    { features: [{ properties: { feature_type: "building" } }] },
    { features: [{ properties: {
      feature_type: "details", place_id: "place-id", country: " ",
    } }] },
    { features: [{ properties: {
      feature_type: "details", place_id: " ", country: "United Kingdom",
    } }] },
    { features: [{ properties: {
      feature_type: "details", place_id: "x".repeat(513), country: "United Kingdom",
    } }] },
  ]) {
    const httpClient = makeHttpClient(async () => ({ data }));
    await assert.rejects(
      verifyGeoapifyPlace("place-id", { apiKey: "test-key", httpClient }),
      (error) => error instanceof GeoapifyLocationError &&
        error.code === "INVALID_PROVIDER_RESPONSE"
    );
  }
});

test("classifies provider failures without exposing provider messages", async () => {
  const cases = [
    [400, "INVALID_PLACE_ID"],
    [404, "INVALID_PLACE_ID"],
    [401, "PROVIDER_AUTH_ERROR"],
    [403, "PROVIDER_AUTH_ERROR"],
    [429, "PROVIDER_RATE_LIMITED"],
    [422, "PROVIDER_REQUEST_FAILED"],
    [500, "PROVIDER_UNAVAILABLE"],
    [undefined, "PROVIDER_UNAVAILABLE"],
  ];

  for (const [status, code] of cases) {
    const httpClient = makeHttpClient(async () => {
      const error = new Error("provider error containing secret-test-key");
      if (status !== undefined) {
        error.response = { status };
      }
      throw error;
    });

    await assert.rejects(
      verifyGeoapifyPlace("place-id", {
        apiKey: "secret-test-key",
        httpClient,
      }),
      (error) => {
        assert.equal(error.code, code);
        assert.equal(error.status, status);
        assert.equal(error.message.includes("secret-test-key"), false);
        return true;
      }
    );
  }
});

test("supports a custom timeout without exposing the API key in errors", async () => {
  const httpClient = makeHttpClient(async (_url, options) => {
    assert.equal(options.timeout, 1200);
    throw new Error(`request failed for ${options.params.apiKey}`);
  });

  await assert.rejects(
    verifyGeoapifyPlace("place-id", {
      apiKey: "secret-test-key",
      httpClient,
      timeout: 1200,
    }),
    (error) => {
      assert.equal(error.code, "PROVIDER_UNAVAILABLE");
      assert.equal(error.message.includes("secret-test-key"), false);
      return true;
    }
  );
});
