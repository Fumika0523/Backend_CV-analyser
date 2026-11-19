
const { test } = require("node:test");
const assert = require("node:assert/strict");

const Job = require("../Model/jobModel");
const User = require("../Model/UserModel");

const {
  updateJobPost,
} = require("../controllers/jobController");

test("salary update cannot modify protected job fields", async (t) => {
  // Simulate the authenticated company user.
  t.mock.method(User, "findById", async () => ({
    role: "company",
    companyId: "company-123",
  }));

  // Simulate an existing job in MongoDB.
  t.mock.method(Job, "findById", async () => ({
    _id: "job-123",
    companyId: "company-123",
    workMode: "Office",
    location: {
      city: "London",
      country: "United Kingdom",
    },
  }));

  let savedUpdates;

  // Capture what the controller tries to save.
  t.mock.method(
    Job,
    "findByIdAndUpdate",
    async (id, updates) => {
      savedUpdates = updates;
      return { _id: id, ...updates };
    }
  );

  // Simulate a request containing malicious extra fields.
  const req = {
    user: { id: "user-123" },
    params: { id: "job-123" },
    body: {
      salary: "£50,000",
      companyId: "attacker-company",
      filledPositions: 99,
      createdBy: "attacker",
      status: "Closed",
    },
  };

  // Simulate an Express response.
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };

  // Execute the real controller.
  await updateJobPost(req, res);

  // Check the response.
  assert.equal(res.statusCode, 200);

  // Only salary should be updated.
  assert.deepEqual(savedUpdates, {
    salary: "£50,000",
  });
});


test("company cannot edit another company's job", async (t) => {

  // The logged-in user belongs to Company A.
  t.mock.method(User, "findById", async () => ({
    role: "company",
    companyId: "company-A",
  }));

  // But the requested job belongs to Company B.
  t.mock.method(Job, "findById", async () => ({
    _id: "job-123",
    companyId: "company-B",
    workMode: "Office",
  }));

  let updateCalled = false;

  // Track whether the database update is attempted.
  t.mock.method(
    Job,
    "findByIdAndUpdate",
    async () => {
      updateCalled = true;
    }
  );

  const req = {
    user: { id: "user-A" },
    params: { id: "job-123" },
    body: {
      salary: "£100,000",
    },
  };

  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };

  await updateJobPost(req, res);

  // The server must reject the request.
  assert.equal(res.statusCode, 403);

  // MongoDB update must NEVER be called.
  assert.equal(updateCalled, false);
});

test("rejects changed location without Geoapify token", async (t) => {

  // Simulate the authenticated company.
  t.mock.method(User, "findById", async () => ({
    role: "company",
    companyId: "company-123",
  }));

  // Existing job is located in London.
  t.mock.method(Job, "findById", async () => ({
    _id: "job-123",
    companyId: "company-123",
    workMode: "Office",
    location: {
      city: "London",
      country: "United Kingdom",
    },
  }));

  let updateCalled = false;

  // Check whether MongoDB update is attempted.
  t.mock.method(
    Job,
    "findByIdAndUpdate",
    async () => {
      updateCalled = true;
    }
  );

  const req = {
    user: { id: "user-123" },
    params: { id: "job-123" },
    body: {
      location: {
        city: "Manchester",
        country: "United Kingdom",
        locationType: "city",
        providerPlaceId: "fake-place-id",
      },

      // Deliberately no locationToken!
    },
  };

  const res = {
    statusCode: 200,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      this.body = data;
      return this;
    },
  };

  await updateJobPost(req, res);

  // Missing Geoapify confirmation should be rejected.
  assert.equal(res.statusCode, 400);

  // Confirm the exact error.
  assert.equal(
    res.body.code,
    "MISSING_LOCATION_TOKEN"
  );

  // The database must not be updated.
  assert.equal(updateCalled, false);
});


test("preserves existing Geoapify location when unchanged", async (t) => {
  t.mock.method(User, "findById", async () => ({
    role: "company",
    companyId: "company-123",
  }));

  t.mock.method(Job, "findById", async () => ({
    _id: "job-123",
    companyId: "company-123",
    workMode: "Office",
    location: {
      city: "London",
      country: "United Kingdom",
      locationType: "city",
      providerPlaceId: "verified-london-id",
    },
  }));

  let savedUpdates;

  t.mock.method(Job, "findByIdAndUpdate", async (id, updates) => {
    savedUpdates = updates;
    return { _id: id, ...updates };
  });

  const req = {
    user: { id: "user-123" },
    params: { id: "job-123" },
    body: {
      salary: "£55,000",
      location: "London, United Kingdom",
    },
  };

  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };

  await updateJobPost(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(savedUpdates, {
    salary: "£55,000",
  });
});


test("rejects changing country-wide Remote job to Office", async (t) => {
  t.mock.method(User, "findById", async () => ({
    role: "company",
    companyId: "company-123",
  }));

  t.mock.method(Job, "findById", async () => ({
    _id: "job-123",
    companyId: "company-123",
    workMode: "Remote",
    location: {
      country: "United Kingdom",
      locationType: "country",
    },
  }));

  let updateCalled = false;

  t.mock.method(Job, "findByIdAndUpdate", async () => {
    updateCalled = true;
  });

  const req = {
    user: { id: "user-123" },
    params: { id: "job-123" },
    body: {
      workMode: "Office",
    },
  };

  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };

  await updateJobPost(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "INCOMPATIBLE_LOCATION");
  assert.equal(updateCalled, false);
});
