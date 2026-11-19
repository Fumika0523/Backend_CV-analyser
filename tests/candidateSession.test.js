const { test } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");
const User = require("../Model/UserModel");
const CV = require("../Model/CvModel");
const Skill = require("../Model/skillsModel");
const Application = require("../Model/applicationModel");
const Job = require("../Model/jobModel");
const userRoutes = require("../routes/userRoutes");
const jobRoutes = require("../routes/jobRoutes");
const skillsRoutes = require("../routes/skillsRoute");

const secret = "auth-01-local-test-key";
process.env.JWT_SECRET_KEY = secret;

async function get(router, path, { token, query = {} } = {}) {
  const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods.get).route;
  const req = { query, header: () => token && `Bearer ${token}` };
  const response = {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    json(body) { this.body = body; return this; },
  };
  async function run(index) {
    let next;
    await route.stack[index].handle(req, response, () => { next = run(index + 1); });
    await next;
  }
  await run(0);
  return response;
}

test("the auth session endpoint returns minimal data and takes the role from the current user", async (t) => {
  const sessionRoute = userRoutes.stack.find((layer) => layer.route?.path === "/auth/session");
  assert.equal(sessionRoute.route.stack[0].handle, auth);
  const lookup = t.mock.method(User, "findById", (id) => ({
    select: async () => ({ id, role: id, email: "private@example.invalid", userId: 17 }),
  }));

  for (const role of ["candidate", "company"]) {
    const token = jwt.sign({ id: role, role: "stale-role" }, secret, { expiresIn: "3h" });
    const res = await get(userRoutes, "/auth/session", { token });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.deepEqual(res.body, {
      user: { id: role, role },
      expiresAt: jwt.decode(token).exp * 1000,
    });
  }
  assert.equal(lookup.mock.callCount(), 2);
});

test("visitors, invalid JWTs and expired JWTs cannot establish a user session", async (t) => {
  const lookup = t.mock.method(User, "findById", () => assert.fail("No user lookup expected"));
  const log = t.mock.method(console, "error", () => {});
  const expired = jwt.sign({ id: "candidate" }, secret, { expiresIn: -1 });
  for (const token of [undefined, "invalid", expired]) {
    const res = await get(userRoutes, "/auth/session", { token });
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.user, undefined);
  }
  assert.equal(lookup.mock.callCount(), 0);
  assert.equal(log.mock.callCount(), 0);
});

