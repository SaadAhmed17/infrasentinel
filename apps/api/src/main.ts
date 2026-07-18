import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { FastifyAdapter, NestFastifyApplication, } from '@nestjs/platform-fastify';


async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
  console.log(`API running on port ${process.env.PORT ?? 3001}`);
}
bootstrap();
