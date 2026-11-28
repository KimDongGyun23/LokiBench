import { Module } from '@nestjs/common';

import { ProjectsModule } from '@/modules/projects/projects.module';

import { MilestoneRepository } from './milestone.repository';
import { TypeOrmMilestoneRepository } from './milestone.repository.typeorm';
import { MilestonesController } from './milestones.controller';
import { MilestonesService } from './milestones.service';

@Module({
  imports: [ProjectsModule],
  controllers: [MilestonesController],
  providers: [
    MilestonesService,
    { provide: MilestoneRepository, useClass: TypeOrmMilestoneRepository },
  ],
})
export class MilestonesModule {}
