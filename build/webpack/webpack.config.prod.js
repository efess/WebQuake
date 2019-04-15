const base = require('./webpack.config')
const merge = require('webpack-merge')

module.exports = merge({
  devtool: 'none',
  entry: {
    app: [ "./src/app/web/index.js"]
  },
  plugins: [
  ]
}, base)