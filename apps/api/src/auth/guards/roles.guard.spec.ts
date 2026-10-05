import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const guardWith = (required: string[] | undefined) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  };
  const contextFor = (role: string) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    }) as unknown as ExecutionContext;

  it('allows any authenticated role when the route declares no roles', () => {
    expect(guardWith(undefined).canActivate(contextFor('VIEWER'))).toBe(true);
    expect(guardWith([]).canActivate(contextFor('VIEWER'))).toBe(true);
  });

  it('allows a role that is in the required list', () => {
    expect(guardWith(['OWNER', 'ADMIN']).canActivate(contextFor('ADMIN'))).toBe(
      true,
    );
  });

  it('denies a role that is not in the required list', () => {
    expect(
      guardWith(['OWNER', 'ADMIN']).canActivate(contextFor('SECURITY_ANALYST')),
    ).toBe(false);
  });

  it('matches roles exactly (no case-insensitive or prefix matches)', () => {
    const guard = guardWith(['ADMIN']);
    expect(guard.canActivate(contextFor('admin'))).toBe(false);
    expect(guard.canActivate(contextFor('ADMINISTRATOR'))).toBe(false);
  });
});
