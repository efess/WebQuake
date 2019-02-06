require('dotenv').config()
const path = require('path')
var express = require('express')
//var server = require('../src/server').default
var webpack = require('webpack')
var webpackConfig = require('./webpack/webpack.config')

var app = express()


var port = process.env.PORT || 8080
var compiler = webpack(webpackConfig)

var devMiddleware = require('webpack-dev-middleware')(compiler, {
  publicPath: webpackConfig.output.publicPath,
  quiet: true
})

app.use('/id1', express.static(path.join(__dirname, '../id1')))

compiler.hooks.afterEmit.tap('compilation', compilation => {
  console.log(compilation)
  hotMiddleware.publish({ action: 'reload' })
})

// // force page reload when html-webpack-plugin template changes
// compiler.plugin('compilation', function (compilation) {
//   compilation.plugin('html-webpack-plugin-after-emit', function (data, cb) {
//     console.log(data)
//     hotMiddleware.publish({ action: 'reload' })
//     cb()
//   })
// })


// serve webpack bundle output
app.use(devMiddleware)

// enable hot-reload and state-preserving
// compilation error display

var hotMiddleware = require('webpack-hot-middleware')(compiler, {
  log: () => {}
})
app.use(hotMiddleware)

var uri = 'http://localhost:' + port

var readyPromise = new Promise((resolve, _reject) => {
  console.log('> Starting dev server...')
  devMiddleware.waitUntilValid(() => {
    console.log('> Listening at ' + uri + '\n')
    resolve('listening')
  })
})

//server(app)

var actualServer = app.listen(port, '0.0.0.0')
module.exports = {
  ready: readyPromise,
  close: () => {
    actualServer.close()
  }
}
