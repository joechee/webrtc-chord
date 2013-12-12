(function (window) {
	var DHT = function () {

	};

	DHT.prototype.put = function (key, value, successCallback) {
		var dict = {};
		dict[key] = value;
		this.putMultiple(dict, successCallback);
	};

	DHT.prototype.get = function (key, callback) {
		this.getMultiple([key], callback);
	};

	DHT.prototype.putMultiple = function (dict, successCallback) {

	};

	DHT.prototype.getMultiple = function (keys, callback) {

	};

	window.DHT = DHT;

})(window);