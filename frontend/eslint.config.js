import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';

// ESLint 最小構成（フラットコンフィグ）。TypeScript + Vue3。
export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        // .vue 内の <script lang="ts"> を TypeScript として解釈する。
        parser: tseslint.parser,
      },
    },
    rules: {
      // 単語1つのコンポーネント名（App など）を許可する。
      'vue/multi-word-component-names': 'off',
      // インライン SVG の属性を1行に書けるようにする（整形のみの規則）。
      'vue/max-attributes-per-line': 'off',
    },
  },
);
