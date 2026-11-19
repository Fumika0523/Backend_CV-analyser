const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const id = (number) => number.toString(16).padStart(24, "0");
const cvId = id(999);
const plain = (value) => JSON.parse(JSON.stringify(value));
const job = (number, keySkills = ["React"], country = "United Kingdom") => ({
  _id: id(number), keySkills, location: { country }, status: "Open", applicationEndDate: "2099-01-01",
  filledPositions: 0, vacancies: 1, companyId: { isActive: true },
});
const defaultJobs = [job(1), job(2, ["SQL"]), job(3, ["SQL"], "Canada"), job(4, ["React"], "Canada"),
  job(5, ["React", "SQL", "Node", "Python"])];

function harness({ jobs = defaultJobs, role = "candidate", missingUser = false, ownCv = true,
  cv = { skills: ["React"], rawText: "PRIVATE-CV-TEXT", filePath: "/uploads/cvs/private.pdf" }, dbError } = {}) {
  const calls = { user: [], cv: [], jobs: [], selects: [], logs: [] };
  const lean = (stage, value) => async () => {
    if (dbError === stage) throw new Error("PRIVATE-DATABASE-CREDENTIAL");
    return value;
  };
  const query = (stage, value) => ({ select(fields) { calls.selects.push([stage, fields]); return this; }, lean: lean(stage, value) });
  const deps = {
    "../Model/UserModel": { findById: (userId) => {
      calls.user.push(userId);
      return query("user", missingUser ? null : { userId: 17, role, location: { country: "UK" } });
    } },
    "../Model/CvModel": { findOne: (filter) => {
      calls.cv.push(plain(filter));
      return query("cv", ownCv && filter.candidateId === 17 ? cv : null);
    } },
    "../Model/jobModel": {
      find: (filter) => {
        calls.jobs.push(plain(filter));
        return query("jobs", jobs.filter((value) => filter._id.$in.includes(value._id.toLowerCase())).reverse());
      },
      findById: (jobId) => ({ populate() { return this; }, lean: async () => jobs.find((value) => value._id === jobId) }),
    },
    "../Model/applicationModel": { create() { throw new Error("Preview must not create applications"); } },
    "../Model/skillsModel": {},
    "../utils/sendEmail": () => { throw new Error("Preview must not send email"); },
    "../utils/emailTemplates": {},
    mongoose: { isValidObjectId: (value) => typeof value === "string" && /^[a-f0-9]{24}$/i.test(value) },
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../controllers/applicationController.js"), "utf8"), {
    module, exports: module.exports,
    console: { error: (...args) => calls.logs.push(args) },
    require: (name) => { if (!(name in deps)) throw new Error("Unexpected import: " + name); return deps[name]; },
  });
  return { controller: module.exports, calls };
}
async function invoke(app, body = { jobIds: defaultJobs.map((value) => value._id), cvId }, user = { id: "authenticated-user" }, method = "previewApplicationMatches") {
  const res = { status(code) { this.code = code; return this; }, json(value) { this.body = plain(value); return this; } };
  await app.controller[method]({ body, user }, res);
  return res;
}

test("batch returns high, low, zero and different-country scores in input order with one jobs query", async () => {
  const app = harness();
  const response = await invoke(app);
  assert.equal(response.code, 200);
  assert.deepEqual(response.body.matches.map((value) => value.jobId), defaultJobs.map((value) => value._id));
  assert.deepEqual(response.body.matches.map((value) => value.matchScore), [100, 20, 0, 80, 40]);
  assert.deepEqual(response.body.matches.map((value) => value.locationMatch), [true, true, false, false, true]);
  assert.equal(app.calls.jobs.length, 1);
  assert.equal(app.calls.cv.length, 1);
  assert.deepEqual(app.calls.jobs[0], { _id: { $in: defaultJobs.map((value) => value._id) } });
  assert.deepEqual(app.calls.cv[0], { _id: cvId, candidateId: 17 });
  assert.ok(app.calls.selects.some(([stage, fields]) => stage === "cv" && fields === "skills skillsDetected"));
  assert.ok(app.calls.selects.some(([stage, fields]) => stage === "jobs" && fields === "_id keySkills location"));
});

test("batch scores and breakdowns exactly match the unchanged single-job preview", async () => {
  const app = harness();
  const batch = await invoke(app);
  for (const entry of batch.body.matches) {
    const single = await invoke(app, { jobId: entry.jobId, cvId }, undefined, "previewApplicationMatch");
    assert.equal(single.code, 200);
    const { jobId, ...breakdown } = entry;
    assert.deepEqual(breakdown, single.body);
  }
});

test("response contains only requested job IDs and permitted score breakdown fields", async () => {
  const app = harness();
  const response = await invoke(app);
  assert.deepEqual(Object.keys(response.body), ["matches"]);
  for (const entry of response.body.matches) {
    assert.deepEqual(Object.keys(entry).sort(), ["jobId", "locationMatch", "matchScore", "matchedSkills", "missingSkills"].sort());
  }
  assert.deepEqual(response.body.matches[1].matchedSkills, []);
  assert.deepEqual(response.body.matches[1].missingSkills, ["SQL"]);
  assert.ok(!/PRIVATE|uploads|filePath|rawText|candidateId/.test(JSON.stringify(response.body)));
});

