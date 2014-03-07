(function (window) {
	// TODO: Should add support for once
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

	// Remove all handlers from an event
	EventEmitter.prototype.off = function (event) {
		this.eventHandlers[event] = [];
	};

	window.EventEmitter = EventEmitter;
})(window);