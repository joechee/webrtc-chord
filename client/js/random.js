(function (window) {
	var Random = function () {};
	Random.generate = function () {
		return Math.floor(Math.random() * 1000000000);
	};

	window.Random = Random;
})(window);