(function (window) {
	/*
	id is the id of the current node
	*/
	function PeerTable (id) {
		this.peers = {};
		this.id = id;
	}

	// Register makes sure that PeerTable can see it
	PeerTable.prototype.register = function (peer) {
		var self = this;

		if (!peer.id) {
			throw new Error("No peer id!");
		}

		if (this.peers[peer.id]) {
			throw new Error("There is already a peer registered at this id!");
			return;
		} 
		this.peers[peer.id] = peer;

		peer.messageHandler = function (msg) {
			if (self.messageHandler) {
				self.messageHandler(msg);
			}
		};

		peer.onclose = function () {
			self.deregister(peer);
		};

		if (this.newPeerCreated) {
			this.newPeerCreated(peer);
		}

		// Disconnect peer after 10 seconds
		setTimeout(function () {
			if (peer.status === "disconnected") {
				peer.messageHandler = function (){};
				peer.onclose = function (){};
				self.deregister(peer);
			}
		}, 10000);
	};

	PeerTable.prototype.deregister = function (peer) {
		peer.messageHandler = function () {};
		delete this.peers[peer.id];
	};

	PeerTable.prototype.getPeers = function () {
		return this.peers;
	};

	PeerTable.prototype.queryClosestSuccessorId = function (id) {
		var closestSuccessor = this.id !== id ? this.id : id - 1;
		for (var peer in this.peers) {
			if (forwardDistance(id, peer) < forwardDistance(id, closestSuccessor)
				&& parseInt(peer, 10) !== parseInt(id, 10)
				&& this.peers[peer].status === "connected") {
				closestSuccessor = peer;
			}
		}

		if (!this.peers[id - 1] && closestSuccessor === id - 1) {
			return undefined;
		} else {
			return parseInt(closestSuccessor, 10);
		}
	};

	PeerTable.prototype.queryClosestPredecessorId = function (id) {
		var closestPredecessor = this.id;
		for (var peer in this.peers) {
			if (forwardDistance(id, peer) > forwardDistance(id, closestPredecessor)
				&& this.peers[peer].status === "connected") {
				closestPredecessor = peer;
			}
		}
		return parseInt(closestPredecessor, 10);
	};

	PeerTable.prototype.queryClosestId = function (id) {
		var closestId = this.id;
		for (var peer in this.peers) {
			if (forwardDistance(id, peer) < forwardDistance(id, closestId)
				&& this.peers[peer].status === "connected") {
				closestId = peer;
			}
		}

		return parseInt(closestId, 10);
	};

	PeerTable.prototype.queryRandomPeerId = function (id) {
		for (var peer in this.peers) {
			if (this.peers[peer].status === "connected") {
				return parseInt(this.peers[peer].id, 10);
			}
		}
	};

	window.PeerTable = PeerTable;


})(window);