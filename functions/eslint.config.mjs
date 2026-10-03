import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      // The functions aren't strict TypeScript (see tsconfig.json); `any` is deliberate.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
