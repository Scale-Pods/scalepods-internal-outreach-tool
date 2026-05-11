import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    tls: {
        rejectUnauthorized: false
    }
});


export async function sendOTPEmail(email: string, otp: string, fullName: string) {
    const mailOptions = {
        from: `"ScalePods Auth" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Your Password Reset OTP - ScalePods',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded-xl: 12px;">
                <h2 style="color: #0f172a; margin-bottom: 16px;">Hello ${fullName},</h2>
                <p style="color: #475569; line-height: 1.6;">You requested a password reset for your ScalePods account. Please use the following One-Time Password (OTP) to proceed:</p>
                <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0;">
                    <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #10b981;">${otp}</span>
                </div>
                <p style="color: #475569; line-height: 1.6;">This OTP will expire in 15 minutes. If you did not request this, please ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                <p style="color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} ScalePods. All rights reserved.</p>
            </div>
        `,
    };

    return transporter.sendMail(mailOptions);
}
