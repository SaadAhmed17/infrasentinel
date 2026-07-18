import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

const jwtSecret = process.env.JWT_ACCESS_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_ACCESS_SECRET is not set in environment variables');
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret!,
    });
  }

  async validate(payload: { sub: string; email: string; role: string; organizationId: string }) {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
    };
  }
}