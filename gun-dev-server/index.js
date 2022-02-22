const GUN = require('gun');
const server = require('http').createServer().listen(8080);
const gun = GUN({web: server});