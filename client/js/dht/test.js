
test("Required Libraries Loaded", function () {
	var libraries = [DHT, CryptoJS, MersenneTwister, Coordinator];
	for (var i = 0; i < libraries.length; i++) {
		if (!libraries[i]) {
			throw new Error("Required Libraries not loaded!");
		}
	}

	ok(true, "Passed!");
});



asyncTest("Test coordinator.onready", function () {
	var c = new Coordinator();

	c.onready = function () {
		ok(true, "Passed!");
		c.close();
		start();
	};
});


asyncTest("Test 2 coordinators.onready", function () {
	var c1 = new Coordinator();
	var c2 = new Coordinator();

	var ready = 0;
	c1.onready = function () {
		ready++;
		checkReady();
	};

	c2.onready = function () {
		ready++;
		checkReady();
	};

	function checkReady() {
		if (ready === 2) {

			var c1id = c1.id;
			var c2id = c2.id;

			notStrictEqual(c1.peers[c2id], undefined);
			notStrictEqual(c2.peers[c1id], undefined);

			c1.close();
			c2.close();

			ok(true, "Passed!");
			start();
		}
	}
});

asyncTest("Test 3 coordinators.onready", function () {
	var c1 = new Coordinator();
	var c2 = new Coordinator();
	var c3 = new Coordinator();

	var ready = 0;
	c1.onready = function () {
		ready++;
		checkReady();
	};

	c2.onready = function () {
		ready++;
		checkReady();
	};

	c3.onready = function () {
		ready++;
		checkReady();
	};

	function checkReady() {
		if (ready === 3) {

			var c1id = c1.id;
			var c2id = c2.id;
			var c3id = c3.id;
			var ids = [c1.id, c2.id, c3.id];
			var coordinators = [c1, c2, c3];

			for (var i = 0; i < 3; i++) {
				for (var j = 0; j < 3; j++) {
					if (i !== j) {
						notStrictEqual(coordinators[i].peers[ids[j]], undefined);
					}
				}
			}

			for (var i = 0; i < 3; i++) {
				coordinators[i].close();
			}

			ok(true, "Passed!");
			start();
		}
	}
});

asyncTest("Send messages from 1 coordinator to another after ready", function () {
	var c1 = new Coordinator();
	var c2 = new Coordinator();

	var ready = 0;
	c1.onready = function () {
		ready++;
		checkReady();
	};

	c2.onready = function () {
		ready++;
		checkReady();
	};

	function checkReady() {
		if (ready === 2) {
			var c1id = c1.id;
			var c2id = c2.id;

			c1.onmessage = function () {
				c2.onmessage = function () {};
				c1.close();
				c2.close();
				ok(true, "Passed!");
				start();
			};

			c2.send(c1.id, "hello");
		}
	}
});

asyncTest("Send message from 1 coordinator to another before ready", function () {
	var c1 = new Coordinator();
	var c2 = new Coordinator();
	c1.onmessage = function () {
		c2.onmessage = function () {};
		c1.close();
		c2.close();
		ok(true, "Passed!");
		start();
	};

	c2.onPeerCreated = function (peer) {
		equal(peer.id, c1.id);
		c2.send(c1.id, "hello");
	};
});


asyncTest("Send message from 1 coordinator to another before ready", function () {
	var c1 = new Coordinator();
	var c2 = new Coordinator();

	var ready = 0;
	c1.onready = function () {
		ready++;
		checkReady();
	};

	c2.onready = function () {
		ready++;
		checkReady();
	};

	function checkReady() {
		if (ready === 2) {
			var c1id = c1.id;
			var c2id = c2.id;

			c1.onmessage = function () {
				c2.onmessage = function () {};
				c1.close();
				c2.close();
				ok(true, "Passed!");
				start();
			};

			c2.send(c1.id, "hello");
		}
	}
});




/*

asyncTest("Test sendMessage between 2 coordinators without message buffering", function () {
	var c1 = new Coordinator();
	var c2 = new Coordinator();

	var ready = 0;
	c1.onready = function () {
		ready++;
		checkReady();
	};

	c2.onready = function () {
		ready++;
		checkReady();
	};

	function checkReady() {
		if (ready === 2) {
			ok(true, "Passed!");
			start();
		}
	}	
});

*/