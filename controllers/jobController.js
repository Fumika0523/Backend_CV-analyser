const Job = require("../Model/jobModel");
const Skill = require("../Model/skillsModel");
const User = require("../Model/UserModel");
const CV = require("../Model/CVModel");
const Application = require("../Model/applicationModel");


// ======================================================
// CREATE JOB POST
// ======================================================
exports.createJobPost = async (req, res) => {
  try {
    /*
     * req.user comes from the JWT.
     *
     * Your JWT contains:
     * {
     *   id: user._id,
     *   role: user.role
     * }
     */
    if (req.user.role !== "company") {
      return res.status(403).json({
        message: "Only company users can post jobs",
      });
    }

    /*
     * NEW:
     *
     * We now need the full User document because
     * req.user.id is the USER ID, not the COMPANY ID.
     *
     * We need user.companyId to know which Company
     * owns the job.
     */
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    /*
     * Safety check.
     *
     * Every company user should now be connected
     * to a Company document.
     */
    if (!user.companyId) {
      return res.status(400).json({
        message:
          "Your account is not linked to a company.",
      });
    }

    const {
      title,
      jobType,
      workMode,
      education,
      experience,
      keySkills,
      location,
      companyUrl,
      responsibilities,
      roleSummary,
      compensationBenefits,
      requirements,

      /*
       * FIX:
       *
       * These fields exist in JobModel and are required,
       * but your previous controller wasn't saving them.
       */
      category,
      industry,

      applicationEndDate,
      salary,
      vacancies,
    } = req.body;

    /*
     * Your frontend may sometimes send:
     *
     * "Manchester, United Kingdom"
     *
     * rather than:
     *
     * {
     *   city: "Manchester",
     *   country: "United Kingdom"
     * }
     *
     * Keep supporting both formats.
     */
    let formattedLocation = location;

    if (typeof location === "string") {
      const [city, country] = location
        .split(",")
        .map((item) => item.trim());

      formattedLocation = {
        city: city || "",
        country: country || "",
      };
    }

    /*
     * NEW OWNERSHIP STRUCTURE
     *
     * OLD:
     *
     * companyId = req.user.id
     *
     * This meant:
     * companyId -> User._id
     *
     *
     * NEW:
     *
     * companyId -> Company._id
     * createdBy -> User._id
     *
     * Example:
     *
     * companyId = ABC Recruitment
     * createdBy = Alice
     */
    const job = await Job.create({
      companyId: user.companyId,

      createdBy: user._id,

      title,
      jobType,
      workMode,
      education,
      experience,
      keySkills,

      location: formattedLocation,

      companyUrl,
      responsibilities,
      roleSummary,
      compensationBenefits,
      requirements,

      category,
      industry,

      applicationEndDate,
      salary,

      vacancies:
        Number(vacancies) || 1,

      filledPositions: 0,
    });

    return res.status(201).json({
      message: "Job created successfully",
      job,
    });
  } catch (error) {
    console.error(
      "Create job error:",
      error
    );

    return res.status(500).json({
      message:
        error.message || "Server error",
    });
  }
};


// ======================================================
// GET ALL PUBLIC JOBS
// ======================================================
exports.getAllJobPosts = async (req, res) => {
  try {
    const currentDate = new Date();

    const jobs = await Job.find({
      status: "Open",

      applicationEndDate: {
        $gte: currentDate,
      },

      /*
       * Only return jobs that still have
       * vacancies available.
       *
       * Example:
       *
       * vacancies = 3
       * filledPositions = 2
       *
       * 2 < 3 -> show job
       */
      $expr: {
        $lt: [
          "$filledPositions",
          "$vacancies",
        ],
      },
    })

      /*
       * CHANGED:
       *
       * companyId now references Company,
       * not User.
       *
       * OLD:
       * firstName lastName companyName email
       *
       * NEW:
       * company information comes from CompanyModel.
       */
      .populate(
        "companyId",
        "companyName companyDescription companyUrl location isActive"
      )

      /*
       * createdBy points to the recruiter.
       *
       * We don't really need to expose this publicly,
       * so we're not populating it here.
       */
      .sort({
        createdAt: -1,
      })

      .lean();

    return res.status(200).json(jobs);
  } catch (error) {
    console.error(
      "Get all jobs error:",
      error
    );

    return res.status(500).json({
      message: "Server error",
    });
  }
};


