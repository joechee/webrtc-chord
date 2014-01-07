// TODO: Clean up some of the closures to make code more functional and easier to read.



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




	var Coordinator = function () {
		var thisCoordinator = this;

		this.peers = {}; // There may be false sharing!
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
					console.log("Unrecognised Message Type: ", msg.type);
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

			currentPeer.generateAnswer(msg, function (description) {
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

		this.getPeers(function (peers) {
			thisCoordinator.connectToPeers(peers, function () {
				if (thisCoordinator.onready) {
					thisCoordinator.onready(thisCoordinator);
				}
			});
		});
	};

	Coordinator.prototype.connectToPeers = function (peers, callback) {
		var thisCoordinator = this;
		var peerLength = peers.length;
		var peersReady = 0;
		peers.map(function (peer) {
			if (peer in thisCoordinator.peers) {
				return;
			} else {
				var newPeer = new Peer(thisCoordinator, peer);
				newPeer.onready = function () {
					peersReady++;
					checkPeers(newPeer);
				};
				thisCoordinator.peers[peer].initiateConnection();
				// Debug


			}
		});

		function checkPeers(newPeer) {
			if (peersReady === peerLength && callback) {
				callback();
				if (newPeer) {
					newPeer.onready = function () {};
				}
			}
		}

		checkPeers();
	};

	Coordinator.prototype.close = function () {
		for (var peer in this.peers) {
			this.peers[peer].close();
		}
		this.webSocketConnection.close();
	};

	Coordinator.prototype.getPeers = function (callback) {
		this._requestFromServer({
			type: "cmd",
			cmd: "getPeers"
		}, function (response) {
			callback(response.peers);
		});
	};

	Coordinator.prototype.sendRTCMessage = function (recipient, msg, callback) {
		this._requestFromServer({
			recipient: recipient,
			data: msg,
			type: "RTCMessage"
		}, callback);
	};

	Coordinator.prototype.broadcast = function (msg) {
		for (peer in this.peers) {
			peer.send(msg);
		}
	};

	Coordinator.prototype.send = function (recipient, msg) {
		this.peers[recipient].send(msg);
	};

	Coordinator.prototype.request = function (recipient, msg, callback) {
		this.peers[recipient].request(msg, callback);
	};


	Coordinator.prototype._requestFromServer = function (msg, callback) {
		if (typeof msg !== "object") {
			throw new Error("Unable to send strings over to the server. Please send JSON requests");
		} 

		var request = {
			data: msg,
			requestID: Random.generate(),
			type: "request"
		};

		this.requestCallbacks[request.requestID]= {
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

	var Peer = function (coordinator, id) {
		this.coordinator = coordinator;
		this.connection = new RTCPeerConnection(RTCConfig);
		this.id = id;
		this.messageBuffer = [];

		coordinator.peers[id] = this;

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
				delete coordinator.peers[id];
				clearInterval(interval);
			}
		}, 1000);

		this.connection.onclose = function (event) {
			delete coordinator.peers[id];
			clearInterval(interval);
		};

		this.connection.onopen = function (event) {
			for (var i = 0; i < thisPeer.messageBuffer.length; i++) {
				this.dataChannel.send(thisPeer.messageBuffer[i]);
			}
		};

		if (coordinator.onPeerCreated) {
			coordinator.onPeerCreated(this);
		}
	};

	Peer.prototype.close = function () {
		this.connection.close();
	};

	Peer.prototype.initiateConnection = function () {

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
			thisPeer.coordinator.sendRTCMessage(thisPeer.id, description, function (response) {
				var description = response.data;
				thisPeer.connection.setRemoteDescription(new RTCSessionDescription(description));
			});
		}, function () {});

		this.connection.onicecandidate = function (event) {
		    if (!event || !event.candidate) {
		    	return;	
		    } else {
		    	thisPeer.coordinator.sendRTCMessage(thisPeer.id, {
		    		candidate: event.candidate,
		    		type: "candidate",
		    		recipient: thisPeer.id
		    	});
		    }
		};
	};

	Peer.prototype.generateAnswer = function (offerDescription, callback) {
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
		    	thisPeer.coordinator.sendRTCMessage(thisPeer.id, {
		    		candidate: event.candidate,
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


	function Request(peer, data, requestID) {
		this.peer = peer;
		this.data = data;
		this.requestID = requestID;
	}


	Request.prototype.respond = function (msg) {
		this.peer.respond(msg, this.requestID);
	};


	function setupDataChannel(thisPeer, dataChannel) {
		dataChannel.onmessage = function (event) {
			messageDispatcher(thisPeer, event);
		};

		dataChannel.onerror = function (event) {
			console.log(event);
		};
	}

	function messageDispatcher(peer, event) {
		var data = event.data;
		try {
			data = JSON.parse(data);
		} catch (e) {
			;
		}

		if (typeof(data) === "object" && data.type === "response") {
			if (peer.requestCallbacks[data.responseID]) {
				var callback = peer.requestCallbacks[data.responseID].callback;
				callback(data);
			} else {
				throw new Error("Response received after timeout");
			}
			delete peer.requestCallbacks[data.responseID];
		} else if (typeof(data) === "object" && data.type === "request") {
			if (peer.coordinator.onmessage) {
				peer.coordinator.onrequest(new Request(peer, data, data.requestID));
			}
		} else {
			if (peer.coordinator.onmessage) {
				peer.coordinator.onmessage(peer.id, data);
			}
		}
	}





	window.Coordinator = Coordinator;


})(window);






