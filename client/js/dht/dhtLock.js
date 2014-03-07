(function (window) {

	function EventEmitter() {
		this.eventHandlers = {};
	}

	EventEmitter.prototype.on = function (event, callback) {
		if (!this.eventHandlers[event]) {
			this.eventHandlers[event] = [callback];
		} else {
			this.eventHandlers[event].push(callback);
		}
	};

	EventEmitter.prototype.emit = function (event, data) {
		if (this.eventHandlers[event]) {
			this.eventHandlers[event].forEach(function (handler) {
				handler(data);
			});
		}
	};

	var DHT = window.DHT;

	function DHTWithLocks () {
		DHT.apply(this, arguments);
		this.locks = {};
	}

	DHTWithLocks.prototype = new DHT();

	DHTWithLocks.prototype.testAndSet = function (key, val, callback) {
		this.node.fingerTable.request({
			from: this.node.id,
			recipient: recipient,
			data: {
				key: key,
				val: val
			},
			type: 'testAndSet'
		}, function (response) {
			var success = response.val !== val;
			if (callback) {
				callback(success);
			}
		}, function (err) {
			if (callback) {
				callback(false);
			}
		}, timeout);
	};


	function Lock(dht, key) {
		EventEmitter.call(this);
		this.key = key;
		this.dht = dht;
		dht.get(val, function (res) {
			this.status = (res.val === true);
			this.emit('statusChanged', this.status);
		});
	}

	Lock.prototype = new EventEmitter();


	Lock.prototype.acquire = function () {
		this.dht.acquireLock(this.key, function (val) {
			this.status = (res.val === true);
			this.emit('statusChanged', this.status);
		});
	};

	Lock.prototype.release = function () {

	};


	DHTWithLocks.prototype.getLockObject = function (key) {

	};

	DHTWithLocks.prototype.acquireLock = function (lock, callback) {
		this.testAndSet(lock, true, function (val) {
			console.log(val);

		});
	};

	// Maybe I should create a Lock object

	DHTWithLocks.prototype.releaseLock = function (lock, callback) {
		if (this.locks[lock]) {
			this.put(lock, false, function (response) {
				if (callback) {
					callback(true);
				}
			}, function (err) {
				if (callback) {
					callback(false);
				}
			});
		}
	};

	window.DHTWithLocks = DHTWithLocks
	
})(window);