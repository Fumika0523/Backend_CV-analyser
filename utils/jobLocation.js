const LOCATION_TYPES = ["city", "county", "region", "country"];
const WORK_MODES = ["Office", "Hybrid", "Remote"];
const LOCATION_FIELDS = [
  "city", "country", "county", "region", "locationType",
  "displayName", "providerPlaceId",
];

const hasText = (value) => typeof value === "string" && value.trim() !== "";
const result = (errors) => ({ valid: errors.length === 0, errors });

/**
 * Future location policy, intentionally not used by controllers in Stage 1.
 * Unlike today's schema, Remote locations may omit city when an explicit
 * county/region/country type is supplied. A metropolitan area uses type city
 * and its name in city; no provider lookup or geographical verification occurs.
 * Legacy objects without locationType, and "city, country" strings, are
 * treated as city locations. Inputs are never mutated.
 */
const validateJobLocation = (location, workMode) => {
  if (!WORK_MODES.includes(workMode)) {
    return result(["Work mode must be Office, Hybrid or Remote."]);
  }

  if (typeof location === "string") {
    const parts = location.split(",").map((part) => part.trim());
    if (parts.length !== 2 || parts.some((part) => !part)) {
      return result(["Legacy location must contain city and country."]);
    }
    location = { city: parts[0], country: parts[1] };
  }

  if (!location || typeof location !== "object" || Array.isArray(location)) {
    return result(["A location with a country is required."]);
  }

  const errors = [];
  for (const field of LOCATION_FIELDS) {
    if (location[field] !== undefined && typeof location[field] !== "string") {
      errors.push(`Location ${field} must be a string.`);
    }
  }

  if (!hasText(location.country)) {
    errors.push("Location country is required.");
  }

  // Do not guess county or region for old records that lack a type.
  const locationType = location.locationType === undefined
    ? "city"
    : location.locationType;

  if (!LOCATION_TYPES.includes(locationType)) {
    errors.push("Location type must be city, county, region or country.");
  } else {
    if (workMode !== "Remote" && locationType !== "city") {
      errors.push("Office and Hybrid jobs require a city or metropolitan area.");
    }

    if (locationType !== "country" && !hasText(location[locationType])) {
      errors.push(`Location ${locationType} is required.`);
    }
  }

  return result(errors);
};

const isLocationObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const legacyLocationObject = (location) => {
  if (typeof location === "string") {
    const parts = location.split(",").map((part) => part.trim());
    return parts.length === 2 && parts.every(hasText)
      ? { city: parts[0], country: parts[1] }
      : null;
  }
  return isLocationObject(location) && location.locationType === undefined
    ? location
    : null;
};

const preservesLegacyLocation = (existingLocation, submittedLocation) => {
  const existing = legacyLocationObject(existingLocation);
  const submitted = legacyLocationObject(submittedLocation);
  if (!existing || !submitted) {
    return false;
  }

  return LOCATION_FIELDS.every((field) => {
    const before = existing[field];
    const after = submitted[field];
    if ((before !== undefined && typeof before !== "string") ||
        (after !== undefined && typeof after !== "string")) {
      return false;
    }
    // Case and surrounding whitespace do not change city/country identity.
    // Compare metadata too, so an echoed string cannot discard stored details.
    const normalize = (value) => {
      const text = (value ?? "").trim();
      return field === "city" || field === "country" ? text.toLowerCase() : text;
    };
    return normalize(before) === normalize(after);
  });
};

/**
 * For future plain controller update payloads (not MongoDB update operators).
 * Unrelated edits preserve old records. Echoed legacy city/country data may
 * remain legacy only when its meaning and metadata have not changed.
 * All other supplied locations replace the stored value and need an explicit
 * structured type. This checks shape and policy, not provider authenticity.
 */
const validateJobLocationUpdate = (existingJob, updates) => {
  if (!isLocationObject(updates) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(updates))) {
    return result(["Job updates must be a plain object."]);
  }
  if (!isLocationObject(existingJob)) {
    return result(["An existing job is required."]);
  }

  const changesLocation = Object.hasOwn(updates, "location");
  const changesWorkMode = Object.hasOwn(updates, "workMode");

  if (!changesLocation && !changesWorkMode) {
    return result([]);
  }

  if (changesLocation &&
      !preservesLegacyLocation(existingJob.location, updates.location) &&
      (!isLocationObject(updates.location) ||
       !LOCATION_TYPES.includes(updates.location.locationType))) {
    return result(["Location changes require a structured location with an explicit location type."]);
  }

  return validateJobLocation(
    changesLocation ? updates.location : existingJob.location,
    changesWorkMode ? updates.workMode : existingJob.workMode
  );
};

module.exports = { validateJobLocation, validateJobLocationUpdate };
