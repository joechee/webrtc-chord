(function (window) {

	var DHT = window.DHT;

	function DHTWithLocks () {
		DHT.apply(this, arguments);
		this.locks = {};
	}

	DHTWithLocks.prototype = new DHT();

	DHT.prototype.testAndSet = function (key, val, callback) {
		this.node.fingerTable.request({
			from: this.node.id,
			recipient: recipient,
			data: {
				key: key,
				val: val
			},
			type: 'testAndSet'
		}, function (response) {
			var success = response.val === val;
			if (callback) {
				callback(success);
			}
		}, function (err) {
			callback(false);
		}, timeout);
	};

	DHT.prototype.acquireLock = function (lock, callback) {
		this.testAndSet(lock, true, function () {
			//TODO
		});
	};

	DHT.prototype.releaseLock = function (lock, callback) {
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


	DHT.prototype.


	
})(window);