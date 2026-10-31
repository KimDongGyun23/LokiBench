import { type DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { createDataSourceOptions } from './database/data-source-options';
import { HealthController } from './health/health.controller';

interface AppModuleOptions {
  databasePath: string;
}

@Module({})
export class AppModule {
  /**
   * DB 경로를 받아 앱 모듈을 만든다.
   *
   * - 실제 기동은 파일 경로, 테스트는 ':memory:'를 넘겨 같은 모듈을 쓴다
   *
   * @param options DB 파일 경로
   * @returns 앱 루트 모듈
   */
  static forRoot({ databasePath }: AppModuleOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        // 로컬 sqlite는 재시도해도 결과가 같아서, 실패를 바로 드러내도록 재시도하지 않음
        TypeOrmModule.forRoot({ ...createDataSourceOptions(databasePath), retryAttempts: 0 }),
      ],
      controllers: [HealthController],
    };
  }
}
