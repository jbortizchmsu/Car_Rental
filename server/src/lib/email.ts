import nodemailer from 'nodemailer';

const APP_NAME = process.env.APP_NAME || 'JD Car Rental';
const APP_URL  = process.env.APP_URL  || 'http://localhost:5173';

if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
  throw new Error('FATAL: GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env');
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Verify SMTP connection on startup — logs result to console immediately
transporter.verify((error) => {
  if (error) {
    console.error('❌ Gmail SMTP connection failed:', error.message);
  } else {
    console.log('✅ Gmail SMTP ready — email service connected');
  }
});

export const sendPasswordResetEmail = async (
  email: string,
  fullName: string,
  token: string
): Promise<void> => {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Reset your password — ${APP_NAME}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a;">Password Reset Request</h2>
        <p style="color: #444; font-size: 15px;">
          Hi ${fullName}, we received a request to reset your password for your ${APP_NAME} account.
        </p>
        <a href="${resetUrl}"
           style="display: inline-block; margin: 24px 0; padding: 12px 24px;
                  background-color: #2563eb; color: white; text-decoration: none;
                  border-radius: 6px; font-size: 15px; font-weight: bold;">
          Reset My Password
        </a>
        <p style="color: #888; font-size: 13px;">
          This link expires in <strong>1 hour</strong>.<br/>
          If you did not request a password reset, you can safely ignore this email.
          Your password will not change.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #aaa; font-size: 12px;">${APP_NAME} · Car Rental Management</p>
      </div>
    `,
  });
};

export const sendVerificationEmail = async (
  email: string,
  fullName: string,
  token: string
): Promise<void> => {
  console.log('Attempting to send email to:', email);
  const verificationUrl = `${APP_URL}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Verify your email — ${APP_NAME}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a;">Welcome to ${APP_NAME}, ${fullName}!</h2>
        <p style="color: #444; font-size: 15px;">
          Thank you for registering. Please verify your email address to activate your account.
        </p>
        <a href="${verificationUrl}"
           style="display: inline-block; margin: 24px 0; padding: 12px 24px;
                  background-color: #2563eb; color: white; text-decoration: none;
                  border-radius: 6px; font-size: 15px; font-weight: bold;">
          Verify Email Address
        </a>
        <p style="color: #888; font-size: 13px;">
          This link expires in <strong>24 hours</strong>.<br/>
          If you did not create an account, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #aaa; font-size: 12px;">${APP_NAME} · Car Rental Management</p>
      </div>
    `,
  });
};
