// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  country: String,

  referralId: {
    type: String,
    unique: true,
  },
  referredBy: {
    type: String,
    default: null,
  },

  coins: {
    type: Number,
    default: 0,
  },
  xp: {
    type: Number,
    default: 0,
  },
  level: {
    type: String,
    default: "Bronze",
  },
  referrals: {
    type: Number,
    default: 0,
  },
  referralEarnings: {
    type: Number,
    default: 0,
  },

  lastLoginDate: {
    type: Date,
    default: null,
  }
});

module.exports = mongoose.model("User", userSchema);
