(function (window) {
	function Node(id) {
		this.init();
	}

	Node.prototype.init = function (id) {
		var self = this;
		this.id = id || Random.generate();

		this.peerTable = new PeerTable(this.id);

		this.webSocketTransport = new WebSocketTransport(this.peerTable);
		this.fingerTable = new FingerTable(this.peerTable);
		this.status = "disconnected";

		this.server = new Server(this.peerTable, this.webSocketTransport);
		var peerGenerator = new PeerGenerator(this.peerTable);

		peerGenerator.listen(this.webSocketTransport);
		peerGenerator.listen(this.fingerTable);

		this.server.getRandomPeer(function (peer) {
			if (!peer) {
				self.status = "connected";
				self.connectionEstablished();

				// I am the only node in the mesh!
				self.fingerTable.build();

			} else {
				self.server.connectToPeer(peer, function (peer) {
					if (self.status === "connected") {
						throw new Error("Already connected!");
					}
					self.status = "connected";
					self.fingerTable.build();
					self.connectionEstablished();
				});
			}

		});
	};

	Node.prototype.connectionEstablished = function () {

	};

	Node.prototype.getKnownPeers = function () {
		return this.peerTable.getPeers();
	};

	Node.prototype.closeConnections = function () {
		this.webSocketTransport.close();
		this.fingerTable.disconnect();
		this.status = "disconnected";

	};

	function Server(parent, transport) {
		if (!(transport instanceof WebSocketTransport)) {
			throw new Error("This does not follow the specification of the server!");
		}
		this.parent = parent;
		this.transport = transport;
	}

	Server.prototype.getRandomPeer = function (callback) {
		this.transport.request({
			from: this.parent.id,
			recipient: "server",
			cmd: "getRandomPeer",
			type: "command"
		}, function (response) {
			callback(response.peer)
		});
	};

	Server.prototype.connectToPeer = function (peerID, callback) {
		var peer = new Peer(this.transport, this.parent, peerID);
		peer._initiateConnection();
		peer.onready = function () {
			callback(peer);
		};
	};

	window.Node = Node;
	window.Server = Server;


})(window);