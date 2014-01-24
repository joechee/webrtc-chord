asyncTest("Test 1 node", function () {
	node = new Node();

	node.connectionEstablished = function () {
		node.closeConnections();
		ok(true);
		start();
	};
});
asyncTest("Test 2 nodes", function () {
	node1 = new Node();
	node2 = new Node();
	var counter = 0;

	node1.connectionEstablished = function () {
		ok(true);
		counter++;
		checkCounter();
	};

	node2.connectionEstablished = function () {
		ok(true);
		counter++;
		checkCounter();
	};

	function checkCounter() {
		if (counter === 2) {
			node1.closeConnections();
			node2.closeConnections();
			start();
		}
	}
});

asyncTest("Test 3 nodes", function () {
	node1 = new Node();
	node2 = new Node();
	node3 = new Node();
	var counter = 0;

	node1.connectionEstablished = function () {
		ok(true);
		counter++;
		checkCounter();
	};

	node2.connectionEstablished = function () {
		ok(true);
		counter++;
		checkCounter();
	};
	node3.connectionEstablished = function () {
		ok(true);
		counter++;
		checkCounter();
	};

	function checkCounter() {
		if (counter === 3) {
			//node1.closeConnections();
			//node2.closeConnections();
			start();
		}
	}
});
