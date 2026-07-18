import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ServersService } from '../servers.service';

interface RequestWithHeaders {
  headers: Record<string, string | undefined>;
   monitoredServer?: unknown;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private serversService: ServersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithHeaders>();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('Missing API key');
    }

    const server = await this.serversService.findByApiKey(apiKey);
    request.monitoredServer = server; // attach for the controller to use
    return true;
  }
}