// ======================================================
// GET MY COMPANY JOBS
// ======================================================
exports.getMyCompanyJobPosts = async (
  req,
  res
) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({
        message:
          "Only companies can view their jobs",
      });
    }

    /*
     * NEW:
     *
     * Find the logged-in recruiter so we
     * can get their Company._id.
     */
    const user = await User.findById(
      req.user.id
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!user.companyId) {
      return res.status(400).json({
        message:
          "Your account is not linked to a company.",
      });
    }

    /*
     * CHANGED:
     *
     * OLD:
     *
     * companyId: req.user.id
     *
     * That showed only jobs posted by this
     * specific recruiter.
     *
     *
     * NEW:
     *
     * companyId: user.companyId
     *
     * All recruiters belonging to the same
     * Company can see the company's jobs.
     */
    const jobs = await Job.find({
      companyId: user.companyId,
    })
      .populate(
        "createdBy",
        "firstName lastName"
      )
      .sort({
        createdAt: -1,
      })
      .lean();

    return res.status(200).json(jobs);
  } catch (error) {
    console.error(
      "Get my jobs error:",
      error
    );

    return res.status(500).json({
      message: "Server error",
    });
  }
};


// ======================================================
// GET SINGLE JOB
// ======================================================
exports.getSingleJobPost = async (
  req,
  res
) => {
  try {
    const job = await Job.findById(
      req.params.id
    )

      /*
       * CHANGED:
       *
       * companyId now gives us the Company,
       * not the recruiter.
       */
      .populate(
        "companyId",
        "companyName companyDescription companyUrl location"
      );

    if (!job) {
      return res.status(404).json({
        message: "Job not found",
      });
    }

    return res.status(200).json(job);
  } catch (error) {
    console.error(
      "Get single job error:",
      error
    );

    return res.status(500).json({
      message: "Server error",
    });
  }
};


// ======================================================
// UPDATE JOB
// ======================================================
exports.updateJobPost = async (
  req,
  res
) => {
  try {
    /*
     * Find logged-in company user first.
     */
    const user = await User.findById(
      req.user.id
    );

    if (
      !user ||
      user.role !== "company"
    ) {
      return res.status(403).json({
        message:
          "Only company users can update jobs",
      });
    }

    if (!user.companyId) {
      return res.status(400).json({
        message:
          "Your account is not linked to a company.",
      });
    }

    const job = await Job.findById(
      req.params.id
    );

    if (!job) {
      return res.status(404).json({
        message: "Job not found",
      });
    }

    /*
     * IMPORTANT SECURITY CHANGE:
     *
     * OLD:
     *
     * job.companyId === req.user.id
     *
     * NEW:
     *
     * job.companyId === user.companyId
     *
     * This checks whether the job belongs
     * to the logged-in user's COMPANY.
     */
    if (
      job.companyId.toString() !==
      user.companyId.toString()
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to update this job",
      });
    }

    /*
     * Copy submitted editable fields.
     */
    const updateData = {
      ...req.body,
    };

    /*
     * SECURITY:
     *
     * The frontend must NEVER be able to change
     * which company owns a job.
     */
    delete updateData.companyId;

    /*
     * The frontend also shouldn't be able
     * to pretend another recruiter created it.
     */
    delete updateData.createdBy;

    /*
     * filledPositions is controlled by
     * application acceptance logic.
     *
     * Do not allow the normal Edit Job form
     * to modify it.
     */
    delete updateData.filledPositions;

    if (
      updateData.vacancies !== undefined
    ) {
      updateData.vacancies =
        Number(updateData.vacancies) || 1;
    }

    /*
     * Continue supporting string location.
     */
    if (
      typeof updateData.location ===
      "string"
    ) {
      const [city, country] =
        updateData.location
          .split(",")
          .map((item) =>
            item.trim()
          );

      updateData.location = {
        city: city || "",
        country: country || "",
      };
    }

    const updatedJob =
      await Job.findByIdAndUpdate(
        req.params.id,
        updateData,
        {
          new: true,

          /*
           * Important because fields such as:
           *
           * category
           * industry
           * jobType
           * workMode
           *
           * have enums / validation rules.
           */
          runValidators: true,
        }
      );

    return res.status(200).json({
      message:
        "Job updated successfully",

      job: updatedJob,
    });
  } catch (error) {
    console.error(
      "Update job error:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Server error",
    });
  }
};


