const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  validateJobLocation,
  validateJobLocationUpdate,
} = require("../utils/jobLocation");

const country = "United Kingdom";
const cityLocation = { city: "London", country, locationType: "city" };

for (const workMode of ["Office", "Hybrid", "Remote"]) {
  test(`${workMode} accepts city and metropolitan area locations`, () => {
    for (const city of ["London", "Greater Manchester"]) {
      assert.deepEqual(
        validateJobLocation({ ...cityLocation, city }, workMode),
        { valid: true, errors: [] }
      );
    }
  });

  test(`${workMode} accepts legacy objects and city/country strings`, () => {
    for (const location of [
      { city: "London", country },
      ` London , ${country} `,
    ]) {
      assert.equal(validateJobLocation(location, workMode).valid, true);
    }
  });
}

for (const locationType of ["county", "region", "country"]) {
  const location = {
    country,
    locationType,
    ...(locationType === "county" ? { county: "Kent" } : {}),
    ...(locationType === "region" ? { region: "South East England" } : {}),
  };

  test(`Remote accepts ${locationType} without city`, () => {
    assert.equal(validateJobLocation(location, "Remote").valid, true);
  });

  for (const workMode of ["Office", "Hybrid"]) {
    test(`${workMode} rejects ${locationType} even with a city present`, () => {
      const validation = validateJobLocation({ ...location, city: "London" }, workMode);
      assert.equal(validation.valid, false);
      assert.ok(validation.errors.includes(
        "Office and Hybrid jobs require a city or metropolitan area."
      ));
    });
  }
}

test("missing, malformed and incomplete locations fail without throwing", () => {
  for (const location of [
    undefined, null, false, 123, [], {}, "", "London", "London,",
    ",United Kingdom", "London, England, United Kingdom",
    { city: "London" }, { country }, { city: " ", country },
    { city: "London", country: " " },
    { city: "London", country: 123 },
    { city: ["London"], country },
    { country, locationType: "county" },
    { country, locationType: "region", region: " " },
    { country, locationType: "country", displayName: {} },
    { country, locationType: "country", providerPlaceId: 123 },
    { ...cityLocation, county: [] },
    { ...cityLocation, locationType: "metropolitan" },
    { ...cityLocation, locationType: "" },
    { ...cityLocation, locationType: null },
  ]) {
    const validation = validateJobLocation(location, "Remote");
    assert.equal(validation.valid, false, JSON.stringify(location));
    assert.ok(validation.errors.length > 0);
  }
});

test("unknown or missing work modes fail", () => {
  for (const workMode of [undefined, null, "", "remote", "On-site"]) {
    assert.equal(validateJobLocation(cityLocation, workMode).valid, false);
  }
});

test("metadata is optional and validation does not mutate inputs", () => {
  const location = Object.freeze({
    ...cityLocation,
    city: " London ",
    county: "",
    region: "Greater London",
    displayName: "London, United Kingdom",
    providerPlaceId: "provider-123",
  });
  assert.deepEqual(validateJobLocation(location, "Office"), { valid: true, errors: [] });
  assert.equal(location.city, " London ");
});

test("unrelated edits skip location validation for incomplete legacy records", () => {
  const existingJob = { location: null, workMode: "Office" };
  for (const updates of [{}, { title: "New title" }, { salary: "50000", county: "Kent" }]) {
    assert.deepEqual(validateJobLocationUpdate(existingJob, updates), {
      valid: true, errors: [],
    });
  }
});

test("location edits use stored work mode and replace rather than merge location", () => {
  const existingJob = { location: cityLocation, workMode: "Office" };
  assert.equal(validateJobLocationUpdate(existingJob, {
    location: { ...cityLocation, city: "Manchester" },
  }).valid, true);
  for (const location of [undefined, null, { city: "Manchester" }, { country, locationType: "country" }]) {
    assert.equal(validateJobLocationUpdate(existingJob, { location }).valid, false);
  }
});

test("work mode edits validate stored location against the new mode", () => {
  const remoteJob = { location: { country, locationType: "country" }, workMode: "Remote" };
  assert.equal(validateJobLocationUpdate(remoteJob, { workMode: "Hybrid" }).valid, false);
  assert.equal(validateJobLocationUpdate(remoteJob, { workMode: "Office" }).valid, false);
  assert.equal(validateJobLocationUpdate(remoteJob, { workMode: undefined }).valid, false);
  assert.equal(validateJobLocationUpdate({ location: cityLocation, workMode: "Office" }, {
    workMode: "Remote",
  }).valid, true);
});

