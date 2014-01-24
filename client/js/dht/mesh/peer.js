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

	var RTCConfig = {
		iceServers: [
			{ 
				'url': 'stun:23.21.150.121'// (IS_CHROME ? 'stun:stun.l.google.com:19302' : 'stun:23.21.150.121')
			}
		]
	};

	var Peer = function (bootstrap, node, id) {
		this.parent = node;

		this.bootstrap = bootstrap;
		this.connection = new RTCPeerConnection(RTCConfig);
		this.id = id;
		this.messageBuffer = [];
		this.status = "disconnected";
		this.parent.register(this);

		var thisPeer = this;
		this.connection.ondatachannel = function (event) {
			var dataChannel = event.channel;
			thisPeer.dataChannel = dataChannel;
			setupDataChannel(thisPeer, dataChannel);
			if (thisPeer.connection.iceConnectionState === "connected") {
				for (var i = 0; i < thisPeer.messageBuffer.length; i++) {
					thisPeer.dataChannel.send(JSON.stringify(thisPeer.messageBuffer[i]));
				}
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
		};

		this.connection.oniceconnectionstatechange = function (event) {
			var state = event.target.iceConnectionState;
			if (state === "connected") {
				thisPeer.status = "connected";

				if (thisPeer.onready) {
					thisPeer.onready();
					delete thisPeer['onready'];
				}
			}
		};

	};

	Peer.prototype.disconnect = function () {
		this.connection.close();
		this.status = "disconnected";
	};

	Peer.prototype._initiateConnection = function () {

		var thisPeer = this;

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
			recipient: id,
			from: this.parent.id,
			data: msg,
			type: "RTCMessage"
		}, callback);

	};

	Peer.prototype.addIceCandidate = function (candidate) {
		this.connection.addIceCandidate(candidate);
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


	function setupDataChannel(thisPeer, dataChannel) {
		dataChannel.onmessage = function (event) {
			if (thisPeer.messageHandler) {
				thisPeer.messageHandler(JSON.parse(event.data));
			}
		};

		dataChannel.onerror = function (event) {
			throw new Error(event);
		};

		dataChannel.onopen = function () {
			thisPeer.messageBuffer.map(function (msg) {
				// Some bugs with sending from dataChannel
				setTimeout(function () {
					console.log('send!');
					thisPeer.dataChannel.send(JSON.stringify(msg));
				}, 10);
			});
			

			thisPeer.messageBuffer = [];
			if (thisPeer.onready) {
				thisPeer.onready(thisPeer);
				delete thisPeer.onready;
			}
		};
	}

	window.Peer = Peer;

})(window);