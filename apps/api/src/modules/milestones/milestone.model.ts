// service와 repository가 다루는 마일스톤 (지운 마일스톤은 여기까지 올라오지 않음)
export interface Milestone {
  id: number;
  projectId: number;
  title: string;
  // 시작과 마감은 시각 없이 YYYY-MM-DD 날짜만 가짐
  startDate: string | null;
  due: string | null;
  background: string;
  solution: string;
  expectedEffect: string;
  memo: string;
  createdAt: Date;
  closedAt: Date | null;
}

// 화면이 만들기와 수정에서 한꺼번에 고치는 칸
export type MilestoneFields = Pick<
  Milestone,
  'title' | 'startDate' | 'due' | 'background' | 'solution' | 'expectedEffect' | 'memo'
>;

// controller가 service에 새 마일스톤을 요청할 때 넘기는 값
export interface CreateMilestoneCommand extends MilestoneFields {
  projectId: number;
}

// controller가 service에 마일스톤 수정을 요청할 때 넘기는 값 (칸 전부)
export type UpdateMilestoneCommand = MilestoneFields;

// service가 repository에 새 마일스톤을 만들 때 넘기는 값
export interface CreateMilestoneInput extends MilestoneFields {
  projectId: number;
  now: Date;
}

// service가 repository에 마일스톤 수정을 저장할 때 넘기는 값 (칸 전부)
export interface UpdateMilestoneInput {
  id: number;
  fields: MilestoneFields;
}

// service가 repository에 마일스톤을 닫으라고 할 때 넘기는 값 (now가 닫은 시각)
export interface CloseMilestoneInput {
  id: number;
  now: Date;
}

// service가 repository에 마일스톤을 지우라고 할 때 넘기는 값 (now가 지운 시각)
export interface DeleteMilestoneInput {
  id: number;
  now: Date;
}

// 이슈 repository가 쓰기 트랜잭션 안에서 읽는 마일스톤 상태
export interface MilestoneGuard {
  projectId: number;
  isClosed: boolean;
}
