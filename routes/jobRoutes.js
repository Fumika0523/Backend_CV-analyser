const express = require("express");
const router = express.Router();

const {
  createJobPost,
  getAllJobPosts,
  getMyCompanyJobPosts,
  getSingleJobPost,
  updateJobPost,
  deleteJobPost,
} = require("../controllers/jobController");

const { protect } = require("../middleware/auth")

router.post("/create", protect, createJobPost);

router.get("/", getAllJobPosts);

router.get("/my-jobs", protect, getMyCompanyJobPosts);

router.get("/:id", getSingleJobPost);

router.put("/:id", protect, updateJobPost);

router.delete("/:id", protect, deleteJobPost);

module.exports = router;