// ======================================================
// CLOSE JOB
// ======================================================
exports.deleteJobPost = async (
  req,
  res
) => {
  try {
    /*
     * Despite the function being called
     * deleteJobPost, your system does NOT
     * physically delete the job.
     *
     * It changes:
     *
     * status -> Closed
     *
     * I like keeping this behaviour because
     * applications/history remain intact.
     */

    const user = await User.findById(
      req.user.id
    );

    if (
      !user ||
      user.role !== "company"
    ) {
      return res.status(403).json({
        message:
          "Only company users can close jobs",
      });
    }

    if (!user.companyId) {
      return res.status(400).json({
        message:
          "Your account is not linked to a company.",
      });
    }

    const job = await Job.findById(
      req.params.id
    );

    if (!job) {
      return res.status(404).json({
        message: "Job not found",
      });
    }

    /*
     * NEW company ownership check.
     */
    if (
      job.companyId.toString() !==
      user.companyId.toString()
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to close this job",
      });
    }

    job.status = "Closed";

    await job.save();

    return res.status(200).json({
      message:
        "Job closed successfully",

      job,
    });
  } catch (error) {
    console.error(
      "Close job error:",
      error
    );

    return res.status(500).json({
      message: "Server error",
    });
  }
};


// ======================================================
// HELPER: NORMALIZE COUNTRY
// ======================================================
const normalizeCountry = (country) => {
  const value = String(
    country || ""
  )
    .toLowerCase()
    .replace(/\./g, "")
    .trim();

  const aliases = {
    uk: "united kingdom",
    "u k": "united kingdom",
    gb: "united kingdom",

    "great britain":
      "united kingdom",

    england:
      "united kingdom",

    scotland:
      "united kingdom",

    wales:
      "united kingdom",

    "northern ireland":
      "united kingdom",
  };

  return aliases[value] || value;
};


// ======================================================
// HELPER: NORMALIZE SKILLS
// ======================================================
const normalizeSkill = (skill) =>
  String(skill || "")
    .toLowerCase()
    .trim();


