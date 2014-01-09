(function (window) {

	var seed = 1;


	function distance(key1, key2) {
		return key1 ^ key2;
	}

	function findClosestPeer(key, dht) {
		var keyLocations = dht.keyLocations;
		// Can probably binary search here
		var peers = [];
		for (var peer in dht.coordinator.peers) {
			peers.push(peer);
		}
		peers.push(dht.coordinator.id);
		var hash = CryptoJS.SHA1(key);
		var minDistance = Infinity;
		var minDistancePeer;
		for (var i = 0; i < peers.length; i++) {
			var peer = parseInt(peers[i], 10);
			var location = keyLocations[peer];
			if (distance(hash, location) < minDistance) {
				minDistance = distance(hash, location);
				minDistancePeer = peer;
			}
		}
		return minDistancePeer;
	}
	


	var DHT = function () {
		this.coordinator = new Coordinator();

		this.keyLocations = {};

		this.peerLocations = {};

		this.localStore = {};

		var thisDHT = this;

		var MersenneRandom = new MersenneTwister(seed);

		this.coordinator.getPeers(function (peers) {
			peers.push(thisDHT.coordinator.id);

			for (var i = 0; i < 10000; i++) {
				thisDHT.keyLocations[i] = MersenneRandom.genrand_int32();
			}

			if (thisDHT.onready) {
				thisDHT.onready();
			}

		});

		this.coordinator.onmessage = function (msg) {
			console.log(msg);
		};

		this.coordinator.onrequest = function (req) {
			var data = req.data;
			if (data.cmd === "put") {
				thisDHT.localStore[data.key] = data.value;
				req.respond({
					result: true
				});
			} else if (data.cmd === "get") {
				var response = {
					key: data.key,
					value: thisDHT.localStore[data.key]
				};
				response[data.key] = thisDHT.localStore[data.key];
				req.respond(response);
			} else {
				throw new Error("Unrecognised command: ", req.data.cmd);
			}
		};

		this.coordinator.onPeerCreated = function (peer) {
			for (var key in thisDHT.localStore) {
				if (findClosestPeer(key, thisDHT) !== thisDHT.coordinator) {
					thisDHT.put(key, thisDHT.localStore[key]);
				}
			}
		};
	};

	DHT.prototype.put = function (key, value, successCallback) {
		var dict = {};
		dict[key] = value;
		this.putMultiple(dict, successCallback);
	};

	DHT.prototype.get = function (key, callback) {
		this.getMultiple([key], function (responseDict) {
			callback(responseDict[key]);
		});
	};

	DHT.prototype.putMultiple = function (dict, successCallback) {
		// Optimize by putting those which go to the same peer together
		var callbacks = 0;

		for (var key in dict) {
			callbacks++;
		}

		for (var key in dict) {
			var closestPeer = findClosestPeer(key, this);

			if (closestPeer.toString() === this.coordinator.id.toString()) {
				this.localStore[key] = dict[key];
				callbacks--;
				if (callbacks === 0 && successCallback) {
					successCallback(true);
				}
			} else {
				var putMessage = {
					key: key,
					value: dict[key],
					cmd: "put"
				};
				this.coordinator.request(closestPeer, putMessage, function (response) {
					callbacks--;
					if (callbacks === 0 && successCallback) {
						successCallback(true);
					}
				});	
			}
			
		}
	};

	DHT.prototype.getMultiple = function (keys, successCallback) {
		var callbacks = keys.length;
		var returnValues = {};

		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			var closestPeer = findClosestPeer(key, this);
			var getMessage = {
				key: key,
				cmd: "get"
			};
			if (closestPeer.toString() === this.coordinator.id.toString()) {
				callbacks--;
				returnValues[key] = this.localStore[key];
				if (callbacks === 0 && successCallback) {
					successCallback(returnValues);
				}
			} else {
				this.coordinator.request(closestPeer, getMessage, function (response) {
					callbacks--;
					returnValues[response.key] = response.value;
					if (callbacks === 0 && successCallback) {
						successCallback(returnValues);
					}
				});
			}
			
		}

	};

	window.DHT = DHT;

})(window);