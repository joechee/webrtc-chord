// TODO: Clean up some of the closures to make code more functional and easier to read.

var INT32_MAX = 2147483647;

var hostname = location.origin.replace(/^http/, 'ws');

var IS_CHROME = !!window.webkitRTCPeerConnection,
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription;

if (IS_CHROME) {
  RTCPeerConnection = webkitRTCPeerConnection;
  RTCIceCandidate = window.RTCIceCandidate;
  RTCSessionDescription = window.RTCSessionDescription;
} else {
  RTCPeerConnection = mozRTCPeerConnection;
  RTCIceCandidate = mozRTCIceCandidate;
  RTCSessionDescription = mozRTCSessionDescription;
}

(function (window) {

	var RTCConfig = {
		iceServers: [
			{ 
				'url': 'stun:23.21.150.121'// (IS_CHROME ? 'stun:stun.l.google.com:19302' : 'stun:23.21.150.121')
			}
		]
	};

	var hostname = location.origin.replace(/^http/, 'ws');




	/* 

	Coordinator object

	Coordinates the connections between nodes within the mesh

	Events:
	onconnected: Raised when it is connected to the mesh

	*/
	var Coordinator = function () {
		var thisCoordinator = this;

		this.peers = {}; 
		this.webSocketConnection = new WebSocket(hostname);
		this.webSocketConnection.messageBuffer = [];

		window.onbeforeunload = function() {
	    	thisCoordinator.webSocketConnection.close();
		};

		this.requestCallbacks = {};
		// TODO: Some mechanism to detect requests that don't get
		// 		 a response

		var cleanupCallbacks = function () {
			var cleanThreshold = new Date() - 5000;
			for (var request in thisCoordinator.requestCallbacks) {
				if (thisCoordinator.requestCallbacks[request].timestamp < cleanThreshold) {
					delete thisCoordinator.requestCallbacks[request];
				}
			}

			for (var peer in thisCoordinator.peers) {
				var requestCallbacks = thisCoordinator.peers[peer].requestCallbacks;
				for (var request in requestCallbacks) {
					if (requestCallbacks[request].timestamp < cleanThreshold) {
						delete requestCallbacks[request];
					}
				}
			}
		};

		setInterval(cleanupCallbacks, 500);


		this.webSocketConnection.onmessage = function (response) {
			var data = response.data;
			var msg = JSON.parse(data);


			switch (msg.type) {
				case "response":
					var callback = thisCoordinator.requestCallbacks[msg.requestID].callback;
					callback(msg);
					break;
				case "request":
					var serverRequestID = msg.serverRequestID;
					handleRequest(serverRequestID, msg.from, msg.data);
					break;
				case "candidate":
					handleCandidate(msg.from, msg.candidate);
					break;
				case "identity":
					handleIdentity(msg.identity);
					break;
				default:
					throw new Error("Unrecognised Message Type: ", msg.type);
			}
		}

		function handleRequest(serverRequestID, from, msg) {
			switch (msg.type) {
				case "offer":
					handleOffer(serverRequestID, from, msg);
					break;
				case "answer":
					throw new Error("An answer is not supposed to be handled in this function!");
				default:
					throw new Error("Unrecognised data type in handleRequest: ", msg.type);
			}
		}

		function handleOffer(serverRequestID, from, msg) {
			var currentPeer;
			if (thisCoordinator.peers[from] !== undefined) {
				currentPeer = thisCoordinator.peers[from];
			} else {
				currentPeer = new Peer(thisCoordinator, from);
			}

			currentPeer._generateAnswer(msg, function (description) {
				thisCoordinator._respondToServer(serverRequestID, description);
			});
		}

		function handleCandidate(senderID, candidate) {
			if (thisCoordinator.peers[senderID]) {
				thisCoordinator.peers[senderID].connection.addIceCandidate(new RTCIceCandidate(candidate));
			} else {
				// Need to somehow buffer candidates
				throw new Error("Peer object not created yet!");
			}

		}

		function handleIdentity(identity) {
			thisCoordinator.id = identity;
		}


		this.webSocketConnection.onopen = function () {
			thisCoordinator.webSocketConnection.messageBuffer.map(function (msg) {
				thisCoordinator.webSocketConnection.send(msg);
			});
		};

		this.getRandomPeer(function (peer) {
			thisCoordinator.fingerTable = new FingerTable();
			thisCoordinator.fingerTable.init();
			if (peer) {
				var newPeer = new Peer(thisCoordinator, peer);
				thisCoordinator.fingerTable.onready = function () {
					thisCoordinator.onconnected(this);
				};
			} else {
				// I am the only peer!
				if (thisCoordinator.onconnected) {
					thisCoordinator.onconnected(this);
				}
			}
			
		});
	};

	Coordinator.prototype.close = function () {
		for (var peer in this.peers) {
			this.peers[peer].close();
		}
		this.webSocketConnection.close();
	};

	Coordinator.prototype.getRandomPeer = function (callback) {
		this._requestFromServer({
			type: "cmd",
			cmd: "getRandomPeer"
		}, function (response) {
			callback(response.peer);
		});
	};

	Coordinator.prototype.request = function (msg, callback) {
		if (typeof msg !== "object") {
			throw new Error("Unable to send strings over to the server. Please send JSON requests");
		} 

		var request = {
			data: msg,
			requestID: Random.generate(),
			type: "request"
		};

		this.requestCallbacks[request.requestID] = {
			callback: callback,
			timestamp: new Date()
		};

		request = JSON.stringify(request);

		// If webSocketConnection is not ready,
		// buffer the message and wait for ready before
		// sending

		if (this.webSocketConnection.readyState === 0) {
			this.webSocketConnection.messageBuffer.push(request);
		} else {
			this.webSocketConnection.send(request);
		}

	};

	Coordinator.prototype._respondToServer = function (serverRequestID, msg) {
		if (typeof msg !== "object") {
			throw new Error("Unable to send strings over to the server. Please send JSON requests");
		}

		var response = {
			data: msg,
			responseID: serverRequestID,
			type: "response"
		};

		response = JSON.stringify(response);

		// If webSocketConnection is not ready,
		// buffer the message and wait for ready before
		// sending (Shouldn't happen in this case since
		// a request has to be send before a response can
		// be made, but maybe might want to do some buffering

		if (this.webSocketConnection.readyState === 0) {
			this.webSocketConnection.messageBuffer.push(response);
		} else {
			this.webSocketConnection.send(response);
		}

	};


	Coordinator.prototype.sendRTCMessage = function (msg) {

	};

	Coordinator.prototype.sendRTCRequest = function (msg) {

		if (typeof msg !== "object") {
			throw new Error("Unable to send strings over to the server. Please send JSON requests");
		} 

		var request = {
			data: msg,
			requestID: Random.generate(),
			type: "RTCRequest"
		};

		this.requestCallbacks[request.requestID] = {
			callback: callback,
			timestamp: new Date()
		};

		request = JSON.stringify(request);

		// If webSocketConnection is not ready,
		// buffer the message and wait for ready before
		// sending

		if (this.webSocketConnection.readyState === 0) {
			this.webSocketConnection.messageBuffer.push(request);
		} else {
			this.webSocketConnection.send(request);
		}
	};

	var Peer = function (transport, id) {
		this.transport = transport;
		this.connection = new RTCPeerConnection(RTCConfig);
		this.id = id;
		this.messageBuffer = [];

		this.requestCallbacks = {};


		var thisPeer = this;
		this.connection.ondatachannel = function (event) {
			var dataChannel = event.channel;
			thisPeer.dataChannel = dataChannel;
			setupDataChannel(thisPeer, dataChannel);
		};

		// Cleanup connections
		var interval = setInterval(function () {
			if (thisPeer.connection.iceConnectionState === "closed" || thisPeer.connection.iceConnectionState === "disconnected") {
				thisPeer.dead = true;
				clearInterval(interval);
			}
		}, 1000);

		this.connection.onclose = function (event) {
			thisPeer.dead = true;
			clearInterval(interval);
		};

		this.connection.onopen = function (event) {
			for (var i = 0; i < thisPeer.messageBuffer.length; i++) {
				this.dataChannel.send(thisPeer.messageBuffer[i]);
			}
		};
	};

	Peer.prototype.close = function () {
		this.connection.close();
	};

	Peer.prototype._initiateConnection = function () {

		var thisPeer = this;

		this.dataChannel = this.connection.createDataChannel(this.id, (IS_CHROME ? {reliable: true} : {}));

		setupDataChannel(thisPeer, this.dataChannel);

		this.dataChannel.onopen = function () {
			thisPeer.messageBuffer.map(function (msg) {
				// Some bugs with sending from dataChannel
				setTimeout(function () {
					thisPeer.dataChannel.send(msg);
				}, 10);
			});
			

			thisPeer.messageBuffer = [];
			if (thisPeer.onready) {
				thisPeer.onready(thisPeer);
				delete thisPeer.onready;
			}
		};

		this.connection.createOffer(function (description) {
			thisPeer.connection.setLocalDescription(description);
			thisPeer._sendRTCMessage(thisPeer.id, description, function (response) {
				var description = response.data;
				thisPeer.connection.setRemoteDescription(new RTCSessionDescription(description));
			});
		}, function () {});

		this.connection.onicecandidate = function (event) {
		    if (!event || !event.candidate) {
		    	return;	
		    } else {
		    	thisPeer._sendRTCMessage(thisPeer.id, {
		    		candidate: event.candidate,
		    		from: thisPeer.parent.id,
		    		type: "candidate",
		    		recipient: thisPeer.id
		    	});
		    }
		};
	};

	Peer.prototype._sendRTCMessage = function (id, description, callback) {
		this.transport.sendRTCmessage({
			recipient: recipient,
			from: this.id,
			data: msg,
			type: "RTCMessage"
		}, callback);
	};

	Peer.prototype._sendRTCRequest = function (msg, callback) {
		if (typeof msg !== "object") {
			throw new Error("Unable to send strings over to the server. Please send JSON requests");
		} 

		var request = {
			data: msg,
			requestID: Random.generate(),
			type: "RTCRequest"
		};

		this.requestCallbacks[request.requestID] = {
			callback: callback,
			timestamp: new Date()
		};

		request = JSON.stringify(request);

		// If webSocketConnection is not ready,
		// buffer the message and wait for ready before
		// sending

		if (this.webSocketConnection.readyState === 0) {
			this.webSocketConnection.messageBuffer.push(request);
		} else {
			this.webSocketConnection.send(request);
		}



		this.transport.sendRTCRequest({
			recipient: recipient,
			from: this.
		});

	};

	Peer.prototype._generateAnswer = function (offerDescription, callback) {
		var thisConnection = this.connection;
		var thisPeer = this;

		this.connection.setRemoteDescription(new RTCSessionDescription(offerDescription));
		this.connection.createAnswer(function (description) {
			thisConnection.setLocalDescription(description);
			callback(description);
		}, function () {});

		this.connection.onicecandidate = function (event) {
		    if (!event || !event.candidate) {
		    	return;	
		    } else {
		    	thisPeer.transport.sendRTCMessage(thisPeer.id, {
		    		candidate: event.candidate,
		    		from: thisPeer.parent.id,
		    		type: "candidate",
		    		recipient: thisPeer.id
		    	});
		    }
		};
	};

	Peer.prototype.send = function (msg) {
		if (!this.dataChannel || this.dataChannel.readyState === "connecting") {
			this.messageBuffer.push(msg);
			// Buffer message?
		} else {

			// TODO: Remove delay that partially works around this bug
			// https://code.google.com/p/webrtc/issues/detail?id=2406
			var thisPeer = this;
			setTimeout(function () {
				var workaround = function () {
					this.dataChannel.send(msg);
				};
				workaround.call(thisPeer);
			}, 0);
		}
	};


	// Provide request-response functionality
	// Msg must be in JSON
	Peer.prototype.request = function (msg, callback) {
		msg.type = "request";
		msg.requestID = Random.generate();

		this.requestCallbacks[msg.requestID] = {
			callback: callback,
			timestamp: new Date()
		};
		this.send(JSON.stringify(msg));
	};

	Peer.prototype.respond = function (msg, requestID) {
		msg.type = "response";
		msg.responseID = requestID;
		this.send(JSON.stringify(msg));
	};


	function Request(transport, data, requestID) {
		this.transport = transport;
		this.data = data;
		this.requestID = requestID;
		this.from = data.from;
		this.recipient = data.recipient;
	}


	Request.prototype.respond = function (msg) {
		this.transport.respond(this.from, msg, this.requestID);
	};


	function setupDataChannel(thisPeer, dataChannel) {
		dataChannel.onmessage = function (event) {
			messageDispatcher(thisPeer, event);
		};

		dataChannel.onerror = function (event) {
			console.log(event);
		};
	}

	/* 

	Dispatches the message after it has been received through the WebRTC channel

	*/

	function messageDispatcher(peer, event) {
		var data = event.data;
		try {
			data = JSON.parse(data);
		} catch (e) {
			;
		}

		if (typeof(data) === "object") {
			switch(data.type) {
				case "response":
					if (peer.requestCallbacks[data.responseID]) {
						var callback = peer.requestCallbacks[data.responseID].callback;
						callback(data);
					} else {
						throw new Error("Response received after timeout");
					}
					delete peer.requestCallbacks[data.responseID];
					break;
				case "request":
					if (peer.transport.onrequest) {
						peer.transport.onrequest(new Request(peer, data, data.requestID));
					}
					break;
				case "RTCMessage":
					handleRTCRequest(new Request(peer, data, data.requestID));
					break;
				default:
					throw new Error("Unable to handle message type: " + data.type);
					break;
			}	
		} else {
			if (peer.transport.onmessage) {
				peer.transport.onmessage(peer.id, data);
			}
		}
	}

	function handleRTCRequest(request) {
		if (!(request instanceof Request)) {
			throw new Error("request is not a Request!");
		}

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



	function FingerTable() {}

	FingerTable.prototype.init = function (parent, transport) {
		this.table = {};
		this.parent = parent;
		this.transport = transport;
	};

	FingerTable.prototype.addPeer = function (peer) {
		this.table[peer.id] = peer;
	};

	/* Invokes the find successor protocol */

	function forwardDistance(a, b) {
		if (!a || !b) {
			return INT32_MAX;
		}
		var distance = b - a;
		if (distance =< 0) {
			distance += INT32_MAX + 1;
		}
		return distance;
	}

	FingerTable.prototype.sendMessage = function (msg, callback) {
		var closestPeer;

		var id = msg.recipient;
		for (var peer in this.table) {
			if (forwardDistance(closestPeer, id) > forwardDistance(peer, id)) {
				closestPeer = peer;
			}
		}

		if (closestPeer === this.parent.id) {
			// At this point in time, this is going to be the closest predecessor one can find
			// Check if relative
			if (msg.relative === "successor") {
				callback(this, msg);
			} else if (msg.relative === "predecessor") {
				// Handle message
				callback(this, msg);
			} else {
				callback(undefined, msg);
			}
		} else {
			// Make a request to another peer to find successor
			closestPeer.message(msg);
		}
	};

	FingerTable.prototype.receiveMessage = function (msg) {
		switch (msg.type) {
			case "RTCMessage":
				if (msg.recipient === this.parent.id) {
					this.handleRTCMessage(msg);
				} else {
					this.forwardMessage(msg);
				}
				break;
			case "message":
				if (msg.recipient === this.parent.id) {
					this.handleMessage(msg);
				} else {
					this.forwardMessage(msg);
				}
				break;		
			default:
				throw new Error("Unrecognised message type: " + msg.type);
				break;

		}
	};

	FingerTable.prototype.handleRTCMessage = function (msg) {

	};

	FingerTable.prototype.findPredecessor = function () {

	};

	FingerTable.prototype.fillTable = function () {

	};

	FingerTable.prototype.find2NClosestPeers = function () {

	};





	window.Coordinator = Coordinator;


})(window);






