import type { ProjectColor } from '@lokibench/domain';

// DB 열 모양(엔티티)과 응답 모양(계약)을 모르고, 둘은 각자 이 모양으로 바꿔서 주고받음
// 시각은 도메인에서 바로 빼고 비교하도록 Date로 둠

// service와 저장소가 다루는 프로젝트
export interface Project {
  id: number;
  name: string;
  color: ProjectColor;
  createdAt: Date;
  archivedAt: Date | null;
}

// 저장소에 새 프로젝트를 만들 때 넘기는 값
export type CreateProjectInput = Pick<Project, 'name' | 'color'>;

// 저장소에서 프로젝트를 바꿀 때 넘기는 값
export type UpdateProjectInput = Partial<CreateProjectInput>;
