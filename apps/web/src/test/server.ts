import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/**
 * 테스트에서 api 서버를 대신하는 MSW 서버.
 *
 * - 실제 api를 띄우지 않고, fetch가 나간 뒤의 요청을 가로채 정해 둔 응답을 돌려준다
 * - 응답은 테스트마다 `server.use(http.get('/api/...', ...))`로 정한다
 * - 정하지 않은 요청은 실패로 처리하고, 테스트가 끝나면 정한 응답을 지운다 (setup.ts)
 * - 프로젝트 표가 늘 함께 부르는 열린 이슈 수는 기본으로 빈 목록을 준다 (테스트가 정하면 그 응답이 먼저)
 */
export const server = setupServer(http.get('/api/issues/open-counts', () => HttpResponse.json([])));
