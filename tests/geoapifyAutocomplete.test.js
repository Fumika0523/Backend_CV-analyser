const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  AUTOCOMPLETE_URL,
  autocompleteGeoapifyLocations,
} = require("../services/geoapifyAutocomplete");

const clientReturning = (data) => ({ get: async () => ({ data }) });

test("maps only supported provider result types without inventing city data", async () => {
  const results = [
    { result_type: "city", place_id: "1", city: "London", country: "United Kingdom", formatted: "London, UK" },
    { result_type: "county", place_id: "2", county: "Kent", country: "United Kingdom", formatted: "Kent, UK" },
    { result_type: "state", place_id: "3", state: "Scotland", country: "United Kingdom", formatted: "Scotland, UK" },
    { result_type: "country", place_id: "4", country: "Canada", formatted: "Canada" },
    { result_type: "district", place_id: "5", city: "London", country: "United Kingdom", formatted: "District" },
    { result_type: "state", place_id: "6", name: "Wales", country: "United Kingdom", formatted: "Wales, UK" },
  ];

  const locations = await autocompleteGeoapifyLocations({
    query: "United",
    scope: "locality",
  }, {
    apiKey: "test-key",
    httpClient: clientReturning({ results }),
  });

  assert.deepEqual(locations.map((location) => location.locationType), [
    "city", "county", "region", "country",
  ]);
  assert.equal(locations[2].city, "");
  assert.equal(locations[2].region, "Scotland");
  assert.equal(locations.some((location) => location.providerPlaceId === "6"), false);
});

test("uses locality and country provider search modes", async () => {
  const seenTypes = [];
  const httpClient = {
    get: async (url, options) => {
      assert.equal(url, AUTOCOMPLETE_URL);
      assert.equal(options.params.apiKey, "test-key");
      seenTypes.push(options.params.type);
      return { data: { results: [] } };
    },
  };

  await autocompleteGeoapifyLocations({ query: "Lon", scope: "locality" }, {
    apiKey: "test-key", httpClient,
  });
  await autocompleteGeoapifyLocations({ query: "Can", scope: "country" }, {
    apiKey: "test-key", httpClient,
  });
  assert.deepEqual(seenTypes, ["locality", "country"]);
});

test("rejects invalid browser input before contacting Geoapify", async () => {
  let requests = 0;
  const httpClient = { get: async () => { requests += 1; } };
  for (const input of [
    { query: "x", scope: "locality" },
    { query: "x".repeat(101), scope: "locality" },
    { query: "London", scope: "all" },
  ]) {
    await assert.rejects(
      autocompleteGeoapifyLocations(input, { apiKey: "test-key", httpClient }),
      (error) => error.code === "INVALID_INPUT"
    );
  }
  assert.equal(requests, 0);
});

test("rejects malformed Geoapify responses", async () => {
  for (const data of [{}, { results: null }, { results: "invalid" }]) {
    await assert.rejects(
      autocompleteGeoapifyLocations({ query: "London", scope: "locality" }, {
        apiKey: "test-key",
        httpClient: clientReturning(data),
      }),
      (error) => error.code === "INVALID_PROVIDER_RESPONSE"
    );
  }
});
