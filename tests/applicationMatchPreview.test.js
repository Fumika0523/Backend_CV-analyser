const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const jobId = "111111111111111111111111";
const cvId = "222222222222222222222222";
function harness({ role = "candidate", ownCv = true, skills = ["React"], missingJob = false, dbError = false } = {}) {
  let writes = 0;
  let lookup;
  const user = { userId: 17, role, email: "candidate@example.invalid", location: { country: "UK" } };
  const job = { _id: jobId, status: "Open", title: "Engineer", companyId: { _id: "company-a", isActive: true },
    applicationEndDate: "2099-01-01", filledPositions: 0, vacancies: 1, keySkills: ["React"], location: { country: "United Kingdom" } };
  const cv = { _id: cvId, skills };
  const deps = {
    "../Model/UserModel": { findById: () => ({ lean: async () => { if (dbError) throw new Error("private database data"); return user; } }) },
    "../Model/CvModel": { findOne: (query) => {
      lookup = query;
      return { lean: async () => ownCv && query.candidateId === user.userId ? cv : null };
    } },
    "../Model/jobModel": { findById: () => ({ populate() { return this; }, lean: async () => missingJob ? null : job }) },
    "../Model/applicationModel": {
      findOne: () => ({ lean: async () => null }),
      create: async (record) => { writes++; return record; },
    },
    "../Model/skillsModel": {},
    "../utils/sendEmail": async () => {},
    "../utils/emailTemplates": { candidateApplicationTemplate: () => "", companyApplicationTemplate: () => "" },
    mongoose: { isValidObjectId: (value) => typeof value === "string" && /^[a-f0-9]{24}$/.test(value) },
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../controllers/applicationController.js"), "utf8"), {
    module, exports: module.exports, console: { error() {} }, require: (name) => {
      if (!(name in deps)) throw new Error("Unexpected import " + name);
      return deps[name];
    },
  });
  return { controller: module.exports, get writes() { return writes; }, get lookup() { return lookup; } };
}
async function invoke(controller, method = "previewApplicationMatch", body = { jobId, cvId }) {
  const res = { status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
  await controller[method]({ user: { id: "authenticated-user" }, body }, res);
  return res;
}

test("preview uses selected owned CV, matches actual application algorithm and never writes", async () => {
  const app = harness();
  const preview = await invoke(app.controller);
  assert.equal(preview.code, 200);
  assert.equal(app.lookup._id, cvId);
  assert.equal(app.lookup.candidateId, 17);
  assert.equal(app.writes, 0);
  const application = await invoke(app.controller, "applyForJob");
  assert.equal(application.code, 201);
  for (const key of ["matchScore", "matchedSkills", "missingSkills", "locationMatch"]) {
    assert.deepEqual(preview.body[key], application.body.application[key]);
  }
});

test("low match score is returned without applying recommendation threshold", async () => {
  const app = harness({ skills: [] });
  const response = await invoke(app.controller);
  assert.equal(response.code, 200);
  assert.equal(response.body.matchScore, 20);
  assert.equal(app.writes, 0);
});

test("another candidate's CV is rejected without a write", async () => {
  const app = harness({ ownCv: false });
  assert.equal((await invoke(app.controller)).code, 404);
  assert.equal(app.writes, 0);
});

test("non-candidates and malformed IDs are rejected", async () => {
  const company = harness({ role: "company" });
  assert.equal((await invoke(company.controller)).code, 403);
  for (const body of [{ jobId, cvId: null }, { jobId: "invalid", cvId }, { jobId, cvId: {} }]) {
    assert.equal((await invoke(harness().controller, "previewApplicationMatch", body)).code, 400);
  }
});

test("missing job and database failures return errors without writes", async () => {
  for (const [options, code] of [[{ missingJob: true }, 404], [{ dbError: true }, 500]]) {
    const app = harness(options);
    assert.equal((await invoke(app.controller)).code, code);
    assert.equal(app.writes, 0);
  }
});

test("score preview route requires the existing auth middleware", () => {
  const registered = [];
  const auth = () => {};
  const preview = () => {};
  const router = {
    post: (...args) => registered.push(args), get() {}, put() {},
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../routes/applicationRoutes.js"), "utf8"), {
    module: { exports: {} }, require: (name) => {
      if (name === "express") return { Router: () => router };
      if (name.endsWith("/auth")) return auth;
      return { previewApplicationMatch: preview };
    },
  });
  const route = registered.find(([route]) => route === "/preview-match");
  assert.equal(route[1], auth);
  assert.equal(route[2], preview);
});
