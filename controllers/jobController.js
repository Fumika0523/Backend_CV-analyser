const Job = require("../Model/jobModel");
const Skill = require("../Model/skillsModel");
const User = require("../Model/UserModel");
const CV = require("../Model/CVModel");
const Application = require("../Model/applicationModel");
const Company = require("../Model/companyModel");


// CREATE JOB POST
exports.createJobPost =
  async (req, res) => {
    try {
      if (
        req.user.role !==
        "company"
      ) {
        return res
          .status(403)
          .json({
            message:
              "Only company users can post jobs",
          });
      }

      const user =
        await User.findById(
          req.user.id
        );

      if (!user) {
        return res
          .status(404)
          .json({
            message:
              "User not found",
          });
      }

      if (!user.companyId) {
        return res
          .status(400)
          .json({
            message:
              "Your account is not linked to a company.",
          });
      }


      const company =
        await Company.findById(
          user.companyId
        );

      if (!company) {
        return res
          .status(404)
          .json({
            message:
              "Company not found",
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
        category,
        industry,
        applicationEndDate,
        salary,
        vacancies,
      } = req.body;

      if (
        !company.companyUrl
          ?.trim()
      ) {
        const submittedUrl =
          companyUrl?.trim();

        if (!submittedUrl) {
          return res
            .status(400)
            .json({
              message:
                "Please add your company website before posting a job.",
            });
        }

        try {
          const parsedUrl =
            new URL(
              submittedUrl
            );

          if (
            ![
              "http:",
              "https:",
            ].includes(
              parsedUrl.protocol
            )
          ) {
            throw new Error(
              "Invalid protocol"
            );
          }
        } catch {
          return res
            .status(400)
            .json({
              message:
                "Please enter a valid company website URL.",
            });
        }

        company.companyUrl =
          submittedUrl;

        await company.save();
      }

      let formattedLocation =
        location;

      if (
        typeof location ===
        "string"
      ) {
        const [
          city,
          country,
        ] = location
          .split(",")
          .map(
            (item) =>
              item.trim()
          );

        formattedLocation = {
          city:
            city || "",

          country:
            country || "",
        };
      }

      const job =
        await Job.create({

          companyId:
            company._id,


          createdBy:
            user._id,

          title,
          jobType,
          workMode,
          education,
          experience,
          keySkills,
          location:
            formattedLocation,
          responsibilities,
          roleSummary,
          compensationBenefits,
          requirements,
          category,
          industry,

          applicationEndDate,
          salary,

          vacancies:
            Number(
              vacancies
            ) || 1,

          filledPositions:
            0,
        });


      return res
        .status(201)
        .json({
          message:
            "Job created successfully",

          job,
        });
    } catch (error) {
      console.error(
        "Create job error:",
        error
      );

      return res
        .status(500)
        .json({
          message:
            error.message ||
            "Server error",
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

      $expr: {
        $lt: [
          "$filledPositions",
          "$vacancies",
        ],
      },
    })


      .populate(
        "companyId",
        "companyName companyDescription companyUrl location isActive"
      )


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

    if (
      job.companyId.toString() !==
      user.companyId.toString()
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to update this job",
      });
    }

    const updateData = {
      ...req.body,
    };

    delete updateData.companyId;

    delete updateData.createdBy;

    delete updateData.filledPositions;

    if (
      updateData.vacancies !== undefined
    ) {
      updateData.vacancies =
        Number(updateData.vacancies) || 1;
    }

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


const normalizeSkill = (skill) => {
  return String(skill || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "")
    .trim();
};
const calculateMatch = (
  candidateSkills = [],
  jobSkills = [],
  candidateLocation,
  jobLocation
) => {
  const normalizedCandidateSkills =
    candidateSkills
      .map(normalizeSkill)
      .filter(Boolean);

  const isSkillMatch = (
    candidateSkill,
    jobSkill
  ) => {
    const candidate =
      normalizeSkill(candidateSkill);

    const job =
      normalizeSkill(jobSkill);

    if (!candidate || !job) {
      return false;
    }

    if (candidate === job) {
      return true;
    }

    if (
      candidate.length < 3 ||
      job.length < 3
    ) {
      return false;
    }

    return (
      candidate.includes(job) ||
      job.includes(candidate)
    );
  };

  const matchedSkills =
    jobSkills.filter((jobSkill) =>
      normalizedCandidateSkills.some(
        (candidateSkill) =>
          isSkillMatch(
            candidateSkill,
            jobSkill
          )
      )
    );

  const missingSkills =
    jobSkills.filter(
      (jobSkill) =>
        !normalizedCandidateSkills.some(
          (candidateSkill) =>
            isSkillMatch(
              candidateSkill,
              jobSkill
            )
        )
    );

  const candidateCountry =
    normalizeCountry(
      candidateLocation?.country
    );

  const jobCountry =
    normalizeCountry(
      jobLocation?.country
    );

  const locationMatch = Boolean(
    candidateCountry &&
      jobCountry &&
      candidateCountry === jobCountry
  );

  const skillScore =
    jobSkills.length > 0
      ? (matchedSkills.length /
          jobSkills.length) *
        80
      : 0;

  const locationScore =
    locationMatch ? 20 : 0;

  const matchScore =
    Math.round(
      skillScore +
        locationScore
    );

  return {
    matchedSkills,
    missingSkills,
    locationMatch,
    matchScore,
  };
};

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
    const user = await User.findById(req.user.id);

    if (!user || user.role !== "candidate") {
      return res.status(403).json({
        message: "Only candidates can view matched jobs",
      });
    }

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

    if (candidateSkills.length === 0) {
      return res.status(200).json({
        matchedJobs: [],
      });
    }

    const currentDate = new Date();

    /*
     * Jobs already applied for should not
     * appear in Recommended Jobs.
     */
    const appliedApplications = await Application.find({
      candidateId: user.userId,
    }).select("jobId");

    const appliedJobIds = appliedApplications.map(
      (application) => application.jobId
    );

    const jobs = await Job.find({
      status: "Open",

      applicationEndDate: {
        $gte: currentDate,
      },

      _id: {
        $nin: appliedJobIds,
      },

      $expr: {
        $lt: [
          "$filledPositions",
          "$vacancies",
        ],
      },
    })
      .populate(
        "companyId",
        "companyName companyUrl location isActive"
      )
      .lean();

    const results = [];

    for (const job of jobs) {
      /*
       * Don't recommend jobs from
       * inactive companies.
       */
      if (
        job.companyId &&
        job.companyId.isActive === false
      ) {
        continue;
      }

      const jobSkills =
        Array.isArray(job.keySkills)
          ? job.keySkills.filter(Boolean)
          : [];

      /*
       * Use the shared matching system.
       */
      const {
        matchedSkills,
        missingSkills,
        locationMatch,
        matchScore,
      } = calculateMatch(
        candidateSkills,
        jobSkills,
        user.location,
        job.location
      );

      /*
       * Candidate must be in the
       * same country as the JOB.
       */
      if (!locationMatch) {
        continue;
      }

      /*
       * Only recommend matches
       * above 50%.
       */
      if (matchScore <= 50) {
        continue;
      }

      results.push({
        jobId: job._id,

        title: job.title,

        companyName:
          job.companyId?.companyName ||
          "Company",

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

        missingSkills,

        locationMatch,

        matchScore,
      });
    }

    /*
     * Best matches first.
     */
    const sortedResults = results.sort(
      (a, b) =>
        b.matchScore -
        a.matchScore
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
      message:
        "Failed to fetch matched jobs",
    });
  }
};

// ======================================================
// GET MATCHED JOBS FOR GUEST
// ======================================================
exports.getMatchedJobsForGuest = async (req, res) => {
  try {


    const { guestSessionId } = req.query;

    if (!guestSessionId) {
      return res.status(400).json({
        message: "Guest session ID is required",
      });
    }

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