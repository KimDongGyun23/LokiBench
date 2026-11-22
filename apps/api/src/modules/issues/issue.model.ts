import type { ClosedIssueStatus, IssueStatus, OpenIssueStatus } from '@lokibench/domain';

// DB 열 모양(엔티티)과 응답 모양(계약)을 모르고, 둘은 각자 이 모양으로 바꿔서 주고받음
// 시각은 도메인에서 바로 빼고 비교하도록 Date로 둠
// 마감은 시각이 없는 날짜라 YYYY-MM-DD 글자로 둠

interface IssueBase {
  id: number;
  projectId: number;
  number: number;
  title: string;
  due: string | null;
  statusChangedAt: Date;
  version: number;
  createdAt: Date;
}

// 열린 이슈는 닫은 시각이 없음
export interface OpenIssue extends IssueBase {
  status: OpenIssueStatus;
  closedAt: null;
}

// 닫힌 이슈는 닫은 시각이 반드시 있음
export interface ClosedIssue extends IssueBase {
  status: ClosedIssueStatus;
  closedAt: Date;
}

// service와 저장소가 다루는 이슈
export type Issue = OpenIssue | ClosedIssue;

interface IssueEventBase {
  id: number;
  issueId: number;
  at: Date;
}

// 이슈에 일어난 일을 한 줄씩 남기는 이력
export type IssueEvent =
  | (IssueEventBase & { kind: 'CREATED' })
  | (IssueEventBase & { kind: 'STATUS'; from: IssueStatus; to: IssueStatus });

// 저장 전이라 id가 없는 상태 변경 기록
export interface NewStatusEvent {
  at: Date;
  from: IssueStatus;
  to: IssueStatus;
}

// 이슈에서 바꾸려는 칸
export interface IssueChanges {
  title?: string;
  due?: string | null;
  status?: IssueStatus;
}