test("zero score remains a valid result when candidate and job have no skills or shared country", async () => {
  const app = harness({ cv: { skills: [] }, jobs: [job(1, [], "Canada")] });
  const response = await invoke(app, { jobIds: [id(1)], cvId });
  assert.equal(response.code, 200);
  assert.equal(response.body.matches[0].matchScore, 0);
  assert.equal(response.body.matches[0].locationMatch, false);
});

test("case-insensitive duplicate IDs are calculated and returned only once", async () => {
  const record = job(0xabcdef);
  const app = harness({ jobs: [record] });
  const response = await invoke(app, { jobIds: [record._id.toUpperCase(), record._id, ...Array(60).fill(record._id)], cvId });
  assert.equal(response.code, 200);
  assert.equal(response.body.matches.length, 1);
  assert.equal(response.body.matches[0].jobId, record._id);
  assert.equal(app.calls.jobs[0]._id.$in.length, 1);
});

test("exactly 50 unique jobs are allowed in one query; 51 are rejected before database access", async () => {
  const jobs = Array.from({ length: 51 }, (_, index) => job(index + 1));
  const allowed = harness({ jobs });
  assert.equal((await invoke(allowed, { jobIds: jobs.slice(0, 50).map((value) => value._id), cvId })).code, 200);
  assert.equal(allowed.calls.jobs.length, 1);
  const rejected = harness({ jobs });
  const response = await invoke(rejected, { jobIds: jobs.map((value) => value._id), cvId });
  assert.equal(response.code, 400);
  assert.match(response.body.message, /50 unique/);
  assert.equal(rejected.calls.user.length, 0);
});

test("malformed input, missing IDs and injection-shaped IDs return clear 400 errors", async () => {
  for (const body of [null, {}, { jobIds: [], cvId }, { jobIds: "not-an-array", cvId },
    { jobIds: [id(1)], cvId: "invalid" }, { jobIds: [id(1)] },
    ...[null, 123, {}, { $ne: null }, "invalid", "a".repeat(12)].map((value) => ({ jobIds: [id(1), value], cvId })),
  ]) {
    const app = harness();
    const response = await invoke(app, body);
    assert.equal(response.code, 400);
    assert.ok(response.body.message);
    assert.equal(app.calls.user.length, 0);
    assert.equal(app.calls.jobs.length, 0);
  }
});

test("requests without authenticated user return 401 before database access", async () => {
  const app = harness();
  const response = await invoke(app, { jobIds: [id(1)], cvId }, null);
  assert.equal(response.code, 401);
  assert.equal(app.calls.user.length, 0);
});

test("non-candidate or missing user returns 403 without accessing CVs or jobs", async () => {
  for (const options of [{ role: "company" }, { role: "guest" }, { missingUser: true }]) {
    const app = harness(options);
    assert.equal((await invoke(app)).code, 403);
    assert.equal(app.calls.cv.length, 0);
    assert.equal(app.calls.jobs.length, 0);
  }
});

test("missing or another candidate's CV returns the same safe 404", async () => {
  const app = harness({ ownCv: false });
  const response = await invoke(app);
  assert.equal(response.code, 404);
  assert.match(response.body.message, /not found or does not belong/);
  assert.equal(app.calls.cv[0].candidateId, 17);
  assert.equal(app.calls.jobs.length, 0);
});

test("a valid but missing job ID returns 404 instead of an incomplete success", async () => {
  const app = harness();
  const response = await invoke(app, { jobIds: [id(1), id(1000)], cvId });
  assert.equal(response.code, 404);
  assert.match(response.body.message, /jobs were not found/);
  assert.equal(app.calls.jobs.length, 1);
});

test("database failures return generic errors and safe logs", async () => {
  for (const dbError of ["user", "cv", "jobs"]) {
    const app = harness({ dbError });
    const response = await invoke(app);
    assert.equal(response.code, 500);
    assert.equal(response.body.message, "Unable to preview application matches.");
    assert.deepEqual(app.calls.logs, [["Batch application score preview failed."]]);
    assert.ok(!JSON.stringify(response.body).includes("PRIVATE"));
  }
});

test("batch route uses existing authentication middleware and leaves single preview registered", () => {
  const registered = [];
  const auth = () => {};
  const batch = () => {};
  const single = () => {};
  const router = { post: (...args) => registered.push(args), get() {}, put() {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../routes/applicationRoutes.js"), "utf8"), {
    module: { exports: {} }, require: (name) => {
      if (name === "express") return { Router: () => router };
      if (name.endsWith("/auth")) return auth;
      return { previewApplicationMatches: batch, previewApplicationMatch: single };
    },
  });
  const batchRoute = registered.find(([route]) => route === "/preview-matches");
  const singleRoute = registered.find(([route]) => route === "/preview-match");
  assert.equal(batchRoute[1], auth);
  assert.equal(batchRoute[2], batch);
  assert.equal(singleRoute[1], auth);
  assert.equal(singleRoute[2], single);
});
