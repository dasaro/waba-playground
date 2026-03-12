import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: [
            'backup-cytoscape/**',
            'clingo.*',
            'dist/**',
            'waba-modules.js',
            'app.js.old',
            'app.js.backup'
        ]
    },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                clingo: 'readonly',
                Module: 'writable',
                Prism: 'readonly',
                vis: 'readonly',
                jspdf: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'no-console': 'off'
        }
    },
    {
        files: ['scripts/**/*.js', 'tests/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.node
            }
        }
    }
];
