const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Job = require("../Model/jobModel");

// In-memory validation only: no database connection or writes.
const makeJob = (location) => new Job({
  companyId: new mongoose.Types.ObjectId(),
  createdBy: new mongoose.Types.ObjectId(),
  title: "Developer",
  education: "Degree",
  experience: "2 years",
  postedByName: "Test Recruiter",
  roleSummary: "Build software",
  compensationBenefits: "Pension",
  category: "IT & Software",
  industry: "Technology",
  applicationEndDate: new Date("2030-01-01"),
  salary: "50000",
  location,
});

test("legacy city/country documents need no new location fields", () => {
  const job = makeJob({ city: "London", country: "United Kingdom" });
  assert.equal(job.validateSync(), undefined);
  for (const field of ["county", "region", "locationType", "displayName", "providerPlaceId"]) {
    assert.equal(job.location[field], undefined);
  }
});

test("all optional nested location fields are retained", () => {
  const location = {
    city: "London",
    country: "United Kingdom",
    county: "Greater London",
    region: "England",
    locationType: "city",
    displayName: "London, United Kingdom",
    providerPlaceId: "provider-123",
  };
  const job = makeJob(location);
  assert.equal(job.validateSync(), undefined);
  assert.deepEqual(job.toObject().location, location);
});

test("locationType accepts only the four planned types", () => {
  for (const locationType of ["city", "county", "region", "country"]) {
    const job = makeJob({ city: "London", country: "United Kingdom", locationType });
    assert.equal(job.validateSync(), undefined);
  }
  const invalidJob = makeJob({ city: "London", country: "United Kingdom", locationType: "state" });
  assert.equal(invalidJob.validateSync().errors["location.locationType"].kind, "enum");
});

test("legacy and city locations still require city and country", () => {
  for (const location of [undefined, {}, { country: "United Kingdom" }, { city: "London" }]) {
    const job = makeJob(location);
    job.workMode = "Remote";
    const error = job.validateSync();
    assert.ok(error);
    assert.ok(error.errors["location.city"] || error.errors["location.country"]);
  }
});

test("explicit non-city Remote locations may omit city", () => {
  for (const location of [
    { county: "Kent", country: "United Kingdom", locationType: "county" },
    { region: "Scotland", country: "United Kingdom", locationType: "region" },
    { country: "Canada", locationType: "country" },
  ]) {
    const job = makeJob(location);
    job.workMode = "Remote";
    assert.equal(job.validateSync(), undefined);
    assert.equal(job.location.city, undefined);
  }
});
