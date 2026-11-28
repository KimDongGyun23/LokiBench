import { Module } from '@nestjs/common';

import { ProjectsModule } from '@/modules/projects/projects.module';

import { IssueRepository } from './issue.repository';
import { TypeOrmIssueRepository } from './issue.repository.typeorm';
import { IssuesController } from './issues.controller';
import { IssuesService } from './issues.service';

@Module({
  imports: [ProjectsModule],
  controllers: [IssuesController],
  providers: [IssuesService, { provide: IssueRepository, useClass: TypeOrmIssueRepository }],
})
export class IssuesModule {}
