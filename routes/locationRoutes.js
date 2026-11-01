const express = require("express");
const {
  autocompleteLocations,
} = require("../controllers/locationController");
const locationAutocompleteRateLimit = require(
  "../middleware/locationAutocompleteRateLimit"
);

const router = express.Router();

router.get(
  "/api/locations/autocomplete",
  locationAutocompleteRateLimit,
  autocompleteLocations
);

module.exports = router;
