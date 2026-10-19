import Mailgen from "mailgen";
import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const mailGenerator = new Mailgen({
    theme: "default",
    product: { name: env.APP_NAME, link: env.APP_BASE_URL },
});

let transporter; // created lazily and reused (opening a new SMTP connection per email is slow)
const getTransporter = () => {
    if (!env.SMTP.host) return null;
    transporter ??= nodemailer.createTransport({
        host: env.SMTP.host,
        port: env.SMTP.port,
        secure: env.SMTP.port === 465,
        auth: { user: env.SMTP.user, pass: env.SMTP.pass },
    });
    return transporter;
};

/** In test mode emails are collected here so tests can read verification / reset links. */
export const mailOutbox = [];

/**
 * Sends an email. NEVER throws: a broken mail server must not turn a successful
 * registration into a 500 error. Failures are logged and reported via the return value.
 *
 * Modes:
 *  - test      -> stored in `mailOutbox`
 *  - SMTP set  -> sent through nodemailer
 *  - otherwise -> printed to the console (handy for local development without SMTP)
 *
 * @returns {Promise<boolean>} true when delivered / accepted
 */
export const sendMail = async ({ email, subject, mailgenContent }) => {
    const text = mailGenerator.generatePlaintext(mailgenContent);
    const html = mailGenerator.generate(mailgenContent);

    if (env.isTest) {
        mailOutbox.push({ to: email, subject, text, html });
        return true;
    }

    const smtp = getTransporter();
    if (!smtp) {
        console.log(
            `\n📧 [mail:dev] To: ${email}\n   Subject: ${subject}\n${text}\n`,
        );
        return true;
    }

    try {
        await smtp.sendMail({
            from: env.MAIL_FROM,
            to: email,
            subject,
            text,
            html,
        });
        return true;
    } catch (error) {
        console.error(
            `[mail] Failed to send "${subject}" to ${email}: ${error.message}`,
        );
        return false;
    }
};

// ---------------------------------------------------------------------------
// Email templates (Mailgen "content" objects)
// ---------------------------------------------------------------------------

export const emailVerificationMailgenContent = (username, verificationUrl) => ({
    body: {
        name: username,
        intro: `Welcome to ${env.APP_NAME}! We're excited to have you on board.`,
        action: {
            instructions:
                "To verify your email address, please click the button below (valid for 24 hours):",
            button: {
                color: "#22BC66",
                text: "Verify my email",
                link: verificationUrl,
            },
        },
        outro: "Need help or have questions? Just reply to this email, we'd love to help.",
    },
});

export const forgotPasswordMailgenContent = (username, passwordResetUrl) => ({
    body: {
        name: username,
        intro: "We received a request to reset the password of your account.",
        action: {
            instructions:
                "Click the button below to choose a new password. This link is valid for 15 minutes:",
            button: {
                color: "#DC4D2F",
                text: "Reset my password",
                link: passwordResetUrl,
            },
        },
        outro: "If you did not request a password reset, you can safely ignore this email. Your password will not change.",
    },
});

export const passwordChangedMailgenContent = (username) => ({
    body: {
        name: username,
        intro: "This is a confirmation that the password of your account was just changed. All other devices were signed out.",
        outro: "If you did not make this change, reset your password immediately and contact support.",
    },
});
