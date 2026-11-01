import {
  createProjectRequestSchema,
  type Project,
  updateProjectRequestSchema,
} from '@lokibench/contracts';
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';

import { ProjectsService } from './projects.service';

// 전역 ZodValidationPipe가 계약 스키마로 본문을 검증하도록 DTO 클래스로 감쌈
class CreateProjectDto extends createZodDto(createProjectRequestSchema) {}
class UpdateProjectDto extends createZodDto(updateProjectRequestSchema) {}

/**
 * 프로젝트 목록, 추가, 수정 경로를 연다. (/api/projects)
 *
 * - 요청 검증만 맡고 규칙은 service에 맡긴다
 */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  list(): Promise<Project[]> {
    return this.service.list();
  }

  @Post()
  create(@Body() body: CreateProjectDto): Promise<Project> {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateProjectDto): Promise<Project> {
    return this.service.update(id, body);
  }
}
