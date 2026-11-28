import type { Issue as IssueResponse } from '@lokibench/shared/contracts';
import { CLOSED_ISSUE_STATUS, ISSUE_STATUSES } from '@lokibench/shared/values';
import { z } from 'zod';

import { parseStoredInstant } from '@/database/utils/parse-stored-instant';
import { tryParseJson } from '@/database/utils/try-parse-json';

import type { IssueEntity } from './issue.entity';
import type { Issue, IssueEvent, NewStatusEvent } from './issue.model';
import type { IssueEventEntity } from './issue-event.entity';

// 상태 변경 이력의 payload 모양 (이전 상태와 새 상태)
const statusPayloadSchema = z.object({
  from: z.enum(ISSUE_STATUSES),
  to: z.enum(ISSUE_STATUSES),
});

/**
 * 엔티티를 도메인 이슈로 바꾼다.
 *
 * - DB에 ISO 문자열로 저장한 시각을 Date로 바꾼다
 * - 닫힌 상태와 닫은 시각이 어긋난 행은 도메인 타입으로 만들 수 없어 오류로 던진다
 *
 * @param entity DB에서 읽은 엔티티
 * @returns service가 다루는 도메인 이슈
 */
export function toIssueModel(entity: IssueEntity): Issue {
  const { id, status, closedAt } = entity;
  const base = {
    id,
    projectId: entity.projectId,
    number: entity.number,
    title: entity.title,
    due: entity.due,
    statusChangedAt: parseStoredInstant({
      value: entity.statusChangedAt,
      column: 'issues.status_changed_at',
      id,
    }),
    version: entity.version,
    createdAt: parseStoredInstant({ value: entity.createdAt, column: 'issues.created_at', id }),
  };

  const isClosedStatus = status === CLOSED_ISSUE_STATUS;
  const hasClosedAt = closedAt !== null;

  // 닫힌 상태이고 닫은 시각이 있으면 닫힌 이슈
  if (isClosedStatus && hasClosedAt) {
    return {
      ...base,
      status,
      closedAt: parseStoredInstant({ value: closedAt, column: 'issues.closed_at', id }),
    };
  }

  // 닫히지 않은 상태이고 닫은 시각이 없으면 열린 이슈
  if (!isClosedStatus && !hasClosedAt) {
    return { ...base, status, closedAt };
  }

  throw new Error(`issues.status와 closed_at이 어긋남: id=${id}`);
}

/**
 * 엔티티를 도메인 이슈 이력으로 바꾼다.
 *
 * - 상태 변경 이력은 payload의 JSON에서 이전 상태와 새 상태를 꺼낸다
 * - DB는 JSON 모양을 검사하지 않으므로 여기서 검사하고, 깨진 행은 오류로 던진다
 *
 * @param entity DB에서 읽은 엔티티
 * @returns service가 다루는 도메인 이슈 이력
 */
export function toIssueEventModel(entity: IssueEventEntity): IssueEvent {
  const base = {
    id: entity.id,
    issueId: entity.issueId,
    at: parseStoredInstant({ value: entity.at, column: 'issue_events.at', id: entity.id }),
  };

  // 만든 이력은 payload가 없음
  if (entity.kind === 'CREATED') return { ...base, kind: entity.kind };

  // 이전 상태와 새 상태를 꺼낼 수 없으면 어느 행인지 알림
  const payload = statusPayloadSchema.safeParse(tryParseJson(entity.payload));
  if (!payload.success) {
    throw new Error(`issue_events.payload 형식이 잘못됨: id=${entity.id}`);
  }

  return { ...base, kind: entity.kind, from: payload.data.from, to: payload.data.to };
}

/**
 * 도메인 이슈를 UPDATE에 넣을 엔티티 칸으로 바꾼다.
 *
 * - 만든 뒤 바뀌지 않는 칸(id, 프로젝트, 번호, 만든 시각)은 넣지 않는다
 *
 * @param issue 저장할 도메인 이슈
 * @returns 바꿀 칸과 그 값
 */
export function toIssueEntityUpdate(
  issue: Issue,
): Pick<IssueEntity, 'title' | 'due' | 'status' | 'statusChangedAt' | 'version' | 'closedAt'> {
  return {
    title: issue.title,
    due: issue.due,
    status: issue.status,
    statusChangedAt: issue.statusChangedAt.toISOString(),
    version: issue.version,
    closedAt: issue.closedAt?.toISOString() ?? null,
  };
}

/**
 * 저장 전의 상태 변경 이력을 INSERT에 넣을 엔티티 칸으로 바꾼다.
 *
 * - 이전 상태와 새 상태는 payload에 JSON 글자로 담는다
 *
 * @param params.issueId 이력을 남길 이슈 id
 * @param params.event 저장 전의 상태 변경 이력
 * @returns 넣을 칸과 그 값
 */
export function toStatusEventEntity({
  issueId,
  event,
}: {
  issueId: number;
  event: NewStatusEvent;
}): Omit<IssueEventEntity, 'id'> {
  return {
    issueId,
    at: event.at.toISOString(),
    kind: 'STATUS',
    payload: JSON.stringify({ from: event.from, to: event.to }),
  };
}

/**
 * 도메인 이슈를 계약의 응답 모양으로 바꾼다.
 *
 * - JSON에는 날짜 타입이 없어서 시각을 UTC ISO 문자열로 바꾼다
 *
 * @param issue 도메인 이슈
 * @returns 응답에 그대로 실을 이슈
 */
export function toIssueResponse(issue: Issue): IssueResponse {
  return {
    id: issue.id,
    projectId: issue.projectId,
    number: issue.number,
    title: issue.title,
    due: issue.due,
    status: issue.status,
    statusChangedAt: issue.statusChangedAt.toISOString(),
    version: issue.version,
    createdAt: issue.createdAt.toISOString(),
    closedAt: issue.closedAt?.toISOString() ?? null,
  };
}
