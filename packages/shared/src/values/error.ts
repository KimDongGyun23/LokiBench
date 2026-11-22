import { ISSUE_ERROR_CODES } from './issue';
import { PROJECT_ERROR_CODES } from './project';

// service와 repository가 업무 규칙 위반으로 던지는 코드
export const DOMAIN_ERROR_CODES = [...PROJECT_ERROR_CODES, ...ISSUE_ERROR_CODES] as const;
export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];
