import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventsService } from './events.service';

interface IncomingRequest {
  method: string;
  url: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

// Routes that poll on a timer from the dashboard — excluded so normal
// browsing doesn't get logged as "API traffic" and skew abuse detection.
const EXCLUDED_PATTERNS: RegExp[] = [
  /^\/servers$/,
  /^\/servers\/[^/]+\/metrics/,
  /^\/servers\/[^/]+\/anomaly-score$/,
  /^\/incidents$/,
  /^\/health$/,
];

@Injectable()
export class ApiUsageMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ApiUsageMiddleware.name);

  constructor(
    private eventsService: EventsService,
    private jwtService: JwtService,
  ) {}

  use(req: IncomingRequest, res: unknown, next: () => void) {
    const path = req.url.split('?')[0];

    if (
      req.method === 'OPTIONS' ||
      EXCLUDED_PATTERNS.some((p) => p.test(path))
    ) {
      next();
      return;
    }

    // Fire-and-forget — logging must never slow down or block the real request
    void this.logRequest(req, path);
    next();
  }

  private async logRequest(req: IncomingRequest, path: string) {
    // Middleware runs BEFORE auth guards, so req.user isn't populated yet.
    // We decode the token ourselves, best-effort — a missing/invalid token
    // (e.g. a login attempt) just means the event has no organizationId,
    // same pattern as your existing AUTH_LOGIN_FAILURE-on-unknown-email events.
    let organizationId: string | undefined;
    const authHeader = req.headers['authorization'];
    const authValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (authValue?.startsWith('Bearer ')) {
      try {
        const payload: { organizationId?: string } =
          await this.jwtService.verifyAsync(authValue.slice(7), {
            secret: process.env.JWT_ACCESS_SECRET,
          });
        organizationId = payload.organizationId;
      } catch {
        // invalid/expired token — proceed without organizationId
      }
    }

    const ipAddress = req.ip ?? 'unknown';

    try {
      await this.eventsService.record({
        eventType: 'API_REQUEST',
        source: 'api-usage-middleware',
        severity: 'INFO',
        message: `${req.method} ${path} from ${ipAddress}`,
        metadata: { method: req.method, path, ipAddress },
        organizationId,
      });
    } catch (err) {
      this.logger.error(`Failed to record API_REQUEST event: ${err}`);
    }
  }
}
