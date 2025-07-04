const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const User = require("./models/user");
const WithdrawRequest = require("./models/WithdrawRequest");
const Admin = require("./models/Admin");
const sendMail = require("./mailer");
require("dotenv").config(); // Load .env (for local dev only)

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ MongoDB Connection (Render-compatible)
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI is missing from environment");
  process.exit(1);
}
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ Connected to MongoDB Atlas"))
.catch((err) => {
  console.error("❌ MongoDB error:", err.message);
  process.exit(1);
});

// Middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  secret: process.env.SESSION_SECRET || "defaultSecret",
  resave: false,
  saveUninitialized: false,
}));

// Auth Middlewares
function checkAuth(req, res, next) {
  if (!req.session.email) return res.redirect("/login");
  next();
}
function checkAdmin(req, res, next) {
  if (!req.session.admin) return res.redirect("/admin-login");
  next();
}

// Public Routes
app.get("/", (req, res) => res.redirect("/login"));
app.get("/login", (req, res) => res.render("login"));
app.get("/register", (req, res) => res.render("register"));
app.get("/home", (req, res) => res.render("home"));
app.get("/faq", (req, res) => res.render("faq"));

// Register
app.post("/register", async (req, res) => {
  const { username, email, password, country, referralCode } = req.body;
  try {
    const exists = await User.findOne({ email });
    if (exists) return res.send("Email already exists");
    const newUser = new User({ username, email, password, country, referredBy: referralCode || null });
    await newUser.save();
    req.session.email = email;

    await sendMail(
      email,
      "Welcome to GlobalEarnPro!",
      `<h2>Hello ${username},</h2><p>Your account has been created successfully.</p>`
    );

    res.redirect("/dashboard");
  } catch {
    res.send("Registration failed");
  }
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email, password });
    if (!user) return res.send("Invalid credentials");
    req.session.email = email;
    res.redirect("/dashboard");
  } catch {
    res.send("Login failed");
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// Dashboard
app.get("/dashboard", checkAuth, async (req, res) => {
  const user = await User.findOne({ email: req.session.email });
  if (!user) return res.redirect("/login");

  const today = new Date().toISOString().split("T")[0];
  const lastLogin = user.lastLoginDate?.toISOString().split("T")[0];

  if (today !== lastLogin) {
    user.coins += 5;
    user.xp += 20;
    user.lastLoginDate = new Date();
    await user.save();
  }

  const level = Math.floor(user.xp / 1000) + 1;
  const xpProgress = Math.round(((user.xp % 1000) / 1000) * 100);
  const xpNeeded = level * 1000 - user.xp;

  res.render("dashboard", { user, level, xpProgress, xpNeeded });
});

// Earn Pages
app.get("/earn", checkAuth, async (req, res) => {
  const user = await User.findOne({ email: req.session.email });
  res.render("earn", { user });
});
app.get("/earn/:type", checkAuth, async (req, res) => {
  const user = await User.findOne({ email: req.session.email });
  const validTypes = ["watch-ads", "install", "invite", "link-visit", "watch-videos", "daily-bonus"];
  if (!validTypes.includes(req.params.type)) return res.send("Invalid Type");
  res.render(req.params.type, { user });
});

// Withdraw
app.get("/withdraw", checkAuth, async (req, res) => {
  const user = await User.findOne({ email: req.session.email });
  res.render("withdraw", { user });
});
app.post("/withdraw", checkAuth, async (req, res) => {
  const { username, amount, method, number } = req.body;
  try {
    const user = await User.findOne({ email: req.session.email });
    if (!user || user.coins < amount) return res.send("Not enough coins.");
    user.coins -= amount;
    await user.save();

    const request = new WithdrawRequest({
      username,
      email: user.email,
      amount,
      method,
      account: number,
      status: "Pending",
    });
    await request.save();
    res.redirect("/dashboard");
  } catch {
    res.send("Withdraw error");
  }
});

// Withdraw History
app.get("/withdraw-history", checkAuth, async (req, res) => {
  const user = await User.findOne({ email: req.session.email });
  const requests = await WithdrawRequest.find({ email: user.email });
  res.render("withdraw-history", { user, requests });
});

// Referral Income
app.get("/referral-income", checkAuth, async (req, res) => {
  const user = await User.findOne({ email: req.session.email });
  res.render("referral-income", { user });
});

// Leaderboard
app.get("/leaderboard", checkAuth, async (req, res) => {
  const user = await User.findOne({ email: req.session.email });
  const allUsers = await User.find({});
  res.render("leaderboard", { user, allUsers });
});

// Edit Profile
app.get("/edit-profile", checkAuth, async (req, res) => {
  const user = await User.findOne({ email: req.session.email });
  res.render("edit-profile", { user });
});
app.post("/edit-profile", checkAuth, async (req, res) => {
  const { username, country, newPassword, confirmPassword } = req.body;
  try {
    const user = await User.findOne({ email: req.session.email });
    user.username = username;
    user.country = country;
    if (newPassword) {
      if (newPassword !== confirmPassword) return res.send("Passwords do not match.");
      user.password = newPassword;
    }
    await user.save();
    res.redirect("/dashboard");
  } catch {
    res.send("Profile update failed");
  }
});

// Admin Panel
app.get("/admin-login", (req, res) => res.render("admin-login"));
app.post("/admin-login", async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username, password });
  if (!admin) return res.send("Invalid credentials");
  req.session.admin = true;
  res.redirect("/admin");
});
app.get("/admin-logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin-login"));
});
app.get("/admin", checkAdmin, async (req, res) => {
  const withdrawRequests = await WithdrawRequest.find({});
  res.render("admin", { withdrawRequests });
});
app.post("/approve-request", checkAdmin, async (req, res) => {
  const { email, amount, method, account } = req.body;
  try {
    const request = await WithdrawRequest.findOne({ email, amount, method, account, status: "Pending" });
    if (!request) return res.json({ success: false });
    request.status = "Approved";
    await request.save();
    await sendMail(email, "Withdrawal Approved", `<p>Your withdrawal of ${amount} via ${method} has been <b>approved</b>.</p>`);
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});
app.post("/reject-request", checkAdmin, async (req, res) => {
  const { email, amount, method, account } = req.body;
  try {
    const request = await WithdrawRequest.findOne({ email, amount, method, account, status: "Pending" });
    if (!request) return res.json({ success: false });
    request.status = "Rejected";
    await request.save();
    await sendMail(email, "Withdrawal Rejected", `<p>Your withdrawal of ${amount} via ${method} has been <b>rejected</b>. Please contact support.</p>`);
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

// Policies
app.get("/terms", (req, res) => res.render("terms"));
app.get("/privacy", (req, res) => res.render("privacy"));
app.get("/contact", (req, res) => res.render("contact"));

// Start Server
app.listen(PORT, () => {
  console.log(`🌐 GlobalEarnPro running on http://localhost:${PORT}`);
});
