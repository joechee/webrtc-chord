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

var connection = new RTCPeerConnection({
	iceServers: [
		{ 
			'url': 'stun:23.21.150.121'// (IS_CHROME ? 'stun:stun.l.google.com:19302' : 'stun:23.21.150.121')
		}
	],

});


connection.messagehandler = function (signallingChannel, msg) {
	var thisConnection = this;
	if (msg.sdp && msg.type === "offer") {
		this.setRemoteDescription(new RTCSessionDescription(msg));
		thisConnection.createAnswer(function (description) {
			thisConnection.setLocalDescription(description);
			signallingChannel.sendRTCMessage(JSON.stringify(description));
		}, function () {}, {});	
	} else if (msg.sdp && msg.type === "answer") {
		this.setRemoteDescription(new RTCSessionDescription(msg));	
	} else if (msg.candidate) {
		this.addIceCandidate(new RTCIceCandidate(msg.candidate));
	} else {
		console.log(msg);
	}
};

connection.onicecandidate = function (event) {
	console.log(event);
    if (!event || !event.candidate) {
    	return;	
    } else {
    	this.signallingChannel.sendRTCMessage(JSON.stringify({
    		candidate: event.candidate
    	}));
    }
};

connection.onerror = function (err) {
	console.log(err);
};

connection.ondatachannel = function (event) {
	window.dataChannel = event.channel;

	setupDataChannel(window.dataChannel);
};


var SignallingChannel = function (peerConnection) {
	var signallingChannel = this;

	peerConnection.signallingChannel = this;

	this.peerConnection = peerConnection;

	this.webSocketConnection = new WebSocket(hostname);

	this.messageBuffer = [];

	this.webSocketConnection.onopen = function () {
		signallingChannel.messageBuffer.map(function (msg) {
			signallingChannel.send(msg);
		});
	};

	this.webSocketConnection.onmessage = function (msg) {
		var data = JSON.parse(msg.data);
		console.log(data);

		if (data.type === "RTCMessage") {
			peerConnection.messagehandler(signallingChannel, JSON.parse(data.data));
		} else {
			;
		}
	};

	this.webSocketConnection.onerror = function (err) {
		console.log(err);
	};

};

SignallingChannel.prototype.send = function (msg) {
	if (typeof msg === "object") {
		msg = JSON.stringify(msg);
	}
	if (this.webSocketConnection.readyState === 0) {
		this.messageBuffer.push(msg);
	} else {
		this.webSocketConnection.send(msg);
	}
};

SignallingChannel.prototype.sendRTCMessage = function (msg, recipient) {
	this.send({
		data: msg,
		type: "RTCMessage",
		recipient: recipient
	});
};

var signalChannel = new SignallingChannel(connection);

function initiateConnection() {

	if (IS_CHROME) {
		createDataChannel();
	}

	connection.createOffer(function (description) {
		connection.setLocalDescription(description);
		signalChannel.sendRTCMessage(JSON.stringify(description));
	}, function () {}, {});
}

function createDataChannel() {
	dataChannel = connection.createDataChannel("RTCDataChannel", (IS_CHROME ? {reliable: false} : {}));


	setupDataChannel(dataChannel);

}

function setupDataChannel(dataChannel) {
	dataChannel.onmessage = function (event) {
		var data = event.data;
		console.log(event);
		console.log("I got msg: ", data);
	};

	dataChannel.onopen = function (event) {
		console.log("OPEN");
	};
}







