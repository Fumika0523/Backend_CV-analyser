const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadController(file, dependencies) {
  const exports = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../controllers", file), "utf8"), {
    exports, __dirname: path.join(__dirname, "../controllers"),
    console: { log() {}, error() {} },
    process: { env: { JWT_SECRET_KEY: "test-secret" } },
    require(name) {
      assert.ok(name in dependencies, name);
      return dependencies[name];
    },
  });
  return exports;
}

async function run(handler, req) {
  const result = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler(req, result);
  return result;
}

test("guest CV remains available through signup and bad OTP, then the verified candidate receives its CV and skills", async () => {
  let user;
  let cv = { _id: "cv", guestSessionId: "uploaded-cv", candidateId: null, skills: ["React"] };
  let skill;
  let failSkills = false;
  const events = [];
  const controller = loadController("authController.js", {
    jsonwebtoken: { sign: () => "verified-token" },
    "../Model/companyModel": {},
    "../Model/UserModel": {
      findOne: async () => null,
      create: async (data) => user = {
        ...data, _id: "user", otpAttempts: 0,
        save: async () => events.push("save user"),
      },
      findById: () => ({ select: async () => user }),
    },
    bcryptjs: { genSalt: async () => "salt", hash: async () => "hash" },
    "../utils/sendEmail": async () => { events.push("sent OTP"); },
    "../utils/getNextSequence": async () => 27,
    "../Model/CvModel": {
      findOneAndUpdate: async (query, change) => {
        if (cv.guestSessionId !== query.guestSessionId || !query.candidateId.$in.includes(cv.candidateId)) return null;
        cv = { ...cv, ...change.$set };
        events.push("claim CV");
        return cv;
      },
      updateOne: async (query) => {
        assert.equal(query._id, cv._id);
        delete cv.guestSessionId;
      },
    },
    "../Model/skillsModel": {
      updateOne: async (query, change, options) => {
        if (failSkills) throw new Error("temporary persistence failure");
        assert.equal(options.upsert, true);
        skill = { ...query, ...change.$set };
        events.push("save skills");
      },
    },
    "../utils/emailTemplates": { otpEmailTemplate: () => "OTP email" },
    "../utils/validateEmail": async (email) => ({ status: "valid", email }),
  });

  const signup = await run(controller.signUp, {
    body: { email: "test@example.invalid", role: "candidate", guestSessionId: "uploaded-cv" },
  });
  assert.equal(signup.code, 201);
  assert.equal(cv.candidateId, null);
  assert.equal(cv.guestSessionId, "uploaded-cv");
  assert.equal(signup.body.pendingGuestSessionId, undefined);

  const invalid = await run(controller.verifyOtp, { body: { _id: "user", otp: "invalid" } });
  assert.equal(invalid.code, 400);
  assert.equal(cv.candidateId, null);

  failSkills = true;
  const correctOtp = user.otp;
  const failed = await run(controller.verifyOtp, { body: { _id: "user", otp: correctOtp } });
  assert.equal(failed.code, 500);
  assert.equal(user.isVerified, false);
  assert.equal(cv.guestSessionId, "uploaded-cv");

  failSkills = false;
  const verified = await run(controller.verifyOtp, { body: { _id: "user", otp: correctOtp } });
  assert.equal(verified.code, 200);
  assert.equal(verified.body.token, "verified-token");
  assert.equal(user.isVerified, true);
  assert.equal(cv.candidateId, 27);
  assert.equal(cv.guestSessionId, undefined);
  assert.equal(user.pendingGuestSessionId, undefined);
  assert.deepEqual(skill, { candidateId: 27, userMongoId: "user", skills: ["React"] });
});

test("the existing authenticated download can find a claimed guest PDF without granting other candidates access", async () => {
  const storedName = "1234567890-123456789.pdf";
  const cv = { _id: "cv", fileName: storedName, filePath: "/uploads/cvs/" + storedName, candidateId: 27 };
  const controller = loadController("cvController.js", {
    "../Model/CvModel": { findById: async () => cv },
    "../utils/cvFileName": { sanitizeOriginalFileName: () => undefined },
    "../Model/UserModel": {}, path,
    "fs/promises": {
      access: async (requested) => {
        if (!requested.endsWith(path.join("uploads", "temp", storedName))) throw new Error("File not found");
      },
    },
    "pdf-parse-new": {}, "../services/CVAnalyse": {}, "../Model/skillsModel": {}, "../Model/applicationModel": {},
  });
  const unauthorized = await run(controller.downloadCV, { params: { id: "cv" }, user: { role: "candidate", userId: 99 } });
  assert.equal(unauthorized.code, 403);
  let downloaded;
  await controller.downloadCV({ params: { id: "cv" }, user: { role: "candidate", userId: 27 } }, {
    download(file) { downloaded = file; },
    status(code) { assert.fail("Download failed with status " + code); },
  });
  assert.ok(downloaded.endsWith(path.join("uploads", "temp", storedName)));
});
