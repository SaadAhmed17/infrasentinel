import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Role } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async getMyOrganization(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async listMembers(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: { id: true, email: true, role: true, createdAt: true }, // never return passwordHash
    });
  }

  async updateOrganization(organizationId: string, dto: UpdateOrganizationDto) {
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { name: dto.name },
    });
  }

  async updateMemberRole(
    actor: AuthenticatedUser,
    targetUserId: string,
    newRole: Role,
  ) {
    const { organizationId } = actor;
    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId },
    });
    if (!targetUser)
      throw new NotFoundException('User not found in this organization');

    // Only an owner may grant the OWNER role or change an owner's role.
    if (newRole === 'OWNER' || targetUser.role === 'OWNER') {
      await this.assertIsOwner(actor);
    }

    // An organization must always keep at least one owner.
    if (targetUser.role === 'OWNER' && newRole !== 'OWNER') {
      const owners = await this.prisma.user.count({
        where: { organizationId, role: 'OWNER' },
      });
      if (owners <= 1) {
        throw new ConflictException(
          'An organization must keep at least one owner',
        );
      }
    }

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
      select: { id: true, email: true, role: true },
    });
  }

  // Checks the caller's CURRENT role in the database rather than the role in
  // their token, which may be up to 15 minutes old after a demotion.
  private async assertIsOwner(actor: AuthenticatedUser) {
    const current = await this.prisma.user.findFirst({
      where: { id: actor.userId, organizationId: actor.organizationId },
      select: { role: true },
    });
    if (current?.role !== 'OWNER') {
      throw new ForbiddenException(
        'Only an owner can grant or change the owner role',
      );
    }
  }

  async createInvitation(actor: AuthenticatedUser, dto: CreateInvitationDto) {
    const { organizationId } = actor;
    if (dto.role === 'OWNER') {
      await this.assertIsOwner(actor);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ForbiddenException('A user with this email already exists');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.prisma.invitation.create({
      data: {
        email: dto.email,
        role: dto.role,
        token,
        organizationId,
        expiresAt,
      },
    });

    // No email service yet — return the link for the admin to share manually
    const inviteLink = `http://localhost:3000/accept-invite?token=${token}`;
    return { invitation, inviteLink };
  }

  async listInvitations(organizationId: string) {
    return this.prisma.invitation.findMany({
      where: { organizationId, status: 'PENDING' },
    });
  }
}
