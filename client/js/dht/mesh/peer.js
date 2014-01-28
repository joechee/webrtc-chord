(function (window) {
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

	window.RTCPeerConnection = RTCPeerConnection;
	window.RTCIceCandidate = RTCIceCandidate;
	window.RTCSessionDescription = RTCSessionDescription;

	var RTCConfig = {
		iceServers: [
			{ 
				'url': 'stun:23.21.150.121'// (IS_CHROME ? 'stun:stun.l.google.com:19302' : 'stun:23.21.150.121')
			}
		]
	};

	var Peer = function (bootstrap, node, id) {
		var thisPeer = this;
		this.parent = node;

		this.bootstrap = bootstrap;
		this.connection = new RTCPeerConnection(RTCConfig);
		this.id = id;
		this.messageBuffer = [];
		this.status = "disconnected";
		this.parent.register(this);


		// Debug
		this.messageReceiveNo = 0;
		this.start = new Date();

		this.messageRPS = function () {
			var time = new Date() - this.start;
			return this.messageReceiveNo / time * 1000;
		};

		this.messageSPS = function () {
			var time = new Date() - this.start;
			return this.messageSendNo / time * 1000;
		};

		var test = this.connection.send;
		this.connection.send = function () {
			thisPeer.messageSendNo++;
			test.apply(this, arguments);
		};



		this.connection.ondatachannel = function (event) {
			thisPeer.messageReceiveNo++;
			var dataChannel = event.channel;
			thisPeer.dataChannel = dataChannel;
			setupDataChannel(thisPeer, dataChannel);
			if (thisPeer.connection.iceConnectionState === "connected") {
				thisPeer.clearBuffer();
			}
		};

		// Cleanup connections
		var interval = setInterval(function () {
			if (thisPeer.connection.iceConnectionState === "closed" || thisPeer.connection.iceConnectionState === "disconnected") {
				thisPeer.status = "disconnected";
				clearInterval(interval);
			}
		}, 1000);

		this.connection.onclose = function (event) {
			thisPeer.status = "disconnected";
			clearInterval(interval);
			if (thisPeer.onclose) {
				thisPeer.onclose();
			}
		};

		this.connection.oniceconnectionstatechange = function (event) {
			var state = event.target.iceConnectionState;
			if (state === "connected") {
				thisPeer.status = "connected";
				thisPeer.clearBuffer();

				if (thisPeer.onready) {
					thisPeer.onready();
					delete thisPeer['onready'];
				}
			} else if (state === "disconnected" || state === "closed") {
				thisPeer.status = "disconnected";
				if (state === "disconnected") {
					thisPeer.parent.deregister(thisPeer);
				}
			}
		};

	};

	Peer.prototype.disconnect = function () {
		// Send close message before disconnect
		// since this is faster than closing the
		// connection
		if (this.dataChannel && this.dataChannel.readyState === "open") {
			this.dataChannel.send(JSON.stringify({
				type: "PeerCommand",
				data: {
					cmd: "close"
				}
			}));	
		}
		this._disconnect();
	};

	Peer.prototype._disconnect = function () {
		this.connection.close();
		this.status = "disconnected";
	};

	Peer.prototype._initiateConnection = function () {
		var thisPeer = this;

		// debug
		this.initiated = true;

		this.dataChannel = this.connection.createDataChannel(this.id, (IS_CHROME ? {reliable: true} : {}));

		setupDataChannel(thisPeer, this.dataChannel);

		this.connection.createOffer(function (description) {
			thisPeer.connection.setLocalDescription(description);
			thisPeer._sendRTCRequest(thisPeer.id, description, function (description) {
				thisPeer.connection.setRemoteDescription(new RTCSessionDescription(description));
			});
		}, function () {});

		this.connection.onicecandidate = function (event) {
		    if (!event || !event.candidate) {
		    	return;	
		    } else {
		    	thisPeer._sendRTCMessage(thisPeer.id, {
		    		originalSender: thisPeer.parent.id,
		    		candidate: event.candidate,
		    		from: thisPeer.parent.id,
		    		type: "candidate",
		    		recipient: thisPeer.id
		    	});
		    }
		};
	};

	Peer.prototype._sendRTCMessage = function (id, description) {
		var message = {
			originalSender: this.parent.id,
			recipient: id,
			from: this.parent.id,
			data: description,
			type: "RTCMessage"
		};
		this.bootstrap.send(message);
	};

	Peer.prototype._sendRTCRequest = function (id, msg, callback) {

		if (typeof msg !== "object") {
			throw new Error("Unable to send strings over to the server. Please send JSON requests");
		}
		this.bootstrap.request({
			originalSender: this.parent.id,
			recipient: id,
			from: this.parent.id,
			data: msg,
			type: "RTCMessage"
		}, callback);
	};

	Peer.prototype.addIceCandidate = function (candidate) {
		try {
			this.connection.addIceCandidate(candidate);
		} catch (e) {
			debugger;
		}
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
		    	thisPeer._sendRTCMessage(thisPeer.id, {
		    		originalSender: thisPeer.parent.id,
		    		candidate: event.candidate,
		    		from: thisPeer.parent.id,
		    		type: "candidate",
		    		recipient: thisPeer.id
		    	});
		    }
		};
	};

	Peer.prototype.send = function (msg) {
		if (typeof(msg) !== "object") {
			throw new Error("Message sent is not a string! Please send an object");
		} else if (!this.dataChannel || this.dataChannel.readyState === "connecting") {
			this.messageBuffer.push(msg);
		} else {
			this.dataChannel.send(JSON.stringify(msg));
		}
	};

	Peer.prototype.clearBuffer = function () {
		var thisPeer = this;
		var newBuffer = [];
		this.messageBuffer.map(function (msg) {
			// Some bugs with sending from dataChannel
			setTimeout(function () {
				if (thisPeer.dataChannel && thisPeer.dataChannel.readyState === "open") {
					thisPeer.dataChannel.send(JSON.stringify(msg));
				} else {
					newBuffer.push(msg);
				}
			}, 10);
		});
		this.messageBuffer = newBuffer;
	};


	function setupDataChannel(thisPeer, dataChannel) {
		dataChannel.onmessage = function (event) {
			if (thisPeer.messageHandler) {
				var data = JSON.parse(event.data);
				if (data.type === "PeerCommand") {
					var data = data.data;
					switch (data.cmd) {
						case "close":
							thisPeer._disconnect();
							break;
						default:
							throw new Error("Unrecognised peer command!");
							break;
					}
				} else {
					thisPeer.messageHandler(data);
				}
			}
		};

		dataChannel.onerror = function (event) {
			throw new Error(event);
		};

		dataChannel.onopen = function () {
			thisPeer.clearBuffer();
			
			if (thisPeer.onready) {
				thisPeer.onready(thisPeer);
				delete thisPeer.onready;
			}
		};
	}

	window.Peer = Peer;

})(window);