// ======================================================
// GET MATCHED CANDIDATES FOR COMPANY JOB
// ======================================================
exports.getMatchedJobsForCompany = async (
  req,
  res
) => {
  try {
    const { jobId } =
      req.params;

    if (!jobId) {
      return res.status(400).json({
        message:
          "Job ID is required",
      });
    }

    /*
     * NEW:
     *
     * Find the logged-in recruiter.
     */
    const companyUser =
      await User.findById(
        req.user.id
      );

    if (
      !companyUser ||
      companyUser.role !==
        "company"
    ) {
      return res.status(403).json({
        message:
          "Only company users can view candidate matches",
      });
    }

    if (!companyUser.companyId) {
      return res.status(400).json({
        message:
          "Your account is not linked to a company.",
      });
    }

    const job = await Job.findById(
      jobId
    );

    if (!job) {
      return res.status(404).json({
        message:
          "Job not found",
      });
    }

    /*
     * IMPORTANT SECURITY FIX:
     *
     * Previously any company could potentially
     * submit another company's jobId.
     *
     * Now the requested job must belong to
     * the logged-in user's Company.
     */
    if (
      job.companyId.toString() !==
      companyUser.companyId.toString()
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to view matches for this job",
      });
    }

    const jobSkills =
      Array.isArray(job.keySkills)
        ? job.keySkills.filter(Boolean)
        : [];

    if (jobSkills.length === 0) {
      return res.status(200).json({
        title:
          job.title,

        jobLocation:
          job.location,

        jobSkills: [],

        matchedCandidates: [],

        message:
          "This job does not have any key skills",
      });
    }

    const candidateSkillDocuments =
      await Skill.find({
        candidateId: {
          $ne: null,
        },
      });

    if (
      candidateSkillDocuments.length ===
      0
    ) {
      return res.status(200).json({
        title:
          job.title,

        jobLocation:
          job.location,

        jobSkills,

        matchedCandidates: [],

        message:
          "No candidate skills found",
      });
    }

    /*
     * Candidates already accepted anywhere
     * in the system should not appear again.
     */
    const acceptedCandidateIds =
      new Set(
        (
          await Application.distinct(
            "candidateId",
            {
              status: "accepted",
            }
          )
        ).map(Number)
      );

    const results = [];

    for (
      const candidateSkillDocument
      of candidateSkillDocuments
    ) {
      const candidateId =
        Number(
          candidateSkillDocument.candidateId
        );

      if (
        !Number.isFinite(
          candidateId
        )
      ) {
        continue;
      }

      /*
       * Candidate already hired somewhere.
       */
      if (
        acceptedCandidateIds.has(
          candidateId
        )
      ) {
        continue;
      }

      const candidateSkills =
        Array.isArray(
          candidateSkillDocument.skills
        )
          ? candidateSkillDocument.skills.filter(
              Boolean
            )
          : [];

      const matchedSkills =
        jobSkills.filter(
          (jobSkill) => {
            const normalizedJobSkill =
              normalizeSkill(
                jobSkill
              );

            return candidateSkills.some(
              (
                candidateSkill
              ) => {
                const normalizedCandidateSkill =
                  normalizeSkill(
                    candidateSkill
                  );

                return (
                  normalizedCandidateSkill ===
                    normalizedJobSkill ||

                  normalizedCandidateSkill.includes(
                    normalizedJobSkill
                  ) ||

                  normalizedJobSkill.includes(
                    normalizedCandidateSkill
                  )
                );
              }
            );
          }
        );

      const matchScore =
        Math.round(
          (matchedSkills.length /
            jobSkills.length) *
            100
        );

      /*
       * No matching skills.
       */
      if (matchScore === 0) {
        continue;
      }

      /*
       * Get candidate's User document.
       */
      const candidate =
        await User.findOne({
          userId:
            candidateId,
        });

      if (!candidate) {
        continue;
      }

      /*
       * NEW:
       *
       * This connects the Available for Work
       * feature we just built.
       *
       * Candidate switched OFF:
       * do not recommend them to companies.
       */
      if (
        candidate.availableForWork ===
        false
      ) {
        continue;
      }

      const jobCountry =
        normalizeCountry(
          job.location?.country
        );

      const candidateCountry =
        normalizeCountry(
          candidate.location
            ?.country
        );

      const locationMatched =
        Boolean(
          jobCountry &&
            candidateCountry &&
            jobCountry ===
              candidateCountry
        );

      /*
       * Current business rule:
       * candidate must be in the same country.
       */
      if (!locationMatched) {
        continue;
      }

      const cv =
        await CV.findOne({
          candidateId,
        }).sort({
          version: -1,
        });

      results.push({
        candidateId,

        candidateName:
          `${candidate.firstName || ""} ${
            candidate.lastName || ""
          }`.trim() ||
          `Candidate ${candidateId}`,

        /*
         * NOTE:
         *
         * We are still returning email here.
         *
         * Later, during the privacy task,
         * we'll remove recruiter access to
         * candidate contact details.
         */
        email:
          candidate.email || "",

        candidateLocation:
          candidate.location || null,

        locationMatched,

        matchedSkills,

        totalJobSkills:
          jobSkills.length,

        matchScore,

        cvPath:
          cv?.filePath || null,
      });
    }

    const sortedResults =
      results.sort(
        (a, b) =>
          b.matchScore -
          a.matchScore
      );

    return res.status(200).json({
      title: job.title,

      jobLocation:
        job.location,

      jobSkills,

      matchedCandidates:
        sortedResults,
    });
  } catch (error) {
    console.error(
      "getMatchedJobsForCompany error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to fetch matching candidates",
    });
  }
};

