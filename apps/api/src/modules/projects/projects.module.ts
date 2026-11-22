import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectEntity } from './project.entity';
import { ProjectRepository } from './project.repository';
import { TypeOrmProjectRepository } from './project.repository.typeorm';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectEntity])],
  controllers: [ProjectsController],
  providers: [ProjectsService, { provide: ProjectRepository, useClass: TypeOrmProjectRepository }],
})
export class ProjectsModule {}
