import { Controller, Get } from '@nestjs/common';

/**
 * api 서버가 떠서 요청을 받는지 확인하는 경로를 연다. (GET /api/health)
 *
 * - DB를 조회하지 않으므로 서버 기동 여부만 알려 준다
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { ok: true } {
    return { ok: true };
  }
}
