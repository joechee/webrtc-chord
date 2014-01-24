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


var RTCRequestCallbacks = {};

server.listen(process.env.PORT || 8080);


var Random = function () {};
Random.generate = function () {
	return Math.floor(Math.random() * 1000000000);
};


  function Request(connection, data) {
    this.connection = connection;
    this.data = data.data;
    this.requestID = data.requestID;
    this.from = data.from;
    this.recipient = data.recipient; // Should be server
  }


  Request.prototype.respond = function (msg) {
  	msg.type = "response";
  	msg.requestID = this.requestID;
  	this.connection.send(JSON.stringify(msg));
  };




webSocketServer.on('connection', function (connection) {
	console.log("client connected");

	connection.on('message', function (msg) {
		msg = JSON.parse(msg);

		if (msg.recipient === "server") {
			switch (msg.type) {
				case "request":
					handleRequest(new Request(connection, msg));
					break;
				case "response":
					RTCRequestCallbacks[msg.responseID](msg);
					break;
				case "identity":
					connections[msg.from] = connection;
					connection.id = msg.from;
					break;
				default:
					console.error("Unrecognised msg type: " + msg.type);
			}
		} else {
			// Forward the msg
			if (connections[msg.recipient]) {
				connections[msg.recipient].send(JSON.stringify(msg));
			} else {
				console.log(msg.recipient);
				console.log("recipient does not exist!");
				// Does not exist!
			}
		}
		
	});
	connection.on('close', function () {
		delete connections[connection.id];
	});
});

function handleCmdMessage(request) {
	switch (request.data.cmd) {
		case "getRandomPeer":
			handleGetRandomPeerCommand(request);
			break;
		default:
			console.log("Unrecognised command: " + msg.cmd);
	}
}

function handleRequest(request) {
	switch (request.data.type) {
		case "command":
			handleCmdMessage(request);
			break;
		default:
			throw new Error("Unknown request type: " + request.data.type);
	}
}

function makeAnswerRequest(request) {
	var recipient = request.recipient;
	var sender = request.from;
	var msg = request.data;
	var answer = {
		data: msg,
		from: sender,
		requestID: request.requestID,
		type: "request"
	};



	RTCRequestCallbacks[requestID] = function (data) {
		request.respond(data);
	};
	connections[recipient].send(JSON.stringify(answer));

}

function handleGetRandomPeerCommand(request) {
	var response = {
		data: {
			peer: getRandomPeer(request.connection)
		}
	};
	request.respond(response);
}

function getRandomPeer(connection) {
	// This picks a random element in one pass out of all the elements in the dictionary
	var counter = 0;
	var peer = undefined;
	for (var id in connections) {
		if (connection === connections[id]) {
			continue; // Don't pick yourself
		}
		if (Math.random() > (counter / (counter + 1))) {
			peer = id;
		} else {
			counter++;
		}
	}
	return peer;
}

console.log("Server started");

