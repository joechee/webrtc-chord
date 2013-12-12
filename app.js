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


var RNG = function () {};
RNG.generate = function () {
	return Math.floor(Math.random() * 1000000000);
};

webSocketServer.on('connection', function (connection) {
	console.log("client connected");
	connection.id = connectionIDCounter++;
	connections[connection.id] = connection;

	connection.on('message', function (msg) {
		msg = JSON.parse(msg);
		switch (msg.type) {
			case "request":
				handleRequest(connection, msg.requestID, msg.data);
				break;
			case "response":
				RTCRequestCallbacks[msg.responseID](msg);
				break;
			default:
				console.error("Unrecognised msg type: " + msg.type);
		}
	});
	connection.on('close', function () {
		delete connections[connection.id];
	});
});

function handleCmdMessage(connection, requestID, msg) {
	switch (msg.cmd) {
		case "getPeers":
			handleGetPeersCommand(connection, requestID, msg);
			break;
		default:
			console.log("Unrecognised command: " + msg.cmd);
	}
}

function handleRequest(connection, requestID, msg) {
	switch (msg.type) {
		case "RTCMessage":
			handleRTCRequest(connection, requestID, msg.recipient, msg.data);
			break;
		case "cmd":
			handleCmdMessage(connection, requestID, msg);
			break;
		default:
			throw new Error("Unknown request type: " + msg.data.type);
	}
}

function handleRTCRequest(connection, requestID, recipient, msg) {
	var senderID = connection.id;
	switch (msg.type) {
		case "offer":
			makeAnswerRequest(senderID, recipient, msg, function (reply) {
				// TODO: Set up reply
				reply.requestID = requestID;
				delete reply['responseID'];
				connection.send(JSON.stringify(reply));
			});
			break;
		case "candidate":
			var reply = {
				candidate: msg.candidate,
				type: "candidate",
				from: senderID
			};
			connections[recipient].send(JSON.stringify(reply));

			break;
		default:
			throw new Error("Unknown msg type: " + msg.type);
	}
}


function makeAnswerRequest(sender, recipient, msg, callback) {
	var serverRequestID = RNG.generate();
	delete msg['requestID'];
	var answer = {
		from: sender,
		data: msg,
		serverRequestID: serverRequestID,
		type: "request"
	};

	RTCRequestCallbacks[serverRequestID] = callback;
	connections[recipient].send(JSON.stringify(answer));

}

function handleGetPeersCommand(connection, requestID, msg) {

	var response = {
		peers: [],
		requestID: requestID,
		type: "response"
	};

	for (var i in connections) {
		if (connections[i] !== connection) {
			response.peers.push(i);
		}
	}
	connection.send(JSON.stringify(response));
}

console.log("Server started");

