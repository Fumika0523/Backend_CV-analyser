const { test } = require("node:test") //node:test is Node.js's built-in test runner.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createLocationToken, verifyLocationToken } = require("../utils/locationToken");
const { getVerifiedJobLocation, VerifiedJobLocationError } = require("../services/verifiedJobLocation");
const { GeoapifyLocationError } = require("../utils/geoapifyLocation");
const locationPolicy = require("../utils/jobLocation");
const JobModel = require("../Model/jobModel");

const secret = "a-dedicated-test-only-location-secret-with-32-characters";
const now = Date.UTC(2026, 10, 9, 12, 0, 0);
const copy = (value) => JSON.parse(JSON.stringify(value));
const locations = {
  city: {
    providerPlaceId: "canonical-manchester-id", displayName: "Manchester, United Kingdom",
    city: "Manchester", county: "Greater Manchester", region: "England", country: "United Kingdom", locationType: "city",
  },
  country: {
    providerPlaceId: "country-id", displayName: "Canada", city: "", county: "", region: "", country: "Canada", locationType: "country",
  },
  county: {
    providerPlaceId: "county-id", displayName: "Kent, United Kingdom", city: "", county: "Kent", region: "England", country: "United Kingdom", locationType: "county",
  },
  region: {
    providerPlaceId: "region-id", displayName: "Scotland, United Kingdom", city: "", county: "", region: "Scotland", country: "United Kingdom", locationType: "region",
  },
};
const signedInput = (type, changes = {}) => ({
  location: {
    providerPlaceId: type === "city" ? "selected-manchester-id" : locations[type].providerPlaceId,
    locationType: type,
    city: "Forged browser city", country: "Forged browser country", county: "Forged county", region: "Forged region", displayName: "Forged label",
    latitude: 89.99, longitude: -179.99, coordinates: [-179.99, 89.99],
  },
  locationToken: createLocationToken({ providerPlaceId: type === "city" ? "selected-manchester-id" : locations[type].providerPlaceId, locationType: type }, { secret, now }),
  ...changes,
});

function harness({ role = "company", missingUser = false, foreignCompany = false, existingLocation, workMode = "Office", providerError } = {}) {
  const calls = { users: [], reads: [], writes: [], verification: [], provider: [] };
  const user = missingUser ? null : { role, companyId: "company-a" };
  const job = {
    _id: "job-a", companyId: foreignCompany ? "company-b" : "company-a", workMode,
    createdBy: "original-recruiter", postedByName: "Original Poster", postedByPosition: "Recruiter",
    status: "Open", filledPositions: 2,
    location: existingLocation || { city: "London", country: "United Kingdom", locationType: "city", providerPlaceId: "london-id", displayName: "London, United Kingdom" },
  };
  const deps = {
    "../Model/jobModel": {
      findById: async (id) => { calls.reads.push(id); return job; },
      findByIdAndUpdate: async (id, updates, options) => {
        calls.writes.push({ id, updates: copy(updates), options: copy(options) });
        return { ...job, ...updates };
      },
    },
    "../Model/UserModel": { findById: async (id) => { calls.users.push(id); return user; } },
    "../Model/skillsModel": {}, "../Model/CvModel": {}, "../Model/applicationModel": {}, "../Model/companyModel": {},
    "../services/verifiedJobLocation": {
      VerifiedJobLocationError,
      getVerifiedJobLocation: async (input) => {
        calls.verification.push(copy(input));
        return getVerifiedJobLocation(input, {
          verifyToken: (token) => verifyLocationToken(token, { secret, now }),
          verifyPlace: async (placeId) => {
            calls.provider.push(placeId);
            if (providerError) throw providerError;
            const type = placeId === "selected-manchester-id" ? "city"
              : Object.keys(locations).find((key) => locations[key].providerPlaceId === placeId);
            assert.ok(type, "only signed known place IDs should reach the provider adapter");
            const { locationType, ...canonical } = locations[type];
            return canonical;
          },
        });
      },
    },
    "../utils/jobLocation": locationPolicy,
  };
  const exports = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../controllers/jobController.js"), "utf8"), {
    exports, console: { log() {}, error() {} },
    require: (name) => {
      if (!(name in deps)) throw new Error("Unexpected controller dependency: " + name);
      return deps[name];
    },
  });
  return { calls, job, controller: exports };
}
async function update(app, body) {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = copy(value); return this; } };
  await app.controller.updateJobPost({ user: { id: "authenticated-company-user" }, params: { id: "job-a" }, body }, res);
  return res;
}

