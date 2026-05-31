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

const auth = require("../middleware/auth");

router.post("/create", auth, createJobPost);
router.get("/all-jobs", getAllJobPosts);
router.get("/my-jobs", auth, getMyCompanyJobPosts);
router.get("/:id", getSingleJobPost);
router.put("/:id", auth, updateJobPost);
router.delete("/:id", auth, deleteJobPost);

module.exports = router;