test("the guest matching API requires both an uploaded guest CV and its extracted skill record", async (t) => {
  const cv = t.mock.method(CV, "exists", async ({ guestSessionId, candidateId }) => {
    assert.equal(candidateId, null);
    return guestSessionId === "uploaded-cv" || guestSessionId === "empty-cv" ? { _id: "cv" } : null;
  });
  t.mock.method(Skill, "findOne", async ({ guestSessionId, candidateId }) => {
    assert.equal(candidateId, null);
    return { skills: guestSessionId === "empty-cv" ? [] : ["JavaScript", "React"] };
  });
  const jobRows = [
    { _id: "lower-1", title: "Software Engineer", keySkills: ["React", "JavaScript", "CSS"] },
    {
      _id: "highest", title: "Web Engineer at Example Corp (UK)", keySkills: ["React"],
      companyId: { _id: "company-private-id", companyName: "Example Corp (UK)", companyUrl: "https://example.com", isActive: true },
      companyUrl: "https://careers.example.com", postedByName: "Jane Recruiter",
      postedByEmail: "jane@example.com", externalApplyUrl: "https://apply.example.com",
      roleSummary: "Call Jane Recruiter at +44 1234 567890",
      location: { city: "London", country: "United Kingdom", displayName: "Example Corp HQ",
        providerPlaceId: "office-private-id", contact: { email: "jane@example.com" } },
      salary: "\u00a340,000\u2013\u00a350,000", jobType: "Full-time", workMode: "Hybrid",
    },
    { _id: "lower-2", title: "Full Stack Engineer jane@example.com example.com +44 1234 567890", keySkills: ["React", "JavaScript", "HTML"] },
    { _id: "lower-3", title: "Fourth role", keySkills: ["React", "JavaScript", "Python"] },
  ];
  const jobs = t.mock.method(Job, "find", () => ({
    populate: () => ({ lean: async () => jobRows }),
  }));

  assert.equal((await get(jobRoutes, "/guest/matched-jobs")).statusCode, 400);
  assert.equal((await get(jobRoutes, "/guest/matched-jobs", { query: { guestSessionId: ["uploaded-cv"] } })).statusCode, 400);
  assert.equal(cv.mock.callCount(), 0);
  assert.equal((await get(jobRoutes, "/guest/matched-jobs", { query: { guestSessionId: "no-cv" } })).statusCode, 404);
  const empty = await get(jobRoutes, "/guest/matched-jobs", { query: { guestSessionId: "empty-cv" } });
  assert.equal(empty.statusCode, 200);
  assert.deepEqual(empty.body.matchedJobs, []);
  assert.equal(jobs.mock.callCount(), 0);
  const res = await get(jobRoutes, "/guest/matched-jobs", { query: { guestSessionId: "uploaded-cv" } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Cache-Control"], "no-store");
  const preview = JSON.parse(JSON.stringify(res.body.matchedJobs));
  assert.deepEqual(preview.map(({ title, matchScore }) => [title, matchScore]), [
    ["Web Engineer", 100], ["Software Engineer", 67], ["Full Stack Engineer", 67],
  ]);
  assert.deepEqual(preview[0], {
    title: "Web Engineer", location: { city: "London", country: "United Kingdom" },
    salary: "\u00a340,000\u2013\u00a350,000", jobType: "Full-time", workMode: "Hybrid",
    keySkills: ["React"], matchScore: 100,
  });
  assert.doesNotMatch(JSON.stringify(preview), /company|employer|recruiter|example\.com|private-id|highest|matchedSkills|missingSkills|567890/i);
});

test("candidate matching and skills still enforce authentication and role on direct API calls", async (t) => {
  t.mock.method(User, "findById", (id) => ({
    select: async () => ({ id, role: "company", userId: 27 }),
  }));
  const token = jwt.sign({ id: "company", role: "candidate" }, secret, { expiresIn: "3h" });

  for (const [router, path] of [
    [jobRoutes, "/candidate/matched-jobs"],
    [skillsRoutes, "/my-skills"],
  ]) {
    assert.equal((await get(router, path)).statusCode, 401);
    assert.equal((await get(router, path, { token })).statusCode, 403);
  }
});

test("registered candidate matches still include employer links and the full breakdown", async (t) => {
  const user = { id: "candidate", role: "candidate", userId: 27, location: { city: "London", country: "United Kingdom" } };
  t.mock.method(User, "findById", () => Object.assign(Promise.resolve(user), { select: async () => user }));
  t.mock.method(Skill, "findOne", async () => ({ skills: ["React", "JavaScript"] }));
  t.mock.method(Application, "find", () => ({ select: async () => [] }));
  t.mock.method(Job, "find", () => ({ populate: () => ({ lean: async () => [{
    _id: "job-id", title: "Engineer", companyId: { companyName: "Example Corp", companyUrl: "https://example.com", isActive: true },
    location: user.location, keySkills: ["React", "JavaScript", "CSS"],
  }] }) }));
  const token = jwt.sign({ id: user.id }, secret, { expiresIn: "3h" });
  const response = await get(jobRoutes, "/candidate/matched-jobs", { token });
  assert.equal(response.statusCode, 200);
  const [job] = response.body.matchedJobs;
  assert.equal(job.jobId, "job-id");
  assert.equal(job.companyName, "Example Corp");
  assert.equal(job.companyUrl, "https://example.com");
  assert.deepEqual(job.matchedSkills, ["React", "JavaScript"]);
  assert.deepEqual(job.missingSkills, ["CSS"]);
  assert.equal(job.locationMatch, true);
});
