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
		if (peer.id) {
			this.peers[peer.id] = peer;
		}
		peer.messageHandler = function (msg) {
			if (self.messageHandler) {
				self.messageHandler(msg);
			}
		};

		if (this.newPeerCreated) {
			this.newPeerCreated(peer);
		}
	};

	PeerTable.prototype.getPeers = function () {
		return this.peers;
	};

	PeerTable.prototype.queryClosestSuccessorId = function (id) {
		var closestSuccessor = this.id;
		for (var peer in this.peers) {
			if (forwardDistance(id, peer) < forwardDistance(id, closestSuccessor)
				&& parseInt(peer, 10) !== parseInt(id, 10)
				&& this.peers[peer].status === "connected") {
				closestSuccessor = peer;
			}
		}
		return closestSuccessor;
	};

	PeerTable.prototype.queryClosestPredecessorId = function (id) {
		var closestPredecessor = this.id;
		for (var peer in this.peers) {
			if (forwardDistance(id, peer) > forwardDistance(id, closestPredecessor)
				&& this.peers[peer].status === "connected") {
				closestPredecessor = peer;
			}
		}
		return closestPredecessor;
	};

	PeerTable.prototype.queryClosestId = function (id) {
		var closestId = this.id;
		for (var peer in this.peers) {
			if (forwardDistance(id, peer) < forwardDistance(id, closestId)) {
				closestId = peer;
			}
		}

		return closestId;
	};

	window.PeerTable = PeerTable;


})(window);