(function (window) {
	function PeerGenerator(peerTable) {
		this.parent = peerTable;
	}


	PeerGenerator.prototype.listen = function (transport) {
		var self = this;
		if (!(transport instanceof Transport)) {
			throw new Error("Argument should be an instance of Transport");
		}
		transport.registerMessageType("RTCMessage", function (msg) {
			var data = msg.data;
			var from = msg.originalSender;
			switch (data.type) {
				case "candidate":
					var peer = self.parent.peers[from];
					if (!peer) {
						return;
					}
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
					var currentPeer = self.parent.getPeers()[msg.originalSender];

					// There is a peer that exists at this peerID
					// Replacement policy: If forwardDistance(peer.id, this.id) >  && 
					// the peer was not already connected, replace
					if (currentPeer 
						&& (forwardDistance(currentPeer.id, self.parent.id) > forwardDistance(self.parent.id, currentPeer.id))
					) {
						console.log('peer replaced!');
						self.parent.deregister(currentPeer);
						var peer = new Peer(transport, self.parent, msg.originalSender);
						peer.generateAnswer(data, function (answer) {
							request.respond(answer);
						});
					} else if (currentPeer) {
						console.log('a decision was made not to replace!');
						// Don't replace
					} else {
						// Add new peer
						var peer = new Peer(transport, self.parent, msg.originalSender);
						peer.generateAnswer(data, function (answer) {
							request.respond(answer);
						});
					}
					
					break;
				default:
					throw new Error("Unknown message type: " + data.type);
					break;
			}
		});

		transport.registerRequestType("RTCForward", function (request) {
			var recipient = request.data.data.recipient;
			transport.request({
				recipient: recipient,
				from: self.parent.id,
				data: request.data.data,
				type: "RTCMessage"
			}, function (response) {
				request.respond(response);
			});
		})
	};


	window.PeerGenerator = PeerGenerator;

})(window);