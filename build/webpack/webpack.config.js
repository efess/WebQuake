const path = require("path");
const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')
const { VueLoaderPlugin } = require('vue-loader')

const resolveDir = dir => '../../' + dir

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? "production" : "development",
  plugins: [
    new VueLoaderPlugin(),
    new HtmlWebpackPlugin({
      template: './src/app/index.html',
      title: 'Output Management'
    })
  ],
  output: {
    path: path.join(__dirname, resolveDir("dist/app")),
    filename: "[name].bundle.js",
    chunkFilename: "[id].chunk.js"
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ]
  },
  module: {
    rules: [
      {
        test: /\.scss$/,
        use: ['style-loader', 'css-loader','sass-loader']
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      }, 
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: [
          'vue-style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.pug$/,
        loader: 'pug-plain-loader'
      }
    ]
  }
}