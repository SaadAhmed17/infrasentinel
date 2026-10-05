import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventsService } from './events.service';

interface IncomingRequest {
  method: string;
  url: string;
  originalUrl?: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

// Requests that are not user API usage: dashboard pages that poll on a timer
// (so normal browsing isn't counted as "API traffic"), agent telemetry
// (machine traffic authenticated by API key) and health checks.
const EXCLUDED_PATTERNS: RegExp[] = [
  /^\/agent\//,
  /^\/servers$/,
  /^\/servers\/[^/]+\/metrics/,
  /^\/servers\/[^/]+\/anomaly-score$/,
  /^\/incidents$/,
  /^\/incidents\/dashboard-summary$/,
  /^\/health$/,
];

// Records every user API request as an API_REQUEST event, so an
// EVENT_FREQUENCY rule (e.g. 100 requests per minute from one IP address)
// can detect API abuse.
@Injectable()
export class ApiUsageMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ApiUsageMiddleware.name);

  constructor(
    private eventsService: EventsService,
    private jwtService: JwtService,
  ) {}

  use(req: IncomingRequest, res: unknown, next: () => void) {
    // On Fastify, middleware sees `url` relative to its mount point ("/");
    // originalUrl keeps the full request path.
    const path = (req.originalUrl ?? req.url).split('?')[0];

    if (
      req.method === 'OPTIONS' ||
      EXCLUDED_PATTERNS.some((p) => p.test(path))
    ) {
      next();
      return;
    }

    // Fire-and-forget: logging must never slow down or block the real request.
    void this.logRequest(req, path);
    next();
  }

  private async logRequest(req: IncomingRequest, path: string) {
    // Middleware runs before the auth guards, so the token is decoded here,
    // best effort: without a valid token (e.g. a login attempt) the event has
    // no organization, like failed logins for unknown e-mails.
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
        // invalid or expired token: record without an organization
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
