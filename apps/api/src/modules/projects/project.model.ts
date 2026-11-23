import type { ProjectColor } from '@lokibench/shared/values';

// service와 repository가 다루는 프로젝트
export interface Project {
  id: number;
  name: string;
  color: ProjectColor;
  createdAt: Date;
}

// service가 repository에 새 프로젝트를 만들 때 넘기는 값
export type CreateProjectInput = Pick<Project, 'name' | 'color'>;

// service가 repository에서 프로젝트를 바꿀 때 넘기는 값
export type UpdateProjectInput = Partial<Pick<Project, 'name' | 'color'>>;

// controller가 service에 새 프로젝트를 요청할 때 넘기는 값
export type CreateProjectCommand = Pick<Project, 'name'>;

// controller가 service에 프로젝트 수정을 요청할 때 넘기는 값
export type UpdateProjectCommand = Partial<Pick<Project, 'name' | 'color'>>;
