const mongoose = require("mongoose");

const connection = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      dbName: "cv-analyser",
    });

    console.log("MONGO DB is connected ✅⭐");
    console.log("Database:", mongoose.connection.name);

  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};

module.exports = connection;