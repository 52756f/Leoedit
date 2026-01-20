import { defineConfig } from 'vite';

export default defineConfig({
    resolve: {
        dedupe: [
            '@codemirror/state',
            '@codemirror/view',
            '@codemirror/commands',
            '@codemirror/language',
            '@codemirror/search',
            '@codemirror/lang-javascript',
            '@codemirror/lang-markdown',
            '@codemirror/lang-html',
            '@codemirror/lang-css'
        ]
    }
});
