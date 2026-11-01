const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  createLocationAutocompleteHandler,
} = require("../controllers/locationController");
const { LocationTokenError } = require("../utils/locationToken");

const makeResponse = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("returns structured provider data with a separate signed token", async () => {
  const location = {
    city: "London",
    country: "United Kingdom",
    county: "Greater London",
    region: "England",
    locationType: "city",
    displayName: "London, United Kingdom",
    providerPlaceId: "place-id",
  };
  const handler = createLocationAutocompleteHandler({
    assertTokenConfiguration: () => {},
    autocomplete: async (input) => {
      assert.deepEqual(input, { query: "Lon", scope: "locality" });
      return [location];
    },
    createToken: (payload) => {
      assert.deepEqual(payload, {
        providerPlaceId: "place-id",
        locationType: "city",
      });
      return "signed-token";
    },
  });
  const response = makeResponse();

  await handler({ query: { q: "Lon", scope: "locality" } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    suggestions: [{
      displayLabel: "London, United Kingdom",
      location,
      token: "signed-token",
    }],
  });
});

test("checks token configuration before requesting provider suggestions", async () => {
  let autocompleteCalls = 0;
  const handler = createLocationAutocompleteHandler({
    assertTokenConfiguration: () => {
      throw new LocationTokenError("missing secret", "MISSING_SIGNING_SECRET");
    },
    autocomplete: async () => {
      autocompleteCalls += 1;
      return [];
    },
  });
  const response = makeResponse();

  await handler({ query: { q: "Lon", scope: "locality" } }, response);

  assert.equal(autocompleteCalls, 0);
  assert.equal(response.statusCode, 503);
});
