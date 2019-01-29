const path = require("path");
const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')

const resolveDir = dir => '../../' + dir

module.exports = {
	mode: process.env.NODE_ENV === 'production' ? "production" : "development",
  devtool: 'none',
	entry: {
		app: ['webpack-hot-middleware/client', "./src/app/index.js"]
	},
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
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
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  }
}