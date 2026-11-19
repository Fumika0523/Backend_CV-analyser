const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  createAnalyseJobDescriptionPDFHandler,
} = require("../controllers/jobAiController");

const PRIVATE = "PRIVATE_API_KEY_AND_PDF_CONTENT";
const success = {
  output_text: JSON.stringify({
    title: " Developer ",
    jobType: "Full-time",
    workMode: "Remote",
    keySkills: [" Node.js ", "node.js", "", 42],
    responsibilities: ["Build", "build"],
    requirements: ["Experience", "Experience"],
    applicationEndDate: "not a date",
    salary: "unsupported salary",
    vacancies: 0,
  }),
};

const unavailable = (statusCode = 503, headers) => Object.assign(
  new Error(PRIVATE),
  { statusCode, headers, body: PRIVATE, request: { pdf: PRIVATE } }
);

async function analyse(t, {
  outcomes = [success], fallback, headers, request,
  readError, deleteError,
} = {}) {
  const calls = [];
  const waits = [];
  const deleted = [];
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  const handler = createAnalyseJobDescriptionPDFHandler({
    env: {
      GEMINI_API_KEY: PRIVATE,
      GEMINI_MODEL: "primary-model",
      GEMINI_FALLBACK_MODEL: fallback,
      NODE_ENV: "development",
    },
    loadSDK: async () => ({
      GoogleGenAI: class {
        constructor(options) {
          assert.equal(options.apiKey, PRIVATE);
          this.interactions = {
            create: async (params, options) => {
              calls.push({ params, options });
              assert.ok(calls.length <= outcomes.length, "unexpected extra attempt");
              const result = outcomes[calls.length - 1];
              if (result instanceof Error) throw result;
              return result;
            },
          };
        }
      },
    }),
    sleep: async (ms) => waits.push(ms),
    fileSystem: {
      readFile: async (file) => {
        assert.equal(file, "temporary-jd.pdf");
        if (readError) throw readError;
        return Buffer.from(PRIVATE);
      },
      unlink: async (file) => {
        deleted.push(file);
        if (deleteError) throw deleteError;
      },
    },
  });
  const res = {
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler(request || {
    user: { role: "company" }, file: { path: "temporary-jd.pdf" },
  }, res);
  assert.deepEqual(deleted, request && !request.file ? [] : ["temporary-jd.pdf"]);
  assert.ok(!JSON.stringify({ body: res.body, logs }).includes(PRIVATE));
  for (const args of logs) {
    assert.equal(args.length, 1);
    assert.equal(typeof args[0], "string");
  }
  for (const call of calls) {
    assert.deepEqual(call.options, {
      retries: { strategy: "none" }, timeout_ms: 30000,
    });
    assert.equal(call.params.input[1].mime_type, "application/pdf");
    assert.equal(call.params.input[1].data, Buffer.from(PRIVATE).toString("base64"));
    assert.equal(call.params.response_format.mime_type, "application/json");
    assert.equal(call.params.response_format.schema.properties.vacancies.minimum, 1);
    assert.ok(call.params.response_format.schema.required.includes("missingFields"));
  }
  return { res, calls, waits, logs };
}

test("JD PDF normal success preserves schema, normalization and cleanup", async (t) => {
  const { res, calls, waits, logs } = await analyse(t);
  assert.equal(res.code, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.model, "primary-model");
  assert.deepEqual(waits, []);
  assert.deepEqual(logs, []);
  assert.equal(res.body.jobData.title, "Developer");
  assert.equal(res.body.jobData.jobType, "Full-time");
  assert.equal(res.body.jobData.workMode, "Remote");
  assert.deepEqual(res.body.jobData.keySkills, ["Node.js"]);
  assert.deepEqual(res.body.jobData.responsibilities, ["Build"]);
  assert.equal(res.body.jobData.salary, "");
  assert.equal(res.body.jobData.vacancies, 1);
  assert.equal(res.body.jobData.applicationEndDate, "");
  assert.deepEqual(res.body.missingFields, ["applicationEndDate"]);
  assert.equal(res.body.warnings.length, 1);
});

test("temporary 503 retries the primary model once and succeeds", async (t) => {
  const { res, calls, waits } = await analyse(t, { outcomes: [unavailable(), success] });
  assert.equal(res.code, 200);
  assert.deepEqual(calls.map((call) => call.params.model), ["primary-model", "primary-model"]);
  assert.equal(waits.length, 1);
  assert.ok(waits[0] >= 1000 && waits[0] < 1250);
  assert.deepEqual(calls[0].params.input, calls[1].params.input);
  assert.equal(calls[0].params.response_format, calls[1].params.response_format);
});

test("primary 503 uses the configured fallback for the second attempt", async (t) => {
  const { res, calls, waits } = await analyse(t, {
    fallback: " fallback-model ", outcomes: [unavailable(), success],
  });
  assert.equal(res.code, 200);
  assert.deepEqual(calls.map((call) => call.params.model), ["primary-model", "fallback-model"]);
  assert.equal(waits.length, 1);
});

test("all models unavailable returns a friendly 503 after exactly two attempts", async (t) => {
  const { res, calls, waits } = await analyse(t, {
    fallback: "fallback-model", outcomes: [unavailable(), unavailable()],
  });
  assert.equal(res.code, 503);
  assert.match(res.body.message, /high demand.*try again/i);
  assert.deepEqual(Object.keys(res.body), ["message"]);
  assert.equal(calls.length, 2);
  assert.equal(waits.length, 1);
});

test("429 keeps the usage-limit response without retrying or falling back", async (t) => {
  const { res, calls, waits } = await analyse(t, {
    fallback: "fallback-model", outcomes: [unavailable(429)],
  });
  assert.equal(res.code, 429);
  assert.equal(res.body.message,
    "AI analysis is temporarily unavailable due to a usage limit. Please try again later.");
  assert.equal(calls.length, 1);
  assert.deepEqual(waits, []);
});

test("fallback 429 is still classified as a usage limit", async (t) => {
  const { res, calls } = await analyse(t, {
    fallback: "fallback-model", outcomes: [unavailable(), unavailable(429)],
  });
  assert.equal(res.code, 429);
  assert.equal(calls.length, 2);
});

test("503 respects Retry-After seconds from SDK Headers", async (t) => {
  const { res, waits } = await analyse(t, {
    outcomes: [unavailable(503, new Headers({ "Retry-After": "3" })), success],
  });
  assert.equal(res.code, 200);
  assert.deepEqual(waits, [3000]);
});

test("503 respects Retry-After HTTP dates", async (t) => {
  const now = Date.UTC(2026, 10, 4, 12);
  t.mock.method(Date, "now", () => now);
  const { waits } = await analyse(t, {
    outcomes: [unavailable(503, { "retry-after": new Date(now + 5000).toUTCString() }), success],
  });
  assert.deepEqual(waits, [5000]);
});

test("long Retry-After returns 503 rather than waiting too long or retrying early", async (t) => {
  const { res, calls, waits } = await analyse(t, {
    outcomes: [unavailable(503, { "Retry-After": "120" })],
  });
  assert.equal(res.code, 503);
  assert.equal(calls.length, 1);
  assert.deepEqual(waits, []);
});

test("malformed Retry-After and status alias still allow a bounded retry", async (t) => {
  const error = Object.assign(new Error(PRIVATE), {
    status: 503, headers: { "retry-after": "invalid" },
  });
  const { res, waits } = await analyse(t, { outcomes: [error, success] });
  assert.equal(res.code, 200);
  assert.equal(waits.length, 1);
  assert.ok(waits[0] >= 1000 && waits[0] < 1250);
});

test("non-503 provider errors are sanitized without retrying", async (t) => {
  const { res, calls } = await analyse(t, { outcomes: [unavailable(400)] });
  assert.equal(res.code, 502);
  assert.deepEqual(Object.keys(res.body), ["message"]);
  assert.equal(calls.length, 1);
});

test("invalid JSON does not expose PDF or parse-error contents", async (t) => {
  const { res, calls } = await analyse(t, { outcomes: [{ output_text: PRIVATE }] });
  assert.equal(res.code, 502);
  assert.equal(calls.length, 1);
});

test("empty output preserves failure response and cleanup", async (t) => {
  const { res } = await analyse(t, { outcomes: [{ output_text: "" }] });
  assert.equal(res.code, 502);
});

test("read and cleanup failures do not expose paths or error objects", async (t) => {
  const { res, calls, logs } = await analyse(t, {
    readError: new Error(PRIVATE), deleteError: new Error(PRIVATE),
  });
  assert.equal(res.code, 502);
  assert.equal(calls.length, 0);
  assert.equal(logs.length, 2);
});

test("unauthorized uploads still return 403 and remove the temporary file", async (t) => {
  const { res, calls } = await analyse(t, {
    request: { user: { role: "candidate" }, file: { path: "temporary-jd.pdf" } },
  });
  assert.equal(res.code, 403);
  assert.equal(calls.length, 0);
});

test("missing uploads retain existing validation", async (t) => {
  const { res, calls } = await analyse(t, { request: { user: { role: "company" } } });
  assert.equal(res.code, 400);
  assert.equal(calls.length, 0);
});
