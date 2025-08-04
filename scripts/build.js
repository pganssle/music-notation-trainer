const esbuild = require('esbuild');
const path = require('path');

const buildOptions = {
    entryPoints: {
        'app': 'assets/js/app.js',
        'style': 'assets/css/main.css'
    },
    bundle: true,
    outdir: 'assets/dist',
    loader: {
        '.woff': 'file',
        '.woff2': 'file',
        '.ttf': 'file',
        '.eot': 'file',
        '.svg': 'file'
    },
    logLevel: 'info',
    resolveExtensions: ['.js', '.css'],
    nodePaths: ['node_modules']
};

esbuild.build(buildOptions).catch(() => process.exit(1));
