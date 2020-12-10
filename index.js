const { argv } = require('yargs');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');
const webpack = require('webpack');
const { merge } = require('webpack-merge');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const cssClassUnique = require('./utils/cssClassUniqueSmall');
const getLoaders = require('./loaders');

let mode = 'production';
if (process.env.NODE_ENV) {
    mode = process.env.NODE_ENV;
} else if (argv.mode) {
    mode = argv.mode;
} else if (process.env.WEBPACK_SERVE) {
    mode = 'development';
}

const shouldUseSourceMap = process.env.sourceMap === 'true';
const publicPath = process.env.publicPath || '/dist/';
const assetsFolder = 'prod';

const IS_DEV = mode === 'development';

const { cssExtractLoader, cssLoader, lessLoader, postCssLoader } = getLoaders({
    sourceMap: shouldUseSourceMap, hmr: IS_DEV
});

if (argv.verbose) {
    console.log('Working directory:', process.cwd());
    console.log('Public Path:', publicPath);
    console.log('Mode:', mode);
}

const baseConfig = {
    mode,
    output: {
        filename: '[name].bundle.js',
        chunkFilename: '[name].[chunkhash].chunk.js',
        path: path.resolve(process.cwd(), 'dist')
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.json', '.css', '.less'],
        modules: [
            'node_modules'
        ]
    },
    module: {
        strictExportPresence: true,
        rules: [
            {
                parser: { requireEnsure: false },
            },
            {
                test: /\.js(x?)$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: require.resolve('babel-loader'),
                        options: {
                            babelrc: true,
                            cacheDirectory: true,
                        },
                    },
                ],
            },
            {
                test: /\.ts(x?)$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: require.resolve('babel-loader'),
                        options: {
                            babelrc: true,
                            cacheDirectory: true,
                        },
                    },
                    {
                        loader: require.resolve('ts-loader'),
                        options: {
                            configFile: IS_DEV ? require('tsconfig.dev.json') : require('tsconfig.prod.json'),
                        }
                    }
                ]
            },
            {
                test: /\.css$/,
                use: [
                    IS_DEV ? require.resolve('style-loader') : cssExtractLoader,
                    cssLoader,
                    postCssLoader
                ]
            },
            {
                // just less
                test: /\.less$/,
                exclude: /\.m\.less$/,
                use: [
                    IS_DEV ? require.resolve('style-loader') : cssExtractLoader,
                    cssLoader,
                    postCssLoader,
                    lessLoader
                ]
            },
            {
                // CSS modules
                test: /\.m\.less$/,
                use: [
                    IS_DEV ? require.resolve('style-loader') : cssExtractLoader,
                    {
                        loader: require.resolve('css-loader'),
                        options: {
                            sourceMap: IS_DEV,
                            modules: {
                                mode: 'local',
                                ...(
                                    IS_DEV
                                    ? { localIdentName: '[path]_[name]_[local]--[hash:base64:3]' }
                                    : { getLocalIdent: (context, localIdentName, localName) => cssClassUnique(localName, context.resourcePath) }
                                )
                            },
                            importLoaders: 2
                        }
                    },
                    postCssLoader,
                    lessLoader
                ]
            },
            {
                test: /\.(ttf|eot|woff|woff2)$/,
                use: {
                    loader: require.resolve('file-loader'),
                    options: {
                        name: path.join(assetsFolder, 'fonts', '/[name].[ext]'),
                    },
                },
            },
            {
                test: /\.(gif|png|jpe?g|(?!inline\.)svg)$/i,
                exclude: /\.inline.svg$/,
                use: [
                    {
                        loader: require.resolve('file-loader'),
                        options: {
                            name: path.join(assetsFolder, 'img', '[name].[ext]'),
                        },
                    },
                    {
                        loader: require.resolve('image-webpack-loader'),
                        options: {
                            mozjpeg: {
                                progressive: true,
                                quality: 65
                            },
                            optipng: {
                                enabled: true,
                            },
                            pngquant: {
                                quality: [0.65, 0.90],
                                speed: 4
                            },
                            gifsicle: {
                                interlaced: false,
                            },
                            // the webp option will enable WEBP
                            webp: {
                                quality: 75
                            }
                        }
                    },
                ],
            },
            {
                test: /\.inline.svg$/,
                use: '@svgr/webpack',
            },

        ],
    },

    plugins: [
        new MiniCssExtractPlugin({
            filename: path.join(assetsFolder, 'css', '[name].css'),
            chunkFilename: path.join(assetsFolder, 'css', '[id].css')
        }),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(mode),
            PRODUCTION: JSON.stringify(!IS_DEV),
            NODE_ENV: JSON.stringify(process.env.NODE_ENV)
        }),
    ]
};

if (mode === 'development') {
    baseConfig.serve = {
        logLevel: 'error',

        hot: true,

        devMiddleware: {
            get publicPath() { return baseConfig.output.publicPath; },
            set publicPath(val) {
                throw new Error('serve.devMiddleware.publicPath is immutable. Please modify "output.publicPath" instead.');
            },
        },
    };

    // You may want 'eval' instead if you prefer to see the compiled output in DevTools.
    baseConfig.devtool = 'cheap-module-source-map';

    // Add module names to factory functions so they appear in browser profiler.
    baseConfig.plugins.push(new webpack.NamedModulesPlugin());
}

if (mode === 'production') {
    // Generate a report on the bundle
    baseConfig.plugins.push(new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        reportFilename: process.env.REPORT_PATH || 'reports/webpack-report.html',
        openAnalyzer: false,
    }));
}

const mergeConfig = (a, b) => merge(a, (typeof b === 'function') ? b({ mode, legacyBack: false }) : b);

const createConfig = userConfig => mergeConfig(baseConfig, userConfig);

module.exports = {
    baseConfig,
    createConfig,
    mergeConfig,
};
