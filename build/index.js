require('dotenv').config()
const webpack = require('webpack')
const webpackProd = require('./webpack/webpack.config.prod')
const webpackTest = require('./webpack/webpack.config.test')
const chalk = require('chalk')

console.log(process.env.NODE_ENV)
const webpackConf = process.env.NODE_ENV === 'production'
  ? webpackProd
  : webpackTest

webpack(webpackConf, (err, stats) => {
  if (err) {
    throw err
  }

  process.stdout.write(stats.toString({
    colors: true,
    modules: false,
    children: false,
    chunks: false,
    chunkModules: false
  }) + '\n\n')

  console.log(chalk.cyan('Build complete!'))
})
