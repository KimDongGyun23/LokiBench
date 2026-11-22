import {
  createProjectRequestSchema,
  type Project as ProjectResponse,
  updateProjectRequestSchema,
} from '@lokibench/shared/contracts';
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';

import { toProjectResponse } from './project.mapper';
import { ProjectsService } from './projects.service';

// 전역 ZodValidationPipe가 계약 스키마로 본문을 검증하도록 DTO 클래스로 감쌈
class CreateProjectDto extends createZodDto(createProjectRequestSchema) {}
class UpdateProjectDto extends createZodDto(updateProjectRequestSchema) {}

/**
 * 프로젝트 목록, 추가, 수정 경로를 연다. (/api/projects)
 */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  async list(): Promise<ProjectResponse[]> {
    const projects = await this.service.list();
    return projects.map(toProjectResponse);
  }

  @Post()
  async create(@Body() body: CreateProjectDto): Promise<ProjectResponse> {
    const project = await this.service.create(body);
    return toProjectResponse(project);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateProjectDto,
  ): Promise<ProjectResponse> {
    const project = await this.service.update(id, body);
    return toProjectResponse(project);
  }
}
