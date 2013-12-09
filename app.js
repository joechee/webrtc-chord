// This is essentially a broadcast server
// TODO: Support rooms


var ws = require('ws');
var express = require('express');
var http = require('http');
var app = express();

app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.static(__dirname + '/client'));
app.use(app.router);

var WebSocketServer = ws.Server;
var server = http.createServer(app);

var webSocketServer = new WebSocketServer({server: server});

server.listen(process.env.PORT || 8080);

webSocketServer.broadcast = function (client, msg) {
	for (var i in this.clients) {
		if (this.clients[i] !== client) {
			this.clients[i].send(msg);
		}
	}
};


webSocketServer.on('connection', function (connection) {
	console.log("client connected");
	connection.on('message', function (msg) {
		webSocketServer.broadcast(connection, msg);
	});
	connection.on('end', function (connection) {
		connections.splice(connections.indexOf(connection), 1);
	});
});

console.log("Server started");

