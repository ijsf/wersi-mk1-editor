const path = require('path');
const webpack = require('webpack');

module.exports = {
  devtool: 'eval',
  entry: [
    'webpack-dev-server/client?http://localhost:3000',
    'webpack/hot/only-dev-server',
    'babel-polyfill',
    './src/index'
  ],
  output: {
    path: path.join(__dirname, 'dist-dev'),
    filename: 'bundle.js',
    publicPath: '/'
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin()
  ],
  module: {
    loaders: [
      {
        test: /\.js$/,
        loaders: ['react-hot-loader', 'babel-loader'],
        include: path.join(__dirname, 'src')
      },
      {
        test: /\.css$/,
        loader: 'style-loader!css-loader',
      },
      {
          test: /\.(eot|woff(2)?|ttf|svg|png|jpg)(\?v=\d+\.\d+\.\d+)?$/,
          loader: 'url-loader?limit=30000&name=[name]-[hash].[ext]'
      }
    ]
  },
  resolve: {
    alias: {
      'components': path.join(__dirname, 'src', 'components'),
      'stores': path.join(__dirname, 'src', 'modules/**/stores'),
      'modules': path.join(__dirname, 'src', 'modules')
    }
  }
};
