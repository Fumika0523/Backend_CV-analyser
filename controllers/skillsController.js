const Skill = require("../Model/skillsModel");
const User = require("../Model/UserModel");

exports.getMySkills = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

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