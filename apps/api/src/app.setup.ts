import { ValidationPipe } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

// Global HTTP pipeline shared by main.ts and the test harness, so automated
// tests exercise exactly the same validation and CORS rules as the real server.
export function configureApp(app: NestFastifyApplication) {
  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
