const axios = require("axios");

const PLACE_DETAILS_URL = "https://api.geoapify.com/v2/place-details";
const MAX_PLACE_ID_LENGTH = 512;
const MIN_TIMEOUT = 100;
const MAX_TIMEOUT = 30000;

class GeoapifyLocationError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = "GeoapifyLocationError";
    this.code = code;
    if (status !== undefined) {
      this.status = status;
    }
  }
}

const hasText = (value) =>
  typeof value === "string" && value.trim() !== "";

const optionalText = (value) =>
  hasText(value) ? value.trim() : "";

const validateInputs = (providerPlaceId, apiKey, timeout) => {
  if (!hasText(providerPlaceId) ||
      providerPlaceId.trim().length > MAX_PLACE_ID_LENGTH) {
    throw new GeoapifyLocationError(
      "A valid Geoapify place ID is required.",
      "INVALID_PLACE_ID"
    );
  }

  if (!hasText(apiKey)) {
    throw new GeoapifyLocationError(
      "Geoapify API key is not configured.",
      "MISSING_API_KEY"
    );
  }

  if (!Number.isInteger(timeout) || timeout < MIN_TIMEOUT || timeout > MAX_TIMEOUT) {
    throw new GeoapifyLocationError(
      `Geoapify timeout must be an integer from ${MIN_TIMEOUT} to ${MAX_TIMEOUT} milliseconds.`,
      "INVALID_TIMEOUT"
    );
  }
};

const providerError = (status) => {
  if (status === 400 || status === 404) {
    return new GeoapifyLocationError(
      "Geoapify rejected the place ID.",
      "INVALID_PLACE_ID",
      status
    );
  }

  if (status === 401 || status === 403) {
    return new GeoapifyLocationError(
      "Geoapify authentication or API configuration failed.",
      "PROVIDER_AUTH_ERROR",
      status
    );
  }

  if (status === 429) {
    return new GeoapifyLocationError(
      "Geoapify rate limit was reached.",
      "PROVIDER_RATE_LIMITED",
      status
    );
  }

  if (status !== undefined && status < 500) {
    return new GeoapifyLocationError(
      "Geoapify could not process the verification request.",
      "PROVIDER_REQUEST_FAILED",
      status
    );
  }

  return new GeoapifyLocationError(
    "Geoapify place verification is temporarily unavailable.",
    "PROVIDER_UNAVAILABLE",
    status
  );
};

const verifyGeoapifyPlace = async (
  providerPlaceId,
  {
    apiKey = process.env.GEOAPIFY_API_KEY,
    httpClient = axios,
    timeout = 5000,
  } = {}
) => {
  validateInputs(providerPlaceId, apiKey, timeout);

  let response;
  try {
    response = await httpClient.get(PLACE_DETAILS_URL, {
      params: {
        id: providerPlaceId.trim(),
        apiKey: apiKey.trim(),
      },
      timeout,
    });
  } catch (error) {
    throw providerError(error.response?.status);
  }

  const features = response.data?.features;
  const details = Array.isArray(features)
    ? features.find(
        (feature) => feature?.properties?.feature_type === "details"
      )
    : undefined;
  const properties = details?.properties;

  if (!properties ||
      !hasText(properties.place_id) ||
      properties.place_id.trim().length > MAX_PLACE_ID_LENGTH ||
      !hasText(properties.country)) {
    throw new GeoapifyLocationError(
      "Geoapify returned an incomplete place record.",
      "INVALID_PROVIDER_RESPONSE"
    );
  }

  return {
    providerPlaceId: properties.place_id.trim(),
    displayName: optionalText(properties.formatted) || optionalText(properties.name),
    city: optionalText(properties.city),
    county: optionalText(properties.county),
    region: optionalText(properties.state),
    country: properties.country.trim(),
  };
};

module.exports = {
  GeoapifyLocationError,
  PLACE_DETAILS_URL,
  verifyGeoapifyPlace,
};
