// mailer.js
const nodemailer = require("nodemailer");

// ✅ Transporter setup (your Gmail app password)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "velouranil18@gmail.com",
    pass: "rohu puaw nhfo vcml",
  },
});

// 🔹 Reusable single mail sender
const sendMail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: '"GlobalEarnPro" <velouranil18@gmail.com>',
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error("❌ Email error:", err);
  }
};

// 🔹 Template functions

// Welcome Email
const sendWelcomeEmail = (to, name) => {
  const subject = "🎉 Welcome to GlobalEarnPro!";
  const html = `
    <h2>Hi ${name},</h2>
    <p>Welcome to <strong>GlobalEarnPro</strong>! Start earning coins today by completing simple tasks.</p>
    <p style="color:#7f00ff;">We're excited to have you on board.</p>
  `;
  return sendMail(to, subject, html);
};

// Withdrawal Approved
const sendWithdrawApprovalEmail = (to, amount, method, account) => {
  const subject = "✅ Withdrawal Approved - GlobalEarnPro";
  const html = `
    <p>Your withdrawal of <strong>${amount} coins</strong> via <strong>${method}</strong> to <strong>${account}</strong> has been <span style="color:green;">approved</span>.</p>
    <p>You'll receive the payment shortly. Thank you for using GlobalEarnPro!</p>
  `;
  return sendMail(to, subject, html);
};

// Withdrawal Rejected
const sendWithdrawRejectionEmail = (to, amount, method, account) => {
  const subject = "❌ Withdrawal Rejected - GlobalEarnPro";
  const html = `
    <p>Your withdrawal request of <strong>${amount} coins</strong> via <strong>${method}</strong> to <strong>${account}</strong> has been <span style="color:red;">rejected</span>.</p>
    <p>Please contact support if you believe this was a mistake.</p>
  `;
  return sendMail(to, subject, html);
};

module.exports = {
  sendWelcomeEmail,
  sendWithdrawApprovalEmail,
  sendWithdrawRejectionEmail,
};
