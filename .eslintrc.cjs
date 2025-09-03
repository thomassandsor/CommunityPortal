module.exports = {
    root: true,
    env: { browser: true, es2020: true, node: true },
    extends: [
        'eslint:recommended',
        'plugin:react/recommended',
        'plugin:react/jsx-runtime',
        'plugin:react-hooks/recommended',
    ],
    ignorePatterns: ['dist', '.eslintrc.cjs'],
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    settings: { react: { version: '18.2' } },
    plugins: ['react-refresh'],
    rules: {
        'react-refresh/only-export-components': [
            'warn',
            { allowConstantExport: true },
        ],
        // Disable prop-types validation (we're using TypeScript patterns)
        'react/prop-types': 'off',
        // Allow unescaped entities in JSX (common in React)
        'react/no-unescaped-entities': 'off',
        // Allow lexical declarations in case blocks
        'no-case-declarations': 'off',
    },
}
