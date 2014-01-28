(function (window) {

	var seed = 1;

	function hash(key) {
		var result = CryptoJS.SHA1(key).toString(CryptoJS.enc.Hex);
		return parseInt(result, 16) % INT32_MAX;
	}
	window.hash = hash;

	var DHT = function (id) {
		this.node = new Node(id);
		this.localStore = {};

		var self = this;
		this.node.connectionEstablished = function () {
			self.takeOverKeys(function (response) {
				if (self.onready){
					self.onready();
				}
			});
		};
		this.node.fingerTable.registerRequestType('put', function (request) {
			var data = request.data.data;
			self.put(data.key, data.val, function (response) {
				request.respond(response);
			});
		});

		this.node.fingerTable.registerRequestType('putMultiple', function (request) {
			var data = request.data.data;
			for (var key in data) {
				self.localStore[key] = data[key];
			}
			request.respond({
				result: 'success'
			});
		});

		this.node.fingerTable.registerRequestType('get', function (request) {
			var data = request.data.data;
			self.get(data.key, function (response) {
				request.respond(response);
			});
		});

		this.node.fingerTable.registerRequestType('takeOverKeys', function (request) {
			var dict = {};
			for (var key in self.localStore) {
				var recipient = self.node.peerTable.queryClosestPredecessorId(hash(key));
				if (recipient === request.data.from) {
					dict[key] = self.localStore[key];
				}
			}
			request.respond(dict);
		});

		this.node.fingerTable.registerRequestType('ping', function (request) {
			request.respond('pong');
		});

		this.node.ondisconnect = function () {
			self.putMultiple(self.localStore);
		};
	};

	DHT.prototype.put = function (key, val, callback) {
		var recipient = this.node.peerTable.queryClosestPredecessorId(hash(key));
		if (recipient === this.node.id) {
			this.localStore[key] = val;
			if (callback) {
				callback({
					key: key,
					val: val
				});	
			}
		} else {
			this.node.fingerTable.request({
				from: this.node.id,
				recipient: recipient,
				data: {
					key: key,
					val: val
				},
				type: 'put'
			}, function (response) {
				if (callback) {
					callback(response);
				}
			});	
		}
	};

	DHT.prototype.putMultiple = function (dict, callback) {
		var recipient = this.node.peerTable.queryClosestPredecessorId(this.node.id);
		if (recipient !== this.node.id) {
			this.node.fingerTable.request({
				from: this.node.id,
				recipient: recipient,
				data: dict,
				type: 'putMultiple'
			}, function (response) {
				if (callback) {
					callback(response);
				}
			});
		}
	};

	DHT.prototype.get = function (key, callback) {
		var recipient = this.node.peerTable.queryClosestPredecessorId(hash(key));
		if (recipient === this.node.id) {
			callback({
				key: key,
				val: this.localStore[key]
			});
		} else {
			this.node.fingerTable.request({
				from: this.node.id,
				recipient: recipient,
				data: {
					key: key
				},
				type: 'get'
			}, function (response) {
				if (callback) {
					callback(response);
				}
			});	
		}
	};

	DHT.prototype.takeOverKeys = function (callback) {
		var predecessor = this.node.peerTable.queryClosestPredecessorId(this.node.id);
		var self = this;

		if (predecessor === self.node.id) {
			if (callback) {
				callback(true);
			}
			return;
		}
		this.node.fingerTable.request({
			from: this.node.id,
			recipient: predecessor,
			type: 'takeOverKeys'
		}, function (response) {
			for (var key in response) {
				self.localStore[key] = response[key];
			}
			if (callback) {
				callback(true);
			}
		});
	};

	DHT.prototype.disconnect = function () {
		this.node.closeConnections();
	};


	window.DHT = DHT;

})(window);