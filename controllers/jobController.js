const Job = require("../Model/jobModel");

// CREATE JOB POST - company only
exports.createJobPost = async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can post jobs" });
    }

    const {
      title,
      description,
      requirements,
      location,
      salary,
      jobType,
      skills,
    } = req.body;

    const job = await Job.create({
      companyId: req.user.id,
      title,
      description,
      requirements,
      location,
      salary,
      jobType,
      skills,
    });

    res.status(201).json({
      message: "Job created successfully",
      job,
    });
  } catch (error) {
    console.error("Create job error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET ALL JOBS
exports.getAllJobPosts = async (req, res) => {
  try {
    const jobs = await Job.find()
      .populate("companyId", "firstName lastName companyName email city country")
      .sort({ createdAt: -1 });

    res.status(200).json(jobs);
  } catch (error) {
    console.error("Get all jobs error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET MY COMPANY JOBS
exports.getMyCompanyJobPosts = async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can view their jobs" });
    }

    const jobs = await Job.find({ companyId: req.user.id }).sort({
      createdAt: -1,
    });

    res.status(200).json(jobs);
  } catch (error) {
    console.error("Get my jobs error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET SINGLE JOB
exports.getSingleJobPost = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate(
      "companyId",
      "firstName lastName companyName email city country"
    );

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.status(200).json(job);
  } catch (error) {
    console.error("Get single job error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// UPDATE JOB
exports.updateJobPost = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.companyId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const updatedJob = await Job.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      message: "Job updated successfully",
      job: updatedJob,
    });
  } catch (error) {
    console.error("Update job error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE JOB
exports.deleteJobPost = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.companyId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await job.deleteOne();

    res.status(200).json({
      message: "Job deleted successfully",
    });
  } catch (error) {
    console.error("Delete job error:", error);
    res.status(500).json({ message: "Server error" });
  }
};