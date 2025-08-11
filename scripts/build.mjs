import esbuild from 'esbuild';
import path from 'path';

const buildOptions = {
    entryPoints: {
        'bundle': 'assets/js/app.js',
        'style': 'assets/css/main.css'
    },
    bundle: true,
    outdir: 'assets',
    loader: {
        '.woff': 'file',
        '.woff2': 'file',
        '.ttf': 'file',
        '.eot': 'file',
        '.svg': 'file'
    },
    logLevel: 'info'
};

esbuild.build(buildOptions).catch(() => process.exit(1));
