import { setupServer } from 'msw/node';

/**
 * 테스트에서 api 서버를 대신하는 MSW 서버.
 *
 * - 실제 api를 띄우지 않고, fetch가 나간 뒤의 요청을 가로채 정해 둔 응답을 돌려준다
 * - 응답은 테스트마다 `server.use(http.get('/api/...', ...))`로 정한다
 * - 정하지 않은 요청은 실패로 처리하고, 테스트가 끝나면 정한 응답을 지운다 (setup.ts)
 */
export const server = setupServer();
