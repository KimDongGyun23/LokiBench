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

// service가 repository에 새 이슈를 만들 때 넘기는 값
export interface CreateIssueInput {
  projectId: number;
  title: string;
  due: string | null;
  now: Date;
}

// service가 repository에 바뀐 이슈를 저장할 때 넘기는 값 (expectedVersion은 service가 읽었을 때의 version)
export interface SaveIssueChangeInput {
  issue: Issue;
  expectedVersion: number;
  event: NewStatusEvent | null;
}

// service가 repository에 되돌린 이슈를 저장할 때 넘기는 값 (removedEventId는 지울 상태 변경 이력의 id)
export interface SaveIssueUndoInput {
  issue: Issue;
  expectedVersion: number;
  removedEventId: number;
}

// controller가 service에 새 이슈를 요청할 때 넘기는 값 (마감이 없으면 비워 둠)
export interface CreateIssueCommand {
  projectId: number;
  title: string;
  due?: string | null;
}

// controller가 service에 이슈 수정을 요청할 때 넘기는 값 (version은 화면이 본 이슈의 version)
export interface UpdateIssueCommand extends IssueChanges {
  version: number;
}

// repository가 service에 넘기는 프로젝트 하나의 열린 이슈 수
export interface OpenIssueCount {
  projectId: number;
  count: number;
}
