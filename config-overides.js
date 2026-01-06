const webpack = require('webpack');

module.exports = function override(config) {
    config.resolve.fallback = {
        ...config.resolve.fallback,
        "buffer": require.resolve("buffer/"),
        "stream": require.resolve("stream-browserify"),
        "events": require.resolve("events/"),
        "fs": false,
        "path": false,
        "os": false,
        "child_process": false,
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        "crypto": require.resolve("crypto-browserify"),
        "util": require.resolve("util/"),
        "url": require.resolve("url/"),
        "assert": require.resolve("assert/"),
        "net": false,
        "tls": false,
        "zlib": require.resolve("browserify-zlib"),
        "querystring": require.resolve("querystring-es3"),
        "process": require.resolve("process/browser"),
        "async_hooks": false,
        "vm": false,
        "http2": false,
        "./framer": false,
        "dns": false
    };

    // Handle process/browser issue
    config.resolve = {
        ...config.resolve,
        alias: {
            ...config.resolve.alias,
            'process/browser': 'process/browser.js',
            // Add mock for async_hooks
            'async_hooks': require.resolve('./src/mocks/async-hooks-mock.js')
        },
        extensionAlias: {
            ...config.resolve.extensionAlias,
            '.js': ['.js', '.ts', '.tsx']
        }
    };

    config.plugins = [
        ...config.plugins,
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
            process: 'process/browser.js'
        }),
        new webpack.NormalModuleReplacementPlugin(
            /node:.*/, (resource) => {
                const mod = resource.request.replace(/^node:/, '');
                switch (mod) {
                    case 'buffer':
                        resource.request = 'buffer';
                        break;
                    case 'stream':
                        resource.request = 'stream-browserify';
                        break;
                    case 'util':
                        resource.request = 'util';
                        break;
                    case 'events':
                        resource.request = 'events';
                        break;
                    default:
                        break;
                }
            }
        ),
        new webpack.NormalModuleReplacementPlugin(
            /http2/, (resource) => {
                resource.request = 'stream-http';
            }
        ),
        // Add replacement for async_hooks
        new webpack.NormalModuleReplacementPlugin(
            /async_hooks/, (resource) => {
                resource.request = require.resolve('./src/mocks/async-hooks-mock.js');
            }
        )
    ];

    return config;
}