// ======================================================
// GET MATCHED JOBS FOR CANDIDATE
// ======================================================
exports.getMatchedJobsForCandidate = async (req, res) => {
  try {
    /*
     * Get the logged-in candidate.
     *
     * req.user.id = MongoDB User._id from JWT.
     */
    const user = await User.findById(req.user.id);

    if (!user || user.role !== "candidate") {
      return res.status(403).json({
        message: "Only candidates can view matched jobs",
      });
    }

    /*
     * Get the skills extracted from this candidate's CV.
     *
     * IMPORTANT:
     * Skill collection still uses the numeric:
     *
     * candidateId = user.userId
     *
     * We are intentionally keeping this unchanged
     * during the Company architecture migration.
     */
    const candidateSkillDoc = await Skill.findOne({
      candidateId: user.userId,
    });

    if (!candidateSkillDoc) {
      return res.status(404).json({
        message: "No skills found for this candidate",
      });
    }

    const candidateSkills = Array.isArray(
      candidateSkillDoc.skills
    )
      ? candidateSkillDoc.skills.filter(Boolean)
      : [];

    /*
     * Candidate location is compared against
     * Job.location — NOT Company.location.
     *
     * Example:
     *
     * Company office = London
     * Job location   = Manchester
     *
     * Matching must use Manchester.
     */
    const candidateCountry = normalizeCountry(
      user.location?.country
    );

    const currentDate = new Date();

    /*
     * Find jobs this candidate has already applied for.
     *
     * These jobs should not appear again in
     * Recommended Jobs.
     *
     * NOTE:
     * This is different from All Jobs / Latest Jobs,
     * where applied jobs can remain visible.
     */
    const appliedApplications = await Application.find({
      candidateId: user.userId,
    }).select("jobId");

    const appliedJobIds = appliedApplications.map(
      (application) => application.jobId
    );

    /*
     * Find currently available jobs.
     *
     * NEW:
     * companyId now references CompanyModel,
     * so we populate company information here.
     */
    const jobs = await Job.find({
      status: "Open",

      applicationEndDate: {
        $gte: currentDate,
      },

      /*
       * Don't recommend jobs already applied for.
       */
      _id: {
        $nin: appliedJobIds,
      },

      /*
       * Don't recommend a job if all vacancies
       * have already been filled.
       *
       * Example:
       *
       * filledPositions = 2
       * vacancies = 2
       *
       * Job should not appear.
       */
      $expr: {
        $lt: [
          "$filledPositions",
          "$vacancies",
        ],
      },
    })
      /*
       * CHANGED:
       *
       * Job.companyId now references Company,
       * not User.
       */
      .populate(
        "companyId",
        "companyName companyUrl location isActive"
      )
      .lean();

    const results = [];

    /*
     * Check every available job against
     * the candidate's CV skills.
     */
    for (const job of jobs) {
      /*
       * If the company has been deactivated,
       * don't recommend its jobs.
       */
      if (
        job.companyId &&
        job.companyId.isActive === false
      ) {
        continue;
      }

      const jobSkills = Array.isArray(job.keySkills)
        ? job.keySkills.filter(Boolean)
        : [];

      /*
       * Compare candidate country with JOB country.
       */
      const jobCountry = normalizeCountry(
        job.location?.country
      );

      const locationMatched = Boolean(
        candidateCountry &&
          jobCountry &&
          candidateCountry === jobCountry
      );

      /*
       * Find skills that approximately match.
       *
       * Example:
       *
       * Candidate: "React.js"
       * Job:       "React"
       */
      const matchedSkills = jobSkills.filter(
        (jobSkill) => {
          const normalizedJobSkill =
            normalizeSkill(jobSkill);

          return candidateSkills.some(
            (candidateSkill) => {
              const normalizedCandidateSkill =
                normalizeSkill(candidateSkill);

              return (
                normalizedCandidateSkill ===
                  normalizedJobSkill ||
                normalizedCandidateSkill.includes(
                  normalizedJobSkill
                ) ||
                normalizedJobSkill.includes(
                  normalizedCandidateSkill
                )
              );
            }
          );
        }
      );

      /*
       * Calculate skill match percentage.
       *
       * Example:
       *
       * Job requires 4 skills
       * Candidate matches 3
       *
       * 3 / 4 * 100 = 75%
       */
      const matchScore =
        jobSkills.length > 0
          ? Math.round(
              (matchedSkills.length /
                jobSkills.length) *
                100
            )
          : 0;

      /*
       * Business rules:
       *
       * 1. Candidate must have some matching skills.
       * 2. Candidate must be in the same country.
       * 3. Match must be greater than 50%.
       */
      if (matchScore === 0) {
        continue;
      }

      if (!locationMatched) {
        continue;
      }

      if (matchScore <= 50) {
        continue;
      }

      /*
       * Add the recommended job to the response.
       */
      results.push({
        jobId: job._id,

        title: job.title,

        /*
         * NEW:
         * Company name now comes from CompanyModel.
         */
        companyName:
          job.companyId?.companyName || "Company",

        /*
         * We temporarily still store companyUrl
         * on JobModel.
         *
         * If it isn't there, use the Company value.
         */
        companyUrl:
          job.companyUrl ||
          job.companyId?.companyUrl ||
          "",

        location: job.location,

        salary: job.salary,

        jobType: job.jobType,

        workMode: job.workMode,

        category: job.category,

        industry: job.industry,

        matchedSkills,

        matchScore,
      });
    }

    /*
     * Highest match score appears first.
     */
    const sortedResults = results.sort(
      (a, b) => b.matchScore - a.matchScore
    );

    return res.status(200).json({
      matchedJobs: sortedResults,
    });
  } catch (error) {
    console.error(
      "getMatchedJobsForCandidate error:",
      error
    );

    return res.status(500).json({
      message: "Failed to fetch matched jobs",
    });
  }
};


