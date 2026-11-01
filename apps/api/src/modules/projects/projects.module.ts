import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectEntity } from './project.entity';
import { ProjectRepository } from './project.repository';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { TypeOrmProjectRepository } from './typeorm-project.repository';

// service는 추상 저장소에 기대고, 실제 구현은 여기서 TypeORM 구현체로 연결함
@Module({
  imports: [TypeOrmModule.forFeature([ProjectEntity])],
  controllers: [ProjectsController],
  providers: [ProjectsService, { provide: ProjectRepository, useClass: TypeOrmProjectRepository }],
})
export class ProjectsModule {}
