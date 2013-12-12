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
	var RNG = function () {};
	RNG.generate = function () {
		return Math.floor(Math.random() * 1000000000);
	};

	window.RNG = RNG;
})(window);

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


		this.webSocketConnection.onmessage = function (response) {
			var data = response.data;
			var msg = JSON.parse(data);


			var callback = thisCoordinator.requestCallbacks[msg.requestID];
			switch (msg.type) {
				case "response":
					callback(msg);
					break;
				case "request":
					var serverRequestID = msg.serverRequestID;
					handleRequest(serverRequestID, msg.from, msg.data);
					break;
				case "candidate":
					handleCandidate(msg.from, msg.candidate);
					break;
				default:
					console.log("Unrecognised Message Type!");
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


		this.webSocketConnection.onopen = function () {
			thisCoordinator.webSocketConnection.messageBuffer.map(function (msg) {
				thisCoordinator.webSocketConnection.send(msg);
			});
		};

		this.getPeers(function (response) {
			var peers = response.peers;
			thisCoordinator.connectToPeers(peers);
		});
	};

	Coordinator.prototype.connectToPeers = function (peers) {
		var thisCoordinator = this;
		peers.map(function (peer) {
			if (peer in thisCoordinator.peers) {
				return;
			} else {
				var newPeer = new Peer(thisCoordinator, peer);
				thisCoordinator.peers[peer].initiateConnection();
			}
		});
	};

	Coordinator.prototype.getPeers = function (callback) {
		this._requestFromServer({
			type: "cmd",
			cmd: "getPeers"
		}, callback);
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


	Coordinator.prototype._requestFromServer = function (msg, callback) {
		if (typeof msg !== "object") {
			throw new Error("Unable to send strings over to the server. Please send JSON requests");
		} 

		var request = {
			data: msg,
			requestID: RNG.generate(),
			type: "request"
		};

		this.requestCallbacks[request.requestID] = callback;

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

		coordinator.peers[id] = this;

		var thisPeer = this;
		this.connection.ondatachannel = function (event) {
			var dataChannel = event.channel;
			thisPeer.dataChannel = dataChannel;
			setupDataChannel(dataChannel);
		};

		// Cleanup connections
		var interval = setInterval(function () {
			if (thisPeer.connection.iceConnectionState === "closed" || thisPeer.connection.iceConnectionState === "disconnected") {
				delete coordinator.peers[id];
				clearInterval(interval);
			}
		});

		this.connection.onclose = function (event) {
			console.log("CLOSE");
		};
	};

	Peer.prototype.initiateConnection = function () {

		var thisPeer = this;

		this.dataChannel = this.connection.createDataChannel(this.id, (IS_CHROME ? {reliable: false} : {}));

		setupDataChannel(this.dataChannel);

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
			// Buffer message?
		} else {
			this.dataChannel.send(msg);
		}
	};


	function setupDataChannel(dataChannel) {
		dataChannel.onmessage = messageDispatcher;

		dataChannel.onopen = function (event) {
			console.log("DataChannel open");
		};
	}

	function messageDispatcher(event) {
		var data = event.data;
		console.log("I got msg: ", data);
	}





	window.Coordinator = Coordinator;


})(window);






