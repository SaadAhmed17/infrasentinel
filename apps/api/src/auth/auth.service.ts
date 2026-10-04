import {
  Injectable,
  ConflictException,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UnauthorizedException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { EventsService } from '../events/events.service';
import { MailService } from '../mail/mail.service';

const PASSWORD_RESET_TOKEN_MINUTES = 30;
// At most one reset email per address in this period, so the endpoint can't be used to flood an inbox.
const PASSWORD_RESET_EMAIL_COOLDOWN_MS = 60_000;
const PASSWORD_RESET_PURPOSE = 'password-reset';

type TokenUser = Pick<
  User,
  'id' | 'email' | 'role' | 'organizationId' | 'passwordHash'
>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly lastResetEmailAt = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private eventsService: EventsService,
    private mailService: MailService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const org = await tx.organization.create({
          data: { name: dto.organizationName },
        });

        const user = await tx.user.create({
          data: {
            email: dto.email,
            passwordHash,
            organizationId: org.id,
            role: 'OWNER',
          },
        });

        return { org, user };
      },
    );

    return this.issueTokens(result.user);
  }

  async login(dto: LoginDto, ipAddress: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      await this.eventsService.record({
        eventType: 'AUTH_LOGIN_FAILURE',
        source: 'auth-service',
        severity: 'WARNING',
        message: `Failed login attempt for unknown email ${dto.email}`,
        metadata: { email: dto.email, ipAddress, reason: 'unknown_email' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.eventsService.record({
        eventType: 'AUTH_LOGIN_FAILURE',
        source: 'auth-service',
        severity: 'WARNING',
        message: `Failed login attempt for ${dto.email}`,
        metadata: { email: dto.email, ipAddress, reason: 'wrong_password' },
        organizationId: user.organizationId,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.eventsService.record({
      eventType: 'AUTH_LOGIN_SUCCESS',
      source: 'auth-service',
      severity: 'INFO',
      message: `Successful login for ${dto.email}`,
      metadata: { email: dto.email, ipAddress },
      organizationId: user.organizationId,
    });

    return this.issueTokens(user);
  }

  private async issueTokens(user: TokenUser) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      pwv: this.passwordVersion(user.passwordHash),
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- expiresIn requires a template-literal-typed string (e.g. "15m") that `process.env` values can't satisfy at compile time; runtime value is validated via .env.example.
      expiresIn: process.env.JWT_ACCESS_EXPIRY as any,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- same as above, for the refresh token expiry.
      expiresIn: process.env.JWT_REFRESH_EXPIRY as any,
    });

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string) {
    let payload: {
      sub: string;
      email: string;
      role: string;
      organizationId: string;
      pwv?: string;
    };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Confirm the user still exists and hasn't been deactivated/deleted since the token was issued
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    // Sessions issued before the last password change (e.g. a reset) are no longer valid
    if (payload.pwv !== this.passwordVersion(user.passwordHash)) {
      throw new UnauthorizedException(
        'Your password was changed. Please sign in again',
      );
    }

    return this.issueTokens(user);
  }

  async acceptInvitation(dto: { token: string; password: string }) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: dto.token },
    });

    if (!invitation || invitation.status !== 'PENDING') {
      throw new UnauthorizedException('Invalid or already-used invitation');
    }
    if (invitation.expiresAt < new Date()) {
      throw new UnauthorizedException('This invitation has expired');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const user = await tx.user.create({
          data: {
            email: invitation.email,
            passwordHash,
            role: invitation.role,
            organizationId: invitation.organizationId,
          },
        });

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: 'ACCEPTED' },
        });

        return user;
      },
    );

    return this.issueTokens(result);
  }

  async forgotPassword(dto: ForgotPasswordDto, ipAddress: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    await this.eventsService.record({
      eventType: 'AUTH_PASSWORD_RESET_REQUESTED',
      source: 'auth-service',
      severity: 'INFO',
      message: user
        ? `Password reset requested for ${dto.email}`
        : `Password reset requested for unknown email ${dto.email}`,
      metadata: user
        ? { email: dto.email, ipAddress }
        : { email: dto.email, ipAddress, reason: 'unknown_email' },
      organizationId: user?.organizationId,
    });

    if (user && this.claimResetEmailSlot(user.email)) {
      const token = await this.jwtService.signAsync(
        { sub: user.id, purpose: PASSWORD_RESET_PURPOSE },
        {
          secret: this.passwordResetSecret(user.passwordHash),
          expiresIn: `${PASSWORD_RESET_TOKEN_MINUTES}m`,
        },
      );
      const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:3000';
      const resetLink = `${webAppUrl}/reset-password?token=${encodeURIComponent(token)}`;

      // Not awaited: the response time must not reveal whether the email has an account.
      this.mailService
        .sendPasswordResetEmail(
          user.email,
          resetLink,
          PASSWORD_RESET_TOKEN_MINUTES,
        )
        .catch((err) =>
          this.logger.error(
            `Failed to send password reset email to ${user.email}: ${err}`,
          ),
        );
    }

    // Without SMTP no email can be sent to anyone, so say so instead of
    // "a link has been sent". The answer doesn't depend on the email address.
    if (!this.mailService.isConfigured()) {
      throw new ServiceUnavailableException(
        process.env.NODE_ENV === 'production'
          ? 'Password reset emails are not available right now. Please contact your administrator.'
          : 'Password reset emails are not set up on this server yet (SMTP settings are missing in apps/api/.env), so no email was sent. ' +
              'For an existing account the reset link is printed in the API terminal.',
      );
    }

    // Same answer whether or not the account exists, so emails can't be enumerated.
    return {
      message:
        'If an account exists for that email, a password reset link has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto, ipAddress: string) {
    const invalidLink = new BadRequestException(
      'This password reset link is invalid or has expired. Please request a new one.',
    );

    const claims = this.jwtService.decode<{
      sub?: string;
      purpose?: string;
    } | null>(dto.token);
    if (!claims?.sub || claims.purpose !== PASSWORD_RESET_PURPOSE) {
      throw invalidLink;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
    });
    if (!user) throw invalidLink;

    try {
      await this.jwtService.verifyAsync(dto.token, {
        secret: this.passwordResetSecret(user.passwordHash),
      });
    } catch {
      throw invalidLink;
    }

    // Only succeeds if the password is still the one the link was issued for,
    // so a link can be used once, even by two requests at the same time.
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const { count } = await this.prisma.user.updateMany({
      where: { id: user.id, passwordHash: user.passwordHash },
      data: { passwordHash },
    });
    if (count === 0) throw invalidLink;

    await this.eventsService.record({
      eventType: 'AUTH_PASSWORD_RESET_COMPLETED',
      source: 'auth-service',
      severity: 'INFO',
      message: `Password reset completed for ${user.email}`,
      metadata: { email: user.email, ipAddress },
      organizationId: user.organizationId,
    });

    return {
      message:
        'Your password has been reset. You can now sign in with your new password.',
    };
  }

  // A reset link is signed with a key that includes the current password hash,
  // so it stops working as soon as the password changes (single use).
  private passwordResetSecret(passwordHash: string) {
    return `${process.env.JWT_ACCESS_SECRET}:${passwordHash}`;
  }

  // Short fingerprint of the password hash carried in every token; when the
  // password changes, refresh tokens issued before the change are rejected.
  private passwordVersion(passwordHash: string) {
    return crypto
      .createHmac('sha256', process.env.JWT_REFRESH_SECRET ?? '')
      .update(passwordHash)
      .digest('base64url')
      .slice(0, 16);
  }

  private claimResetEmailSlot(email: string) {
    const now = Date.now();
    for (const [address, sentAt] of this.lastResetEmailAt) {
      if (now - sentAt >= PASSWORD_RESET_EMAIL_COOLDOWN_MS) {
        this.lastResetEmailAt.delete(address);
      }
    }
    if (this.lastResetEmailAt.has(email)) return false;
    this.lastResetEmailAt.set(email, now);
    return true;
  }
}
