const Skill = require("../Model/skillsModel");

exports.getMySkills = async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== "candidate") {
      return res.status(403).json({ message: "Only candidates can view skills" });
    }

    const skills = await Skill.findOne({
      candidateId: user.userId,
    });

    res.status(200).json(skills);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch skills",
    });
  }
};