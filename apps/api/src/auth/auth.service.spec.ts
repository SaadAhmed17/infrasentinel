import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EventsService } from '../events/events.service';
import * as bcrypt from 'bcrypt';
import { beforeEach, describe, it } from 'node:test';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock }; $transaction: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('fake-token') },
        },
        { provide: EventsService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('rejects signup with an already-used email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(
      service.signup({
        email: 'taken@test.com',
        password: 'password123',
        organizationName: 'Test Org',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects login with a non-existent email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login(
        { email: 'nobody@test.com', password: 'anything' },
        '127.0.0.1',
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects login with a wrong password', async () => {
    const realHash = await bcrypt.hash('correctpassword', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'saad@test.com',
      passwordHash: realHash,
      role: 'OWNER',
      organizationId: 'org-1',
    });

    await expect(
      service.login(
        { email: 'saad@test.com', password: 'wrongpassword' },
        '127.0.0.1',
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts login with correct credentials and issues tokens', async () => {
    const realHash = await bcrypt.hash('correctpassword', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'saad@test.com',
      passwordHash: realHash,
      role: 'OWNER',
      organizationId: 'org-1',
    });

    const result = await service.login(
      { email: 'saad@test.com', password: 'correctpassword' },
      '127.0.0.1',
    );

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });
});
