import {
  createMilestoneRequestSchema,
  listMilestonesQuerySchema,
  type Milestone as MilestoneResponse,
  updateMilestoneRequestSchema,
} from '@lokibench/shared/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';

import { toMilestoneResponse } from './milestone.mapper';
import { MilestonesService } from './milestones.service';

// 전역 ZodValidationPipe가 계약 스키마로 본문과 쿼리를 검증하도록 DTO 클래스로 감쌈
class CreateMilestoneDto extends createZodDto(createMilestoneRequestSchema) {}
class ListMilestonesQueryDto extends createZodDto(listMilestonesQuerySchema) {}
class UpdateMilestoneDto extends createZodDto(updateMilestoneRequestSchema) {}

/**
 * 마일스톤 만들기, 조회, 수정, 닫기, 재오픈, 삭제, 되살리기 경로를 연다. (/api/milestones)
 *
 * - 수정은 칸 전부를 보내므로 PATCH가 아니라 PUT이다
 */
@Controller('milestones')
export class MilestonesController {
  constructor(private readonly service: MilestonesService) {}

  @Post()
  async create(@Body() body: CreateMilestoneDto): Promise<MilestoneResponse> {
    return toMilestoneResponse(await this.service.create(body));
  }

  @Get()
  async list(@Query() query: ListMilestonesQueryDto): Promise<MilestoneResponse[]> {
    const milestones = await this.service.list(query.projectId);
    return milestones.map(toMilestoneResponse);
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number): Promise<MilestoneResponse> {
    return toMilestoneResponse(await this.service.get(id));
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateMilestoneDto,
  ): Promise<MilestoneResponse> {
    return toMilestoneResponse(await this.service.update({ id, command: body }));
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  async close(@Param('id', ParseIntPipe) id: number): Promise<MilestoneResponse> {
    return toMilestoneResponse(await this.service.close(id));
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  async reopen(@Param('id', ParseIntPipe) id: number): Promise<MilestoneResponse> {
    return toMilestoneResponse(await this.service.reopen(id));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.remove(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  async restore(@Param('id', ParseIntPipe) id: number): Promise<MilestoneResponse> {
    return toMilestoneResponse(await this.service.restore(id));
  }
}
