import { Test, TestingModule } from '@nestjs/testing';
import { IncidentsController } from './incidents.controller';

describe('IncidentsController', () => {
  let controller: IncidentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IncidentsController],
    }).compile();

    controller = module.get<IncidentsController>(IncidentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
