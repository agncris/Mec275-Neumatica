// ESLint mínimo: solo lo que ya dio problemas. Los `catch` vacíos son error (llevan un
// comentario que dice por qué se ignoran, o avisan al usuario). Las reglas de hooks
// van como aviso: cambiar las dependencias de un efecto cambia cómo se comporta.
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist/**', 'salida/**', 'node_modules/**', 'public/**'] },
  {
    files: ['src/**/*.{ts,tsx}', 'api/**/*.js', 'server.js', 'vite.config.ts', 'eslint.config.js'],
    languageOptions: { parser: tseslint.parser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'no-empty': 'error',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
)
