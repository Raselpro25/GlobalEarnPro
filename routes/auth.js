const express = require("express");
const router = express.Router();
const path = require("path");
const mongoose = require("mongoose");
const User = require("../models/User");
const WithdrawRequest = require("../models/WithdrawRequest");

const app = express();
const PORT = 3000;

// ✅ MongoDB Connection
mongoose.connect("mongodb://localhost:27017/globalearnpro")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ✅ Middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ✅ Helper Functions
function generateReferralId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function updateUserLevel(user) {
  const xp = user.xp;
  if (xp >= 400) user.level = "Diamond";
  else if (xp >= 200) user.level = "Gold";
  else if (xp >= 100) user.level = "Silver";
  else user.level = "Bronze";
}

// ✅ Home Redirect
app.get("/", (req, res) => {
  res.redirect("/login");
});

// ✅ Auth Routes
const authRouter = require("express").Router();

// ✅ GET: Login Page
authRouter.get("/login", (req, res) => {
  res.render("login");
});

// ✅ GET: Register Page
authRouter.get("/register", (req, res) => {
  res.render("register");
});

// ✅ POST: Register (with referral system)
authRouter.post("/register", async (req, res) => {
  const { username, email, password, country, referralCode } = req.body;

  if (!username || !email || !password || !country) {
    return res.send('<script>alert("All fields required!"); window.location.href="/register";</script>');
  }

  const exists = await User.findOne({ email });
  if (exists) {
    return res.send('<script>alert("User already exists!"); window.location.href="/register";</script>');
  }

  let referredBy = null;
  if (referralCode) {
    const refUser = await User.findOne({ referralId: referralCode });
    if (refUser) {
      refUser.coins += 10;
      refUser.xp += 20;
      refUser.referrals += 1;
      updateUserLevel(refUser);
      await refUser.save();
      referredBy = refUser.username;
    }
  }

  const newUser = new User({
    username,
    email,
    password,
    country,
    coins: 150,
    xp: 0,
    level: "Bronze",
    referrals: 0,
    referralId: generateReferralId(),
    referredBy
  });

  await newUser.save();

  res.redirect(`/dashboard?email=${email}`);
});

// ✅ POST: Login
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email, password });
  if (!user) {
    return res.send('<script>alert("Invalid credentials!"); window.location.href="/login";</script>');
  }

  res.redirect(`/dashboard?email=${email}`);
});

// ✅ POST: Logout
authRouter.post("/logout", (req, res) => {
  res.redirect("/login");
});

app.use("/", authRouter);

// ✅ Dashboard
app.get("/dashboard", async (req, res) => {
  const email = req.query.email;
  if (!email) return res.redirect("/login");

  try {
    const user = await User.findOne({ email });
    if (!user) return res.redirect("/login");

    const today = new Date().toISOString().split("T")[0];
    const lastLogin = user.lastLoginDate ? user.lastLoginDate.toISOString().split("T")[0] : null;

    if (lastLogin !== today) {
      user.coins += 5;
      user.xp += 20;
      updateUserLevel(user);
      user.lastLoginDate = new Date();
      await user.save();
    }

    const level = Math.floor(user.xp / 1000) + 1;
    const xpProgress = Math.round(((user.xp % 1000) / 1000) * 100);
    const xpNeeded = (level * 1000) - user.xp;

    res.render("dashboard", { user, level, xpProgress, xpNeeded });
  } catch (err) {
    console.error(err);
    res.send("Something went wrong.");
  }
});

// ✅ Earn Coins Page
app.get("/earn", async (req, res) => {
  const email = req.query.email;
  const user = await User.findOne({ email });
  if (!user) return res.redirect("/login");
  res.render("earn", { user });
});

// ✅ Individual Offerwall Pages
const earnPages = ["watch-ads", "install", "invite", "link-visit", "watch-videos", "daily-bonus"];
earnPages.forEach(route => {
  app.get(`/earn/${route}`, async (req, res) => {
    const email = req.query.email;
    const user = await User.findOne({ email });
    if (!user) return res.redirect("/login");
    res.render(route, { user });
  });
});

// ✅ Withdraw Page
app.get("/withdraw", async (req, res) => {
  const email = req.query.email;
  const user = await User.findOne({ email });
  if (!user) return res.redirect("/login");
  res.render("withdraw", { user });
});

// ✅ Submit Withdraw
app.post("/withdraw", async (req, res) => {
  const { email, amount, method, account } = req.body;
  const user = await User.findOne({ email });
  if (!user || user.coins < amount) {
    return res.send(`<script>alert('Invalid request or insufficient balance.'); window.location.href='/withdraw?email=${email}';</script>`);
  }
  await WithdrawRequest.create({ email, amount, method, account, status: "Pending" });
  user.coins -= amount;
  await user.save();
  res.send(`<script>alert('Withdraw request submitted!'); window.location.href='/dashboard?email=${email}';</script>`);
});

// ✅ Withdraw History
app.get("/withdraw-history", async (req, res) => {
  const email = req.query.email;
  const user = await User.findOne({ email });
  if (!user) return res.redirect("/login");

  const requests = await WithdrawRequest.find({ email });
  res.render("withdraw-history", { user, requests });
});

// ✅ Admin Panel
app.get("/admin", async (req, res) => {
  const withdrawRequests = await WithdrawRequest.find({});
  res.render("admin", { withdrawRequests });
});

// ✅ Approve Withdraw
app.post("/approve-request", async (req, res) => {
  const { email, amount } = req.body;
  try {
    const request = await WithdrawRequest.findOne({ email, amount, status: "Pending" });
    if (request) {
      request.status = "Approved";
      await request.save();
      return res.json({ success: true });
    }
    res.json({ success: false });
  } catch (err) {
    console.error("Approve error:", err);
    res.json({ success: false });
  }
});

// ✅ Leaderboard
app.get("/leaderboard", async (req, res) => {
  const email = req.query.email;
  const user = await User.findOne({ email });
  if (!user) return res.redirect("/login");

  const topUsers = await User.find().sort({ coins: -1 }).limit(20);
  res.render("leaderboard", { user, topUsers });
});

// ✅ Referral Income
app.get("/referral-income", async (req, res) => {
  const email = req.query.email;
  const user = await User.findOne({ email });
  if (!user) return res.redirect("/login");

  const referredUsers = await User.find({ referredBy: user.username });
  res.render("referral-income", { user, referredUsers });
});

// ✅ Footer Pages
app.get("/privacy", (req, res) => res.render("privacy"));
app.get("/terms", (req, res) => res.render("terms"));
app.get("/contact", (req, res) => res.render("contact"));

// ✅ Logout
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log("Logout error:", err);
    }
    res.redirect("/login.html");
  });
});

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`🌐 GlobalEarnPro running on http://localhost:${PORT}`);
});

module.exports = router;
