const mongoose = require("mongoose");

const withdrawRequestSchema = new mongoose.Schema({
  email: String,
  amount: Number,
  method: String,
  account: String,
  status: { type: String, default: "Pending" }
});

module.exports = mongoose.model("WithdrawRequest", withdrawRequestSchema);
