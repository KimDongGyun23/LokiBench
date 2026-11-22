import type { ClosedIssueStatus, IssueStatus, OpenIssueStatus } from '@lokibench/shared/values';

// 열린 이슈와 닫힌 이슈가 함께 갖는 칸
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

// 열린 이슈 (닫은 시각이 없음)
export interface OpenIssue extends IssueBase {
  status: OpenIssueStatus;
  closedAt: null;
}

// 닫힌 이슈 (닫은 시각이 반드시 있음)
export interface ClosedIssue extends IssueBase {
  status: ClosedIssueStatus;
  closedAt: Date;
}

// service와 repository가 다루는 이슈
export type Issue = OpenIssue | ClosedIssue;

// 이력이 종류와 상관없이 갖는 칸
interface IssueEventBase {
  id: number;
  issueId: number;
  at: Date;
}

// 이슈 이력 (이슈에 일어난 일을 한 줄씩 남김)
export type IssueEvent =
  | (IssueEventBase & { kind: 'CREATED' })
  | (IssueEventBase & { kind: 'STATUS'; from: IssueStatus; to: IssueStatus });

// 저장 전의 상태 변경 이력 (id가 없음)
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
