const mongoose = require('mongoose');
const uri = "mongodb+srv://adventure_force_db_user:m7x93WzLK4lZaxHK@adventureforce.hs8xl11.mongodb.net/?appName=adventureforce";

console.log("Connecting to MongoDB...");
mongoose.connect(uri)
  .then(() => {
    console.log("Connected successfully!");
    process.exit(0);
  })
  .catch(err => {
    console.error("Connection failed:", err);
    process.exit(1);
  });
