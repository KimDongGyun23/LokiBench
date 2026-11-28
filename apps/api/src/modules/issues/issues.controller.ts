import {
  createIssueRequestSchema,
  type Issue as IssueResponse,
  listIssuesQuerySchema,
  undoIssueStatusRequestSchema,
  updateIssueRequestSchema,
} from '@lokibench/shared/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';

import { toIssueResponse } from './issue.mapper';
import { IssuesService } from './issues.service';

// 전역 ZodValidationPipe가 계약 스키마로 본문과 쿼리를 검증하도록 DTO 클래스로 감쌈
class CreateIssueDto extends createZodDto(createIssueRequestSchema) {}
class ListIssuesQueryDto extends createZodDto(listIssuesQuerySchema) {}
class UpdateIssueDto extends createZodDto(updateIssueRequestSchema) {}
class UndoIssueStatusDto extends createZodDto(undoIssueStatusRequestSchema) {}

/**
 * 이슈 만들기, 조회, 수정, 상태 되돌리기 경로를 연다. (/api/issues)
 */
@Controller('issues')
export class IssuesController {
  constructor(private readonly service: IssuesService) {}

  @Post()
  async create(@Body() body: CreateIssueDto): Promise<IssueResponse> {
    const issue = await this.service.create(body);
    return toIssueResponse(issue);
  }

  @Get()
  async list(@Query() query: ListIssuesQueryDto): Promise<IssueResponse[]> {
    const issues = await this.service.listByProject(query.projectId);
    return issues.map(toIssueResponse);
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number): Promise<IssueResponse> {
    const issue = await this.service.get(id);
    return toIssueResponse(issue);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateIssueDto,
  ): Promise<IssueResponse> {
    const issue = await this.service.update(id, body);
    return toIssueResponse(issue);
  }

  @Post(':id/undo-status')
  @HttpCode(HttpStatus.OK)
  async undoStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UndoIssueStatusDto,
  ): Promise<IssueResponse> {
    const issue = await this.service.undoStatus(id, body.version);
    return toIssueResponse(issue);
  }
}
