// Import the Job model
const Job = require("../Model/jobModel");

// Run job expiry check every 24 hours
const HOURS_BETWEEN_JOB_EXPIRY_CHECKS = 24;

// This cron function only closes/marks expired jobs.
// It does NOT delete jobs.
// It does NOT delete applications.
const expireOldJobs = async () => {
  try {
    // Get current date/time
    const currentDate = new Date();

    // Find jobs where:
    // 1. applicationEndDate has already passed
    // 2. job is still Open
    // Then update their status to Expired
    const result = await Job.updateMany(
      {
        applicationEndDate: { $lt: currentDate },
        status: "Open",
      },
      {
        $set: {
          status: "Expired",
        },
      }
    );

    console.log(
      `CronJobs: expired ${result.modifiedCount} old job(s).`
    );
  } catch (error) {
    console.error("CronJobs job expiry error:", error);
  }
};

// Function to start cron jobs
const startCronJobs = () => {
  console.log("CronJobs: starting job expiry checker.");

  // Run once immediately when server starts
  expireOldJobs();

  // Then run every 24 hours
  setInterval(
    expireOldJobs,
    HOURS_BETWEEN_JOB_EXPIRY_CHECKS * 60 * 60 * 1000
  );
};

// Export function so it can be used in server.js/app.js
module.exports = startCronJobs;


// Cron Job only changes expired jobs from Open → Expired. Jobs filled by accepted candidates are closed immediately inside the application status controller. No application or job records are deleted.