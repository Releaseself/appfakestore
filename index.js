require('dotenv').config();

var app = require('vbase');
app.options.root = __dirname;

global.logger = app.logger;

app.start();