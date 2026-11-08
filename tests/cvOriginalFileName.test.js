const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { sanitizeOriginalFileName } = require("../utils/cvFileName");
const CV = require("../Model/CvModel");

test("filename sanitization strips Windows/POSIX paths, control characters and unsafe punctuation", () => {
  for (const [input, expected] of [
    ["C:\\fakepath\\My CV.pdf", "My CV.pdf"],
    ["/home/private/My r\u00e9sum\u00e9 2026.pdf", "My r\u00e9sum\u00e9 2026.pdf"],
    ["../../My CV.pdf", "My CV.pdf"],
    ["  My\u0000 CV\r\n<>:\"|?*\u202e.pdf  ", "My CV.pdf"],
    ["CV \u65e5\u672c\u8a9e.pdf", "CV \u65e5\u672c\u8a9e.pdf"],
  ]) assert.equal(sanitizeOriginalFileName(input), expected);
  for (const value of [undefined, null, 17, "", "   ", "..", "/", "\\"]) {
    assert.equal(sanitizeOriginalFileName(value), undefined);
  }
  assert.equal(sanitizeOriginalFileName("a".repeat(300)).length, 255);
});

test("originalFileName is optional and older CV documents retain generated storage metadata", () => {
  const old = new CV({ fileName: "17_v2.pdf", filePath: "/uploads/cvs/17/17_v2.pdf", version: 2 });
  assert.equal(old.validateSync(), undefined);
  assert.equal(old.originalFileName, undefined);
  assert.equal(old.fileName, "17_v2.pdf");
  const current = new CV({ fileName: "17_v3.pdf", filePath: "/uploads/cvs/17/17_v3.pdf", originalFileName: "My CV.pdf" });
  assert.equal(current.validateSync(), undefined);
  assert.equal(current.toObject().originalFileName, "My CV.pdf");
});

async function upload(method, originalname) {
  let record;
  const moves = [];
  const deps = {
    "../Model/CvModel": {
      countDocuments: async () => 1,
      create: async (value) => { record = value; return value; },
      findOneAndUpdate: async (_query, update) => { record = update.$set; return record; },
    },
    "../utils/cvFileName": { sanitizeOriginalFileName },
    "../Model/UserModel": { findById: async () => ({ role: "candidate", userId: 17 }) },
    path,
    "fs/promises": {
      mkdir: async () => {},
      rename: async (...args) => moves.push(args),
      unlink: async () => {},
      open: async () => ({ read: async (buffer) => { buffer.write("%PDF-"); return { bytesRead: 5 }; }, close: async () => {} }),
    },
    "pdf-parse-new": { default: () => {} },
    "../services/CVAnalyse": async () => ({ rawText: "CV text", skillsDetected: ["React"] }),
    "../Model/skillsModel": { findOneAndUpdate: async () => ({}) },
    "../Model/applicationModel": {},
  };
  const exports = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../controllers/cvController.js"), "utf8"), {
    exports, Buffer, __dirname: path.join(__dirname, "../controllers"), console: { log() {}, error() {} },
    require: (name) => { if (!(name in deps)) throw new Error("Unexpected dependency: " + name); return deps[name]; },
  });
  const req = { user: { id: "authenticated-user" }, body: { guestSessionId: "guest-session" },
    file: { originalname, mimetype: "application/pdf", path: "temporary-upload.pdf", filename: "generated-guest.pdf" } };
  const res = { status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
  await exports[method](req, res);
  return { record, moves, res };
}

test("candidate upload saves sanitized original filename without changing secure storage naming", async () => {
  const result = await upload("uploadCV", "C:\\fakepath\\My r\u00e9sum\u00e9\u0000?.pdf");
  assert.equal(result.res.code, 201);
  assert.equal(result.record.originalFileName, "My r\u00e9sum\u00e9.pdf");
  assert.equal(result.record.fileName, "17_v2.pdf");
  assert.equal(result.record.filePath, "/uploads/cvs/17/17_v2.pdf");
  assert.equal(path.basename(result.moves[0][1]), "17_v2.pdf");
  assert.equal(result.res.body.cv.originalFileName, "My r\u00e9sum\u00e9.pdf");
});

test("guest upload saves original metadata while retaining generated guest filename and path", async () => {
  const result = await upload("guestUploadCV", "/private/My CV.pdf");
  assert.equal(result.res.code, 200);
  assert.equal(result.record.originalFileName, "My CV.pdf");
  assert.equal(result.record.fileName, "generated-guest.pdf");
  assert.equal(result.record.filePath, "/uploads/cvs/generated-guest.pdf");
});

test("missing original upload name remains optional", async () => {
  const result = await upload("uploadCV", undefined);
  assert.equal(result.res.code, 201);
  assert.equal(result.record.originalFileName, undefined);
  assert.equal(result.record.fileName, "17_v2.pdf");
});
