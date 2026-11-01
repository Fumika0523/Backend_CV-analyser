const {
  LocationTokenError,
  verifyLocationToken,
} = require("../utils/locationToken");
const {
  GeoapifyLocationError,
  verifyGeoapifyPlace,
} = require("../utils/geoapifyLocation");
const { validateJobLocation } = require("../utils/jobLocation");

class VerifiedJobLocationError extends Error {
  constructor(message, code, status = 400) {
    super(message);
    this.name = "VerifiedJobLocationError";
    this.code = code;
    this.status = status;
  }
}

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const tokenError = (error) => {
  if (error.code === "EXPIRED_TOKEN") {
    return new VerifiedJobLocationError(
      "Location confirmation has expired. Please select the location again.",
      "EXPIRED_LOCATION_TOKEN"
    );
  }
  if (error.code === "MISSING_SIGNING_SECRET") {
    return new VerifiedJobLocationError(
      "Location verification is temporarily unavailable.",
      "LOCATION_CONFIGURATION_ERROR",
      503
    );
  }
  return new VerifiedJobLocationError(
    "Location confirmation is invalid. Please select the location again.",
    "INVALID_LOCATION_TOKEN"
  );
};

const providerError = (error) => {
  if (["INVALID_PLACE_ID", "INVALID_PROVIDER_RESPONSE"].includes(error.code)) {
    return new VerifiedJobLocationError(
      "The selected location could not be verified. Please select it again.",
      "LOCATION_NOT_VERIFIED"
    );
  }
  return new VerifiedJobLocationError(
    "Location verification is temporarily unavailable.",
    "LOCATION_PROVIDER_UNAVAILABLE",
    503
  );
};

const getVerifiedJobLocation = async (
  { location, locationToken, workMode },
  {
    verifyToken = verifyLocationToken,
    verifyPlace = verifyGeoapifyPlace,
  } = {}
) => {
  if (!isObject(location)) {
    throw new VerifiedJobLocationError(
      "A structured location is required.",
      "INVALID_LOCATION"
    );
  }
  if (typeof locationToken !== "string" || !locationToken.trim()) {
    throw new VerifiedJobLocationError(
      "Location confirmation is required. Please select a location.",
      "MISSING_LOCATION_TOKEN"
    );
  }

  let tokenPayload;
  try {
    tokenPayload = verifyToken(locationToken);
  } catch (error) {
    if (error instanceof LocationTokenError) {
      throw tokenError(error);
    }
    throw error;
  }

  if (location.providerPlaceId !== tokenPayload.providerPlaceId ||
      location.locationType !== tokenPayload.locationType) {
    throw new VerifiedJobLocationError(
      "Location details do not match the confirmed selection.",
      "LOCATION_TOKEN_MISMATCH"
    );
  }

  let providerLocation;
  try {
    providerLocation = await verifyPlace(tokenPayload.providerPlaceId);
  } catch (error) {
    if (error instanceof GeoapifyLocationError) {
      throw providerError(error);
    }
    throw error;
  }

  const canonicalLocation = {
    city: providerLocation.city,
    country: providerLocation.country,
    county: providerLocation.county,
    region: providerLocation.region,
    locationType: tokenPayload.locationType,
    displayName: providerLocation.displayName,
    providerPlaceId: providerLocation.providerPlaceId,
  };
  const validation = validateJobLocation(canonicalLocation, workMode);

  if (!validation.valid) {
    throw new VerifiedJobLocationError(
      validation.errors[0],
      "INCOMPATIBLE_LOCATION"
    );
  }

  return canonicalLocation;
};

module.exports = {
  VerifiedJobLocationError,
  getVerifiedJobLocation,
};
