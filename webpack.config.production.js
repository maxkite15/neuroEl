var config = require('./webpack.config.development.js');
config.entry.shift();
config.plugins.shift();
config.output.publicPath = 'http://127.0.0.1:8180/dist/';
module.exports = config;