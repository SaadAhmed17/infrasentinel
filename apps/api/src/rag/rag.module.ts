import { Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';

@Module({
  providers: [RagService],
  controllers: [RagController],
})
export class RagModule {}
