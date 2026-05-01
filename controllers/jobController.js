const Job = require("../Model/jobModel");

// CREATE JOB POST - company only
exports.createJobPost = async (req, res) => {
  try {
    const {
      title,
      description,
      requirements,
      location,
      salary,
      jobType,
      skills,
    } = req.body;

    const companyId = req.user.id; 
    // req.user comes from auth middleware after JWT verification

    const jobPost = await JobPost.create({
      companyId,
      title,
      description,
      requirements,
      location,
      salary,
      jobType,
      skills,
    });

    res.status(201).json({
      message: "Job post created successfully",
      jobPost,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET ALL JOB POSTS
exports.getAllJobPosts = async (req, res) => {
  try {
    const jobPosts = await JobPost.find()
      .populate("companyId", "firstName lastName companyName email location")
      .sort({ createdAt: -1 });

    res.status(200).json(jobPosts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET JOB POSTS BY LOGGED-IN COMPANY
exports.getMyCompanyJobPosts = async (req, res) => {
  try {
    const companyId = req.user.id;

    const jobPosts = await JobPost.find({ companyId }).sort({
      createdAt: -1,
    });

    res.status(200).json(jobPosts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET SINGLE JOB POST
exports.getSingleJobPost = async (req, res) => {
  try {
    const jobPost = await JobPost.findById(req.params.id).populate(
      "companyId",
      "firstName lastName companyName email location"
    );

    if (!jobPost) {
      return res.status(404).json({ message: "Job post not found" });
    }

    res.status(200).json(jobPost);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// UPDATE JOB POST - only owner company
exports.updateJobPost = async (req, res) => {
  try {
    const jobPost = await JobPost.findById(req.params.id);

    if (!jobPost) {
      return res.status(404).json({ message: "Job post not found" });
    }

    if (jobPost.companyId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const updatedJobPost = await JobPost.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      message: "Job post updated successfully",
      jobPost: updatedJobPost,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE JOB POST - only owner company
exports.deleteJobPost = async (req, res) => {
  try {
    const jobPost = await JobPost.findById(req.params.id);

    if (!jobPost) {
      return res.status(404).json({ message: "Job post not found" });
    }

    if (jobPost.companyId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await jobPost.deleteOne();

    res.status(200).json({
      message: "Job post deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};