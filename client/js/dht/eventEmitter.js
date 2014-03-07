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

	window.EventEmitter = EventEmitter;
})(window);