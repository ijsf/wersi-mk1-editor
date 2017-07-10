const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: [
    'babel-polyfill',
    './src/index'
  ],
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/'
  },
  devtool: 'source-map',
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      sourceMap: true,
      comments: false,
      mangle: {
        // Fix for rickshaw: https://github.com/shutterstock/rickshaw/issues/368
        except: ['$super', '$', 'exports', 'require']
      }
    })
  ],
  module: {
    loaders: [
      {
        test: /\.js$/,
        loaders: ['babel-loader'],
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
