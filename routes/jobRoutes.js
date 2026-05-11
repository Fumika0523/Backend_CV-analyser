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

const authMiddleware = require("../middleware/auth");

router.post("/create", authMiddleware, createJobPost);
router.get("/all-jobs", getAllJobPosts);
router.get("/my-jobs", authMiddleware, getMyCompanyJobPosts);
router.get("/:id", getSingleJobPost);
router.put("/:id", authMiddleware, updateJobPost);
router.delete("/:id", authMiddleware, deleteJobPost);

module.exports = router;