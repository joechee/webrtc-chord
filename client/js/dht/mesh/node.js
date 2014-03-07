(function (window) {
	function Node(id) {
		this.init(id);
	}

	Node.prototype.init = function (id) {
		var self = this;
		this.id = id ? id : Random.generate();

		this.peerTable = new PeerTable(this.id);

		this.webSocketTransport = new WebSocketTransport(this.peerTable);
		this.fingerTable = new FingerTable(this.peerTable);
		this.status = "disconnected";

		this.server = new Server(this.peerTable, this.webSocketTransport);
		var peerGenerator = new PeerGenerator(this.peerTable);

		peerGenerator.listen(this.webSocketTransport);
		peerGenerator.listen(this.fingerTable);

		this.fingerTable.registerRequestType('ping', function (request) {
			request.respond('pong');
		});

		this.server.getRandomPeer(function (peer) {
			if (!peer) {
				self.status = "connected";
				self.connectionEstablished();

				// I am the only node in the mesh!
				self.fingerTable.join();
				stabilize();

			} else {
				self.server.connectToPeer(peer, function (peer) {
					if (self.status === "connected") {
						throw new Error("Already connected!");
					}
					self.status = "connected";
					stabilize();
					self.fingerTable.join(peer.id, function () {
						self.connectionEstablished();
					});
				});
			}

		});

		function stabilize() {
			if (self.status === "closed") {
				return;
			} else {
				// Remove this code to prevent stabilization
				self.fingerTable.stabilize(function () {
					this.stabilizeTimeout = setTimeout(function () {
						stabilize();
					}, 100);
				});
			}
		}


		window.addEventListener("beforeunload", function(e) {
			self.closeConnections();
		}, false);
	};

	Node.prototype.connectionEstablished = function () {

	};

	Node.prototype.ondisconnect = function () {

	};

	Node.prototype.getKnownPeers = function () {
		return this.peerTable.getPeers();
	};

	Node.prototype.closeConnections = function () {
		// Call disconnect handler
		if (this.ondisconnect) {
			this.ondisconnect();
		}

		this.webSocketTransport.close();
		this.fingerTable.disconnect();
		if (this.stabilizeTimeout) {
			clearTimeout(this.stabilizeTimeout);
			delete this.stabilizeTimeout;
		}
		this.status = "closed";
	};

	Node.prototype.ping = function (id) {
		var now = new Date();
		this.fingerTable.request({
			from: this.id,
			recipient: id,
			type: 'ping'
		}, function () {
			console.log("ping to " + id +": " + (new Date() - now) + " ms");
		});
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
		peer.on('ready', function () {
			callback(peer);
		});
	};

	window.Node = Node;


})(window);
