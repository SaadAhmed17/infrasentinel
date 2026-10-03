import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null | undefined;

  // Created on first use from the SMTP_* settings in .env; null when SMTP is not configured.
  private getTransporter(): Transporter | null {
    if (this.transporter === undefined) {
      const host = process.env.SMTP_HOST;
      const port = Number(process.env.SMTP_PORT || 587);
      this.transporter = host
        ? nodemailer.createTransport({
            host,
            port,
            secure: port === 465, // 465 = TLS from the start; 587 upgrades with STARTTLS
            auth: process.env.SMTP_USER
              ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
              : undefined,
          })
        : null;
    }
    return this.transporter;
  }

  async sendPasswordResetEmail(
    to: string,
    resetLink: string,
    expiresInMinutes: number,
  ) {
    const transporter = this.getTransporter();
    if (!transporter) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(
          `SMTP is not configured (SMTP_HOST); could not send the password reset email to ${to}`,
        );
      } else {
        // Local development without SMTP: print the link so the flow can still be used.
        this.logger.warn(
          `SMTP is not configured (SMTP_HOST). Password reset link for ${to}: ${resetLink}`,
        );
      }
      return;
    }

    await transporter.sendMail({
      from:
        process.env.SMTP_FROM || `"InfraSentinel" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Reset your InfraSentinel password',
      text: [
        'We received a request to reset the password for your InfraSentinel account.',
        '',
        `Open this link to choose a new password (valid for ${expiresInMinutes} minutes, one use only):`,
        resetLink,
        '',
        "If you didn't ask for this, you can ignore this email. Your password will not change.",
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; color: #1f2937;">
          <h2 style="margin: 0 0 16px;">Reset your InfraSentinel password</h2>
          <p>We received a request to reset the password for your InfraSentinel account.</p>
          <p style="margin: 24px 0;">
            <a href="${resetLink}" style="background: #4f46e5; color: #ffffff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600;">Choose a new password</a>
          </p>
          <p style="font-size: 13px; color: #6b7280;">This link is valid for ${expiresInMinutes} minutes and can be used once.
          If you didn't ask for this, you can ignore this email. Your password will not change.</p>
        </div>`,
    });
  }
}
