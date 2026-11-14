import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const NO_FC_IMPORT = {
  name: 'react',
  importNames: ['FC', 'FunctionComponent'],
  message: 'Props interface를 인자에 직접 붙임 (code-convention)',
};

// web 폴더 방향: app -> screens -> domains -> components, lib. 같은 층끼리는 가져오지 않음
// 한 화면, 한 도메인 폴더 안은 ./ 로만 가져오고, 다른 폴더는 @/ 경로로 가져와야 규칙이 걸림
// import()는 이 규칙이 검사하지 않으므로 지연 로딩은 맨 위 층인 app/에서만 함
function webLayerRule(patterns) {
  return ['error', { paths: [NO_FC_IMPORT], patterns }];
}

const NO_PARENT_RELATIVE = {
  regex: '^(\\./)*\\.\\./',
  message: '다른 폴더는 @/ 경로로 가져옴 (방향 규칙 검사용)',
};

export default defineConfig(
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/.turbo/',
      '**/coverage/',
      'docs/',
      '.superpowers/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      // code-convention: 타입 단언 대신 타입 가드 (as const는 허용됨)
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // code-convention: 컴포넌트에 FC 타입을 쓰지 않음
      'no-restricted-imports': [
        'error',
        {
          paths: [NO_FC_IMPORT],
        },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      // Nest 모듈은 데코레이터만 있는 빈 클래스
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  {
    // 3층 분리: 계약(HTTP 모양)은 컨트롤러와 응답 변환만 알고, service와 저장소는 도메인 타입만 씀
    files: ['apps/api/src/modules/**/*.ts'],
    ignores: ['**/*.controller.ts', '**/*.mapper.ts', '**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@lokibench/contracts',
              message:
                '도메인 타입은 같은 모듈의 *.model.ts에서 가져오고, 계약 변환은 컨트롤러와 *.mapper.ts에서 함',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
    rules: {
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  {
    files: ['apps/web/src/screens/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': webLayerRule([
        {
          regex: '^@/(app|screens)(/|$)',
          message: '화면은 도메인과 공용만 가져옴. 두 화면이 함께 쓰면 domains나 components로 내림',
        },
        NO_PARENT_RELATIVE,
      ]),
    },
  },
  {
    files: ['apps/web/src/domains/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': webLayerRule([
        {
          regex: '^@/(app|screens|domains)(/|$)',
          message: '도메인은 공용만 가져옴. 다른 도메인과 합치는 일은 화면에서 함',
        },
        NO_PARENT_RELATIVE,
      ]),
    },
  },
  {
    files: ['apps/web/src/{components,lib}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': webLayerRule([
        {
          regex: '^(@/|(\\./)*(\\.\\./)+)(app|screens|domains)(/|$)',
          message: '공용 코드는 도메인과 화면을 모름',
        },
      ]),
    },
  },
  prettier,
);
