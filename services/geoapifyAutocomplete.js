const axios = require("axios");

const AUTOCOMPLETE_URL = "https://api.geoapify.com/v1/geocode/autocomplete";
const RESULT_TYPE_MAP = {
  city: "city",
  county: "county",
  state: "region",
  country: "country",
};

class GeoapifyAutocompleteError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = "GeoapifyAutocompleteError";
    this.code = code;
    if (status !== undefined) {
      this.status = status;
    }
  }
}

const text = (value) =>
  typeof value === "string" ? value.trim() : "";

const mapSuggestion = (result) => {
  const locationType = RESULT_TYPE_MAP[result?.result_type];
  const providerPlaceId = text(result?.place_id);
  const country = text(result?.country);
  const displayName = text(result?.formatted) || text(result?.name);

  if (!locationType || !providerPlaceId || !country || !displayName) {
    return null;
  }

  const location = {
    city: text(result.city),
    country,
    county: text(result.county),
    region: text(result.state),
    locationType,
    displayName,
    providerPlaceId,
  };

  const selectedField = {
    city: location.city,
    county: location.county,
    region: location.region,
    country: location.country,
  }[locationType];

  return selectedField ? location : null;
};

const providerError = (status) => {
  if (status === 401 || status === 403) {
    return new GeoapifyAutocompleteError(
      "Geoapify authentication or API configuration failed.",
      "PROVIDER_AUTH_ERROR",
      status
    );
  }
  if (status === 429) {
    return new GeoapifyAutocompleteError(
      "Geoapify rate limit was reached.",
      "PROVIDER_RATE_LIMITED",
      status
    );
  }
  return new GeoapifyAutocompleteError(
    "Location suggestions are temporarily unavailable.",
    "PROVIDER_UNAVAILABLE",
    status
  );
};

const autocompleteGeoapifyLocations = async (
  { query, scope },
  {
    apiKey = process.env.GEOAPIFY_API_KEY,
    httpClient = axios,
    timeout = 5000,
    limit = 5,
  } = {}
) => {
  const cleanQuery = text(query);
  if (cleanQuery.length < 2 || cleanQuery.length > 100) {
    throw new GeoapifyAutocompleteError(
      "Search text must contain 2 to 100 characters.",
      "INVALID_INPUT"
    );
  }
  if (!Object.hasOwn({ locality: true, country: true }, scope)) {
    throw new GeoapifyAutocompleteError(
      "Search scope must be locality or country.",
      "INVALID_INPUT"
    );
  }
  if (!text(apiKey)) {
    throw new GeoapifyAutocompleteError(
      "Geoapify API key is not configured.",
      "MISSING_API_KEY"
    );
  }
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 30000 ||
      !Number.isInteger(limit) || limit < 1 || limit > 10) {
    throw new GeoapifyAutocompleteError(
      "Autocomplete request configuration is invalid.",
      "INVALID_CONFIGURATION"
    );
  }

  let response;
  try {
    response = await httpClient.get(AUTOCOMPLETE_URL, {
      params: {
        text: cleanQuery,
        type: scope === "country" ? "country" : "locality",
        format: "json",
        limit,
        apiKey: apiKey.trim(),
      },
      timeout,
    });
  } catch (error) {
    throw providerError(error.response?.status);
  }

  if (!Array.isArray(response.data?.results)) {
    throw new GeoapifyAutocompleteError(
      "Geoapify returned an invalid autocomplete response.",
      "INVALID_PROVIDER_RESPONSE"
    );
  }

  return response.data.results.map(mapSuggestion).filter(Boolean);
};

module.exports = {
  AUTOCOMPLETE_URL,
  GeoapifyAutocompleteError,
  autocompleteGeoapifyLocations,
};
