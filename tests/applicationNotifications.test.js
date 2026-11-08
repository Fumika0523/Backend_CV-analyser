const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Load the complete real controller with isolated model/email dependencies.
// No database connection, SMTP transport or environment secrets are loaded.
async function apply({ failedEmails = [], databaseError, templateFailure, recruiter = true } = {}) {
  const sent = [];
  const logs = [];
  let saved;
  const user = { userId: "candidate-a", role: "candidate", email: "candidate@example.invalid", location: { country: "UK" } };
  const job = {
    _id: "job-a", title: "Engineer", status: "Open", applicationEndDate: "2099-01-01",
    filledPositions: 0, vacancies: 1, companyId: { _id: "company-a", companyName: "Example" },
    createdBy: recruiter ? { email: "recruiter@example.invalid" } : {},
    keySkills: ["React"], location: { country: "United Kingdom" },
  };
  const jobQuery = { populate() { return this; }, lean: async () => job };
  const dependencies = {
    "../Model/UserModel": { findById: () => ({ lean: async () => user }) },
    "../Model/jobModel": { findById: () => jobQuery },
    "../Model/applicationModel": {
      findOne: () => ({ lean: async () => null }),
      create: async (record) => {
        if (databaseError) throw databaseError;
        saved = { _id: "application-a", ...record };
        return saved;
      },
    },
    "../Model/CvModel": { findOne: () => ({ sort() { return this; }, lean: async () => ({ _id: "cv-a", skills: ["React"] }) }) },
    "../Model/skillsModel": {},
    mongoose: { isValidObjectId: () => true },
    "../utils/emailTemplates": {
      candidateApplicationTemplate: (candidate, selectedJob) => {
        assert.equal(candidate, user);
        assert.equal(selectedJob, job);
        if (templateFailure === "candidate") throw new Error("private template details");
        return "candidate template";
      },
      companyApplicationTemplate: (candidate, selectedJob) => {
        assert.equal(candidate, user);
        assert.equal(selectedJob, job);
        if (templateFailure === "company") throw new Error("private template details");
        return "company template";
      },
    },
    "../utils/sendEmail": async (email) => {
      assert.ok(saved, "notifications must follow successful database creation");
      sent.push(email);
      if (failedEmails.includes(email.to)) throw new Error("private@example.invalid token=SECRET smtp details");
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../controllers/applicationController.js"), "utf8"), {
    module, exports: module.exports, console: { error: (...args) => logs.push(args) },
    require: (name) => {
      if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  });
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await module.exports.applyForJob({ user: { id: "auth-a" }, body: { jobId: "job-a", cvId: null } }, res);
  return { res, saved, sent, logs };
}

function assertSaved(result) {
  assert.equal(result.res.code, 201);
  assert.equal(result.res.body.success, true);
  assert.equal(result.res.body.message, "Application submitted successfully");
  assert.equal(result.res.body.application, result.saved);
}
function assertSafeLogs(logs, count) {
  assert.equal(logs.length, count);
  for (const args of logs) {
    assert.equal(args.length, 1);
    assert.equal(typeof args[0], "string");
    assert.ok(!/@|SECRET|smtp|private template|candidate-a|job-a/.test(args[0]));
  }
}

test("normal email delivery preserves recipients, subjects, templates and 201 response", async () => {
  const result = await apply();
  assertSaved(result);
  assert.deepEqual(result.sent.map((email) => ({ ...email })), [
    { to: "candidate@example.invalid", subject: "Application submitted successfully", html: "candidate template" },
    { to: "recruiter@example.invalid", subject: "New job application received", html: "company template" },
  ]);
  assert.equal(result.logs.length, 0);
});

test("candidate email failure still attempts company email and returns 201", async () => {
  const result = await apply({ failedEmails: ["candidate@example.invalid"] });
  assertSaved(result);
  assert.equal(result.sent.length, 2);
  assertSafeLogs(result.logs, 1);
});

test("company email failure preserves candidate delivery and returns 201", async () => {
  const result = await apply({ failedEmails: ["recruiter@example.invalid"] });
  assertSaved(result);
  assert.equal(result.sent.length, 2);
  assertSafeLogs(result.logs, 1);
});

test("both notification failures return 201 with safe independent logs", async () => {
  const result = await apply({ failedEmails: ["candidate@example.invalid", "recruiter@example.invalid"] });
  assertSaved(result);
  assertSafeLogs(result.logs, 2);
});

test("template failures are isolated after application creation", async () => {
  for (const templateFailure of ["candidate", "company"]) {
    const result = await apply({ templateFailure });
    assertSaved(result);
    assert.equal(result.sent.length, 1);
    assertSafeLogs(result.logs, 1);
  }
});

test("missing recruiter email preserves optional company notification behaviour", async () => {
  const result = await apply({ recruiter: false });
  assertSaved(result);
  assert.equal(result.sent.length, 1);
});

test("genuine database failure still returns 500 and sends no notifications", async () => {
  const result = await apply({ databaseError: new Error("Simulated database failure") });
  assert.equal(result.res.code, 500);
  assert.equal(result.res.body.success, false);
  assert.equal(result.res.body.message, "Server Error");
  assert.equal(result.saved, undefined);
  assert.equal(result.sent.length, 0);
});

test("duplicate database constraint failure preserves existing 400 response", async () => {
  const result = await apply({ databaseError: Object.assign(new Error("Duplicate application"), { code: 11000 }) });
  assert.equal(result.res.code, 400);
  assert.equal(result.res.body.success, false);
  assert.equal(result.sent.length, 0);
});
