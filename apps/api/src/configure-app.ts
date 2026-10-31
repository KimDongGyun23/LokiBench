import type { INestApplication } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';

import { AppExceptionFilter } from './common/app-exception.filter';

/**
 * 실제 기동과 테스트가 같은 요청 처리 규칙을 쓰도록 앱 공통 설정을 건다.
 *
 * @param app 설정할 Nest 앱
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AppExceptionFilter());
}
