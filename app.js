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

var connections = {};
var connectionIDCounter = 0;

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
	connection.id = connectionIDCounter++;
	connections[connection.id] = connection;

	connection.on('message', function (msg) {
		msg = JSON.parse(msg);
		switch (msg.type) {
			case "RTCMessage":
				webSocketServer.broadcast(connection, JSON.stringify(msg));
				break;
			case "cmd":
				handleCmdMessage(connection, msg);
				break;
			default:
				console.error("Unrecognised msg type: ", msg.type);
		}
	});
	connection.on('close', function () {
		delete connections[connection.id];
	});
});

function handleCmdMessage(connection, msg) {
	switch (msg.cmd) {
		case "getClients":
			handleGetClientsCommand(connection, msg);
			break;
		default:
			console.log("Unrecognised command: ", msg.cmd);
	}
}

function handleGetClientsCommand(connection, msg) {
	var response = {
		clients: [],
		type: "getClientsResponse"
	};
	for (var i in connections) {
		if (connections[i] !== connection) {
			response.clients.push(i);
		}
	}
	connection.send(JSON.stringify(response));
}

console.log("Server started");

