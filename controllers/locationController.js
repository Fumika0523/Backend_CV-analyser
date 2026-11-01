const {
  autocompleteGeoapifyLocations,
  GeoapifyAutocompleteError,
} = require("../services/geoapifyAutocomplete");
const {
  assertLocationTokenConfiguration,
  createLocationToken,
  LocationTokenError,
} = require("../utils/locationToken");

const createLocationAutocompleteHandler = ({
  autocomplete = autocompleteGeoapifyLocations,
  assertTokenConfiguration = assertLocationTokenConfiguration,
  createToken = createLocationToken,
} = {}) => async (req, res) => {
  try {
    assertTokenConfiguration();

    const locations = await autocomplete({
      query: req.query.q,
      scope: req.query.scope,
    });

    const suggestions = locations.map((location) => ({
      displayLabel: location.displayName,
      location,
      token: createToken({
        providerPlaceId: location.providerPlaceId,
        locationType: location.locationType,
      }),
    }));

    return res.status(200).json({ suggestions });
  } catch (error) {
    if (error instanceof GeoapifyAutocompleteError &&
        error.code === "INVALID_INPUT") {
      return res.status(400).json({ message: error.message });
    }
    if (error instanceof GeoapifyAutocompleteError ||
        error instanceof LocationTokenError) {
      return res.status(503).json({
        message: "Location suggestions are temporarily unavailable.",
      });
    }

    console.error("Location autocomplete error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.createLocationAutocompleteHandler = createLocationAutocompleteHandler;
exports.autocompleteLocations = createLocationAutocompleteHandler();