// ======================================================
// GET MATCHED JOBS FOR GUEST
// ======================================================
exports.getMatchedJobsForGuest = async (req, res) => {
  try {
    /*
     * Guests don't have a User account yet.
     *
     * Their uploaded CV is temporarily connected
     * using guestSessionId.
     */
    const { guestSessionId } = req.query;

    if (!guestSessionId) {
      return res.status(400).json({
        message: "Guest session ID is required",
      });
    }

    /*
     * Get skills extracted from the guest CV.
     */
    const guestSkill = await Skill.findOne({
      guestSessionId,
    });

    if (!guestSkill) {
      return res.status(404).json({
        message: "No skills found for this guest",
      });
    }

    const guestSkills = Array.isArray(
      guestSkill.skills
    )
      ? guestSkill.skills.filter(Boolean)
      : [];

    const currentDate = new Date();

    /*
     * Guests can only be recommended jobs that:
     *
     * - are Open
     * - are not expired
     * - still have vacancies
     */
    const jobs = await Job.find({
      status: "Open",

      applicationEndDate: {
        $gte: currentDate,
      },

      $expr: {
        $lt: [
          "$filledPositions",
          "$vacancies",
        ],
      },
    })
      /*
       * NEW:
       *
       * companyId now points to CompanyModel.
       *
       * Populate company information so the
       * guest can see the company name.
       */
      .populate(
        "companyId",
        "companyName companyUrl location isActive"
      )
      .lean();

    const results = [];

    /*
     * Compare guest CV skills against every
     * available job.
     */
    for (const job of jobs) {
      /*
       * Don't recommend jobs from a company
       * that has been disabled.
       */
      if (
        job.companyId &&
        job.companyId.isActive === false
      ) {
        continue;
      }

      const jobSkills = Array.isArray(job.keySkills)
        ? job.keySkills.filter(Boolean)
        : [];

      const matchedSkills = jobSkills.filter(
        (jobSkill) => {
          const normalizedJobSkill =
            normalizeSkill(jobSkill);

          return guestSkills.some(
            (guestSkillItem) => {
              const normalizedGuestSkill =
                normalizeSkill(guestSkillItem);

              return (
                normalizedGuestSkill ===
                  normalizedJobSkill ||
                normalizedGuestSkill.includes(
                  normalizedJobSkill
                ) ||
                normalizedJobSkill.includes(
                  normalizedGuestSkill
                )
              );
            }
          );
        }
      );

      /*
       * Calculate match percentage.
       */
      const matchScore =
        jobSkills.length > 0
          ? Math.round(
              (matchedSkills.length /
                jobSkills.length) *
                100
            )
          : 0;

      /*
       * Same recommendation threshold
       * you're already using:
       *
       * Only show jobs above 50%.
       */
      if (matchScore <= 50) {
        continue;
      }

      results.push({
        jobId: job._id,

        title: job.title,

        /*
         * NEW:
         * Company information now comes
         * from CompanyModel.
         */
        companyName:
          job.companyId?.companyName || "Company",

        companyUrl:
          job.companyUrl ||
          job.companyId?.companyUrl ||
          "",

        location: job.location,

        salary: job.salary,

        jobType: job.jobType,

        workMode: job.workMode,

        category: job.category,

        industry: job.industry,

        matchedSkills,

        matchScore,
      });
    }

    /*
     * Best matching job first.
     */
    const sortedResults = results.sort(
      (a, b) => b.matchScore - a.matchScore
    );

    /*
     * Guest currently sees only the top 5.
     *
     * This is a useful conversion/business rule:
     * guests get a preview, while registered
     * candidates can access the full experience.
     */
    return res.status(200).json({
      matchedJobs: sortedResults.slice(0, 5),
    });
  } catch (error) {
    console.error(
      "getMatchedJobsForGuest error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to fetch guest matched jobs",
    });
  }
};