// Everything below executes in memory: no database writes or provider requests.
test("non-company and missing users cannot read or update the company job", async () => {
  for (const options of [{ role: "candidate" }, { role: "guest" }, { missingUser: true }]) {
    const app = harness(options);
    const response = await update(app, { salary: "55000" });
    assert.equal(response.statusCode, 403);
    assert.equal(app.calls.reads.length, 0);
    assert.equal(app.calls.writes.length, 0);
  }
});

test("foreign company ownership is rejected before verification or update", async () => {
  const app = harness({ foreignCompany: true });
  const response = await update(app, signedInput("city"));
  assert.equal(response.statusCode, 403);
  assert.equal(app.calls.verification.length, 0);
  assert.equal(app.calls.provider.length, 0);
  assert.equal(app.calls.writes.length, 0);
});

test("allowed updates cannot change protected ownership, poster, status or application metadata", async () => {
  const app = harness();
  const response = await update(app, { salary: "55000", companyId: "attacker", createdBy: "attacker", postedByName: "attacker",
    postedByPosition: "attacker", status: "Closed", filledPositions: 99, locationToken: "unused token", $set: { companyId: "attacker" } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(app.calls.writes[0].updates, { salary: "55000" });
  for (const field of ["companyId", "createdBy", "postedByName", "postedByPosition", "status", "filledPositions"]) {
    assert.equal(response.body.job[field], app.job[field]);
  }
  assert.equal(app.calls.verification.length, 0);
});

test("omitted unchanged verified Remote country/county/region locations retain all metadata without token or provider calls", async () => {
  for (const type of ["country", "county", "region"]) {
    const app = harness({ existingLocation: locations[type], workMode: "Remote" });
    const response = await update(app, { salary: "60000" });
    assert.equal(response.statusCode, 200, type);
    assert.deepEqual(app.calls.writes[0].updates, { salary: "60000" });
    assert.deepEqual(response.body.job.location, locations[type]);
    assert.equal(app.calls.verification.length, 0);
    assert.equal(app.calls.provider.length, 0);
  }
});

test("an irrelevant expired token does not invalidate an omitted trusted stored location", async () => {
  const app = harness({ existingLocation: locations.country, workMode: "Remote" });
  const oldToken = createLocationToken({ providerPlaceId: "country-id", locationType: "country" }, { secret, now: now - 31000, ttlSeconds: 30 });
  assert.equal((await update(app, { salary: "60000", locationToken: oldToken })).statusCode, 200);
  assert.equal(app.calls.verification.length, 0);
  assert.deepEqual(app.calls.writes[0].updates, { salary: "60000" });
});

test("legacy unchanged city/country text preserves stored verified metadata", async () => {
  const app = harness();
  const response = await update(app, { salary: "60000", location: " london, united kingdom " });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(app.calls.writes[0].updates, { salary: "60000" });
  assert.deepEqual(response.body.job.location, app.job.location);
  assert.equal(app.calls.verification.length, 0);
});

test("changed city uses signed ID for verification and saves canonical provider fields, not browser values", async () => {
  const app = harness();
  const response = await update(app, signedInput("city"));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(app.calls.provider, ["selected-manchester-id"]);
  assert.deepEqual(app.calls.writes[0].updates.location, locations.city);
  assert.equal(Object.hasOwn(app.calls.writes[0].updates, "locationToken"), false);
  assert.equal(app.calls.writes[0].options.runValidators, true);
});

test("changed Remote country location is saved without a fictional city", async () => {
  const app = harness();
  const response = await update(app, signedInput("country", { workMode: "Remote" }));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(app.calls.writes[0].updates.location, locations.country);
  assert.equal(app.calls.writes[0].updates.location.city, "");
  assert.equal(app.calls.writes[0].updates.workMode, "Remote");
});

test("missing, invalid and expired changed-location tokens reject before provider lookup or database update", async () => {
  const examples = [
    [undefined, "MISSING_LOCATION_TOKEN"], ["   ", "MISSING_LOCATION_TOKEN"],
    ["invalid.token", "INVALID_LOCATION_TOKEN"],
    [createLocationToken({ providerPlaceId: "selected-manchester-id", locationType: "city" }, { secret, now: now - 31000, ttlSeconds: 30 }), "EXPIRED_LOCATION_TOKEN"],
  ];
  for (const [locationToken, code] of examples) {
    const app = harness();
    const response = await update(app, signedInput("city", { locationToken }));
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, code);
    assert.equal(app.calls.provider.length, 0);
    assert.equal(app.calls.writes.length, 0);
  }
});

test("a browser provider-ID or location-type mismatch cannot reuse a signed selection", async () => {
  for (const changes of [{ providerPlaceId: "forged-id" }, { locationType: "country" }]) {
    const app = harness();
    const input = signedInput("city");
    input.location = { ...input.location, ...changes };
    const response = await update(app, input);
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "LOCATION_TOKEN_MISMATCH");
    assert.equal(app.calls.provider.length, 0);
    assert.equal(app.calls.writes.length, 0);
  }
});