test("simultaneous edits validate the submitted pair without mutating either input", () => {
  const existingJob = Object.freeze({ location: cityLocation, workMode: "Office" });
  const updates = Object.freeze({
    location: Object.freeze({ country, locationType: "country" }),
    workMode: "Remote",
  });
  assert.equal(validateJobLocationUpdate(existingJob, updates).valid, true);
  assert.equal(existingJob.workMode, "Office");
  assert.equal(updates.location.locationType, "country");
});

test("echoed legacy location remains valid when a job is edited", () => {
  const existingJob = { location: { city: "London", country }, workMode: "Office" };
  assert.equal(validateJobLocationUpdate(existingJob, { location: existingJob.location }).valid, true);
  assert.equal(validateJobLocationUpdate(existingJob, { workMode: "Hybrid" }).valid, true);
});

test("unchanged legacy echoes tolerate case and surrounding whitespace in either representation", () => {
  for (const location of [{ city: "London", country }, "London, United Kingdom"]) {
    const existingJob = Object.freeze({ location, workMode: "Office" });
    for (const echoed of [
      " london , UNITED KINGDOM ",
      Object.freeze({ city: " LONDON ", country: " united kingdom ", county: "" }),
    ]) {
      assert.deepEqual(validateJobLocationUpdate(existingJob, {
        title: "New title", location: echoed,
      }), { valid: true, errors: [] });
    }
  }
});

test("changed legacy city or country requires an explicit structured type", () => {
  const existingJob = { location: { city: "London", country }, workMode: "Office" };
  for (const location of [
    "Manchester, United Kingdom", "London, Canada",
    { city: "Manchester", country }, { city: "London", country: "Canada" },
    { city: "London", country, county: "Kent" },
  ]) {
    const validation = validateJobLocationUpdate(existingJob, { location });
    assert.equal(validation.valid, false);
    assert.match(validation.errors[0], /structured location/);
  }
  assert.equal(validateJobLocationUpdate(existingJob, {
    location: { city: "Manchester", country, locationType: "city" },
  }).valid, true);
});

test("structured locations cannot be downgraded to legacy strings or untyped objects", () => {
  const existingJob = { location: cityLocation, workMode: "Office" };
  for (const location of ["London, United Kingdom", { city: "London", country }]) {
    assert.equal(validateJobLocationUpdate(existingJob, { location }).valid, false);
  }
  assert.equal(validateJobLocationUpdate(existingJob, { location: { ...cityLocation } }).valid, true);
});

test("legacy preservation cannot silently drop or change stored metadata", () => {
  const location = Object.freeze({ city: "London", country, county: "Greater London", providerPlaceId: "ID-123" });
  const existingJob = Object.freeze({ location, workMode: "Office" });
  for (const submitted of [
    "London, United Kingdom",
    { city: "London", country },
    { ...location, providerPlaceId: "id-123" },
  ]) {
    assert.equal(validateJobLocationUpdate(existingJob, { location: submitted }).valid, false);
  }
  const updates = Object.freeze({ location: Object.freeze({ ...location }) });
  assert.equal(validateJobLocationUpdate(existingJob, updates).valid, true);
  assert.equal(existingJob.location, location);
  assert.equal(updates.location.providerPlaceId, "ID-123");
});

test("legacy echoes still obey work mode and required field validation", () => {
  assert.equal(validateJobLocationUpdate({
    location: { city: "London", country }, workMode: "Office",
  }, { location: "London, United Kingdom", workMode: "invalid" }).valid, false);
  assert.equal(validateJobLocationUpdate({
    location: { city: "", country }, workMode: "Office",
  }, { location: { city: "", country } }).valid, false);
});

test("malformed update payloads and missing jobs fail safely", () => {
  for (const updates of [null, undefined, [], "text", 42, false, new Date()]) {
    const validation = validateJobLocationUpdate({ location: cityLocation, workMode: "Office" }, updates);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.length > 0);
  }
  for (const job of [null, undefined, [], "text"]) {
    assert.equal(validateJobLocationUpdate(job, { location: cityLocation }).valid, false);
  }
});
