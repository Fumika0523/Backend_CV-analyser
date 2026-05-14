const Counter = require("../Model/counterModel");

const getNextSequence = async (name) => {
const counter = await Counter.findOneAndUpdate(
  { name },
  { $inc: { seq: 1 } },
  {
    returnDocument: "after",
    upsert: true,
  }
);
  return counter.seq;
};

module.exports = getNextSequence;