(function (window) {
	function PeerGenerator(node) {
		this.parent = node;
	}


	PeerGenerator.prototype.listen = function (transport) {
		var self = this;
		if (!(transport instanceof Transport)) {
			throw new Error("Argument should be an instance of Transport");
		}
		transport.registerMessageType("RTCMessage", function (msg) {
			var data = msg.data;
			var from = msg.from;
			switch (data.type) {
				case "candidate":
					var peer = self.parent.peers[from];
					peer.addIceCandidate(new RTCIceCandidate(data.candidate));
					break;
				default:
					throw new Error("Unknown message type: " + data.type);
					break;
			}
		});

		transport.registerRequestType("RTCMessage", function (request) {
			var msg = request.data;
			var data = msg.data;
			switch (data.type) {
				case "offer":
					var peer = new Peer(transport, self.parent, msg.from);
					peer.generateAnswer(data, function (answer) {
						request.respond(answer);
					});
					break;
				default:
					throw new Error("Unknown message type: " + data.type);
					break;
			}
		});
	};


	window.PeerGenerator = PeerGenerator;

})(window);