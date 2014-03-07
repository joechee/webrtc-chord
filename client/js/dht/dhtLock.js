(function (window) {

	var DHT = window.DHT;

	function DHTWithLocks () {
		DHT.apply(this, arguments);
		this.locks = {};
		this.node.fingerTable.registerRequestType('testAndSet', function () {
			var data = request.data.data;
			self.get(data.key, function (response) {
				self.put(data.key, data.val, function () {
					request.respond(response); // Return what was originally in the key
				});
			});

		});
	}

	DHTWithLocks.prototype = new DHT();

	DHTWithLocks.prototype.testAndSet = function (key, val, callback) {
		var recipient = this.node.peerTable.queryClosestPredecessorId(hash(key));
		var timeout = 1000;
		var self = this;

		if (recipient === this.node.id) {
			self.get(key, function (response) {
				self.put(key, val, function () {
					if (callback) {
						callback(val !== response.val);
					}
				});
			});
		} else {
			this.node.fingerTable.request({
				from: this.node.id,
				recipient: recipient,
				data: {
					key: key,
					val: val
				},
				type: 'testAndSet'
			}, function (response) {
				var success = (response.val !== val);
				if (callback) {
					callback(success);
				}
			}, function (err) {
				if (callback) {
					callback(false);
				}
			}, timeout);
		}
	};


	function Lock(dht, key) {
		var self = this;
		EventEmitter.call(this);
		this.key = key;
		this.dht = dht;
		if (!dht.ready) {
			dht.on('ready', function () {
				dht.get(key, function (res) {
					if (res.val) {
						self.status = "taken";
					} else {
						self.status = "free";
					}
					self.emit('statusChange', self.status);
				});
			});
		} else {
			dht.get(key, function (res) {
				if (res.val) {
					self.status = "taken";
				} else {
					self.status = "free";
				}
				self.emit('statusChange', self.status);
			});
		}
		
	}

	Lock.prototype = new EventEmitter();


	Lock.prototype.acquire = function (callback) {
		var self = this;
		this.dht.acquireLock(this.key, function (val) {
			if (val === true) {
				self.status = "acquired";
			} else {
				self.status = "taken";
			}
			self.emit('statusChange', self.status);
			if (callback) {
				callback(self.status);
			}
		});
	};

	Lock.prototype.release = function () {
		var self = this;
		if (this.status) {
			this.dht.releaseLock(this.key, function (val) {
				// Has to be false as release is always successful
				self.status = "free";
				self.emit('statusChange', self.status);
			});
		} else {
			throw new Error("This lock was never yours to begin with!");
		}
	};

	DHTWithLocks.prototype.getLockObject = function (key) {
		return new Lock(this, key);
	};

	DHTWithLocks.prototype.acquireLock = function (lock, callback) {
		this.testAndSet(lock, true, function (val) {
			callback(val);
		});
	};

	// Maybe I should create a Lock object

	DHTWithLocks.prototype.releaseLock = function (lock, callback) {
		this.testAndSet(lock, false, function (val) {
			callback(val);
		});
	};

	window.DHTWithLocks = DHTWithLocks;
	
})(window);