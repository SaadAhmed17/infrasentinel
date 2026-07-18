import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

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
