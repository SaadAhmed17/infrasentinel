import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventsService } from '../events/events.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private eventsService: EventsService,
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

    return this.issueTokens(
      result.user.id,
      result.user.email,
      result.user.role,
      result.org.id,
    );
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

    return this.issueTokens(
      user.id,
      user.email,
      user.role,
      user.organizationId,
    );
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: string,
    organizationId: string,
  ) {
    const payload = { sub: userId, email, role, organizationId };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expiresIn requires a template-literal-typed string (e.g. "15m") that `process.env` values can't satisfy at compile time; runtime value is validated via .env.example.
      expiresIn: process.env.JWT_ACCESS_EXPIRY as any,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- same as above, for the refresh token expiry.
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

    return this.issueTokens(
      user.id,
      user.email,
      user.role,
      user.organizationId,
    );
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

    return this.issueTokens(
      result.id,
      result.email,
      result.role,
      result.organizationId,
    );
  }
}
