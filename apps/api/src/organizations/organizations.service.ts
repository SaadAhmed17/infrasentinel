import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
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
    organizationId: string,
    actingUserId: string,
    actingUserRole: string,
    targetUserId: string,
    newRole: string,
  ) {
    const validRoles = [
      'OWNER',
      'ADMIN',
      'SECURITY_ANALYST',
      'DEVOPS_ENGINEER',
      'DEVELOPER',
      'VIEWER',
    ];
    if (!validRoles.includes(newRole)) {
      throw new BadRequestException('Invalid role');
    }

    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId },
    });
    if (!targetUser)
      throw new NotFoundException('User not found in this organization');

    // Only an OWNER can grant OWNER, or change an existing OWNER's role —
    // otherwise an ADMIN could silently promote themselves (or anyone) to OWNER.
    const involvesOwnerRole =
      newRole === 'OWNER' || targetUser.role === 'OWNER';
    if (involvesOwnerRole && actingUserRole !== 'OWNER') {
      throw new ForbiddenException(
        'Only an organization Owner can grant or change the Owner role',
      );
    }

    // An org must always retain at least one OWNER — block demoting the last one.
    if (targetUser.role === 'OWNER' && newRole !== 'OWNER') {
      const ownerCount = await this.prisma.user.count({
        where: { organizationId, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException(
          "Cannot change the last remaining Owner's role — promote another member to Owner first",
        );
      }
    }

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        role: newRole as
          | 'OWNER'
          | 'ADMIN'
          | 'SECURITY_ANALYST'
          | 'DEVOPS_ENGINEER'
          | 'DEVELOPER'
          | 'VIEWER',
      },
      select: { id: true, email: true, role: true },
    });
  }

  async createInvitation(organizationId: string, dto: CreateInvitationDto) {
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