test("changed free text, arrays and null locations are rejected without updates", async () => {
  for (const location of ["Manchester, United Kingdom", null, []]) {
    const app = harness();
    const response = await update(app, { ...signedInput("city"), location });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "INVALID_LOCATION");
    assert.equal(app.calls.writes.length, 0);
  }
});

test("Remote country jobs cannot switch to Office/Hybrid without a newly verified city", async () => {
  for (const workMode of ["Office", "Hybrid"]) {
    const omitted = harness({ existingLocation: locations.country, workMode: "Remote" });
    const rejected = await update(omitted, { workMode });
    assert.equal(rejected.statusCode, 400);
    assert.equal(rejected.body.code, "INCOMPATIBLE_LOCATION");
    assert.equal(omitted.calls.writes.length, 0);
    const changed = harness({ existingLocation: locations.country, workMode: "Remote" });
    assert.equal((await update(changed, signedInput("city", { workMode }))).statusCode, 200);
    assert.equal(changed.calls.writes[0].updates.location.locationType, "city");
  }
});

test("signed country selection remains incompatible with Office/Hybrid and invalid work modes reject", async () => {
  for (const workMode of ["Office", "Hybrid"]) {
    const app = harness();
    const response = await update(app, signedInput("country", { workMode }));
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "INCOMPATIBLE_LOCATION");
    assert.equal(app.calls.writes.length, 0);
  }
  const app = harness();
  const response = await update(app, { workMode: "Flexible" });
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.code, "INCOMPATIBLE_LOCATION");
  assert.equal(app.calls.writes.length, 0);
});

test("provider failures keep safe service codes and do not save unverified locations", async () => {
  for (const [code, status, expected] of [["INVALID_PLACE_ID", 400, "LOCATION_NOT_VERIFIED"], ["PROVIDER_UNAVAILABLE", 503, "LOCATION_PROVIDER_UNAVAILABLE"]]) {
    const app = harness({ providerError: new GeoapifyLocationError("PRIVATE PROVIDER DETAILS", code, status) });
    const response = await update(app, signedInput("city"));
    assert.equal(response.statusCode, status);
    assert.equal(response.body.code, expected);
    assert.ok(!JSON.stringify(response.body).includes("PRIVATE"));
    assert.equal(app.calls.writes.length, 0);
  }
});

test("Mongoose update-query validation permits explicit Remote country without city and retains city requirements", async () => {
  const countryUpdate = { workMode: "Remote", location: locations.country };
  const countryQuery = JobModel.findByIdAndUpdate("111111111111111111111111", countryUpdate, { runValidators: true });
  await countryQuery.validate({ $set: countryUpdate }, { runValidators: true }, false);
  for (const location of [{ city: "", country: "United Kingdom", locationType: "city" }, { city: "", country: "United Kingdom" }]) {
    const update = { workMode: "Remote", location };
    const query = JobModel.findByIdAndUpdate("111111111111111111111111", update, { runValidators: true });
    await assert.rejects(query.validate({ $set: update }, { runValidators: true }, false), (error) => Boolean(error.errors["location.city"]));
  }
});

test("existing update route still uses the authentication middleware and same controller", () => {
  const calls = [];
  const auth = () => {};
  const updateJobPost = () => {};
  const router = Object.fromEntries(["get", "post", "put", "delete"].map((method) => [method, (...args) => calls.push({ method, args })]));
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../routes/jobRoutes.js"), "utf8"), {
    module: { exports: {} }, require: (name) => {
      if (name === "express") return { Router: () => router };
      if (name === "../middleware/auth") return auth;
      if (name === "../controllers/jobController") return { updateJobPost };
      throw new Error(name);
    },
  });
  const route = calls.find((entry) => entry.method === "put" && entry.args[0] === "/jobs/:id");
  assert.ok(route);
  assert.equal(route.args[1], auth);
  assert.equal(route.args[2], updateJobPost);
});
