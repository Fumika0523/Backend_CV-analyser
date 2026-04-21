const mongoose = require('mongoose')

const connection = async()=>{
  try {
        await mongoose.connect(process.env.MONGO_URL)
        console.log("MONGO DB is connected ✅")
    } catch (error) {
        console.error(error.message)
        process.exit(1)
    }
}

module.exports = connection