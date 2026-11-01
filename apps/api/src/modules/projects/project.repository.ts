import type { Project, ProjectColor } from '@lokibench/contracts';

/**
 * 프로젝트 저장소의 약속이다.
 *
 * - service는 이 추상 클래스에만 기대고, 어떤 DB를 쓰는지는 구현체가 정한다
 * - Nest가 추상 클래스를 주입 토큰으로 쓸 수 있어서 interface 대신 abstract class로 둔다
 * - 이름 UNIQUE 위반은 구현체가 AppError('PROJECT_NAME_TAKEN')로 바꿔 던진다
 */
export abstract class ProjectRepository {
  // 만든 순서(createdAt, 같으면 id 오름차순)로 줌
  abstract findAll(options: { includeArchived: boolean }): Promise<Project[]>;

  abstract findById(id: number): Promise<Project | null>;

  abstract findByName(name: string): Promise<Project | null>;

  abstract create(input: { name: string; color: ProjectColor }): Promise<Project>;

  // 없는 id면 예외 대신 null을 줘서 service가 PROJECT_NOT_FOUND로 바꾸게 함
  abstract update(
    id: number,
    changes: { name?: string; color?: ProjectColor },
  ): Promise<Project | null>;
}
