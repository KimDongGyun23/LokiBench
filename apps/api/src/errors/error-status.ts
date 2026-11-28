import type { ErrorCode } from '@lokibench/shared/contracts';
import type {
  IssueErrorCode,
  MilestoneErrorCode,
  ProjectErrorCode,
} from '@lokibench/shared/values';
import { HttpStatus } from '@nestjs/common';

// 프로젝트 오류 코드별 상태 코드
const PROJECT_ERROR_STATUS: Record<ProjectErrorCode, HttpStatus> = {
  PROJECT_NOT_FOUND: HttpStatus.NOT_FOUND,
  PROJECT_NAME_TAKEN: HttpStatus.CONFLICT,
};

// 이슈 오류 코드별 상태 코드
const ISSUE_ERROR_STATUS: Record<IssueErrorCode, HttpStatus> = {
  ISSUE_NOT_FOUND: HttpStatus.NOT_FOUND,
  ISSUE_VERSION_CONFLICT: HttpStatus.CONFLICT,
  ISSUE_TRANSITION_NOT_ALLOWED: HttpStatus.CONFLICT,
  ISSUE_CLOSED: HttpStatus.CONFLICT,
  ISSUE_UNDO_NOTHING: HttpStatus.CONFLICT,
  ISSUE_UNDO_EXPIRED: HttpStatus.CONFLICT,
};

// 마일스톤 오류 코드별 상태 코드
const MILESTONE_ERROR_STATUS: Record<MilestoneErrorCode, HttpStatus> = {
  MILESTONE_NOT_FOUND: HttpStatus.NOT_FOUND,
  MILESTONE_TITLE_TAKEN: HttpStatus.CONFLICT,
  MILESTONE_HAS_OPEN_ISSUES: HttpStatus.CONFLICT,
  MILESTONE_HAS_ISSUES: HttpStatus.CONFLICT,
  MILESTONE_CLOSED: HttpStatus.CONFLICT,
  MILESTONE_PROJECT_MISMATCH: HttpStatus.CONFLICT,
};

// 오류 코드별로 응답에 실을 HTTP 상태 코드
export const ERROR_STATUS: Record<ErrorCode, HttpStatus> = {
  VALIDATION: HttpStatus.BAD_REQUEST,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  ...PROJECT_ERROR_STATUS,
  ...ISSUE_ERROR_STATUS,
  ...MILESTONE_ERROR_STATUS,
  INTERNAL: HttpStatus.INTERNAL_SERVER_ERROR,
};
