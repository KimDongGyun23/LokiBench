// service와 저장소가 업무 규칙 위반으로 던지는 코드
export const DOMAIN_ERROR_CODES = ['PROJECT_NOT_FOUND', 'PROJECT_NAME_TAKEN'] as const;
export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];
