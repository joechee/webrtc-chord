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

	node1.fingerTable.registerMessageType('test', function (msg) {
		ok(true);
		counter++;
		checkCounter2();
	});
	node2.fingerTable.registerMessageType('test', function (msg) {
		ok(true);
		counter++;
		checkCounter2();
	});
	node3.fingerTable.registerMessageType('test', function (msg) {
		ok(true);
		counter++;
		checkCounter2();
	});

	function checkCounter2() {
		if (counter === 3) {
			node1.closeConnections();
			node2.closeConnections();
			node3.closeConnections();
			start();
		}
	}

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
			counter = 0;
			node1.fingerTable.send({
				recipient: node3.id,
				from: node1.id,
				type: 'test'
			});

			node1.fingerTable.send({
				recipient: node2.id,
				from: node1.id,
				type: 'test'
			});

			node2.fingerTable.send({
				recipient: node3.id,
				from: node2.id,
				type: 'test'
			});
		}
	}
});


asyncTest("Test 4 nodes", function () {
	node1 = new Node();
	node2 = new Node();
	node3 = new Node();
	node4 = new Node();

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

	node4.connectionEstablished = function () {
		ok(true);
		counter++;
		checkCounter();
	};

	node1.fingerTable.registerMessageType('test', function (msg) {
		ok(true);
		counter++;
		checkCounter2();
	});
	node2.fingerTable.registerMessageType('test', function (msg) {
		ok(true);
		counter++;
		checkCounter2();
	});
	node3.fingerTable.registerMessageType('test', function (msg) {
		ok(true);
		counter++;
		checkCounter2();
	});
	node4.fingerTable.registerMessageType('test', function (msg) {
		ok(true);
		counter++;
		checkCounter2();
	});


	function checkCounter2() {
		if (counter === 6) {
			start();
			node1.closeConnections();
			node2.closeConnections();
			node3.closeConnections();
			node4.closeConnections();
			window.location = window.location;
		}
	}

	function checkCounter() {
		if (counter === 4) {
			counter = 0;
			node1.fingerTable.send({
				recipient: node2.id,
				from: node1.id,
				type: 'test'
			});

			node1.fingerTable.send({
				recipient: node2.id,
				from: node1.id,
				type: 'test'
			});

			node1.fingerTable.send({
				recipient: node4.id,
				from: node1.id,
				type: 'test'
			});

			node2.fingerTable.send({
				recipient: node3.id,
				from: node2.id,
				type: 'test'
			});

			node2.fingerTable.send({
				recipient: node4.id,
				from: node2.id,
				type: 'test'
			});

			node3.fingerTable.send({
				recipient: node4.id,
				from: node2.id,
				type: 'test'
			});
		}
	}
	function checkMessageBuffers() {
		var peers = node1.peerTable.getPeers();
		console.log('peer1');
		for (var i in peers) {
			console.log(peers[i].messageBuffer);
		}
		console.log('peer2');
		var peers = node2.peerTable.getPeers();
		for (var i in peers) {
			console.log(peers[i].messageBuffer);
		}
		console.log('peer3');
		var peers = node3.peerTable.getPeers();
		for (var i in peers) {
			console.log(peers[i].messageBuffer);
		}
		console.log('peer4');
		var peers = node4.peerTable.getPeers();
		for (var i in peers) {
			console.log(peers[i].messageBuffer);
		}
	}
	window.checkMessageBuffers = checkMessageBuffers;
});

var NUM_NODES = 5;

asyncTest("Test "+ NUM_NODES +" nodes", function () {
	nodes = [];
	var counter = 0;
	for (var i = 0; i < NUM_NODES; i++) {
		var node = new Node();
		node.connectionEstablished = function () {
			ok(true);
			counter++;
			checkCounter();
		};

		node.fingerTable.registerMessageType('test', function (msg) {
			ok(true);
			counter++;
			checkCounter2();
		});
		nodes.push(node);

	}
	function sum(n) {
		var result = 0;
		for (var i = 0; i < n; i++) {
			result += i;
		}
		return result;
	}


	function checkCounter2() {
		if (counter === sum(NUM_NODES)) {
			window.location = window.location;
			for (var i = 0; i < NUM_NODES; i++) {
				nodes[i].closeConnections();
			}
			start();
		}
	}

	function checkCounter() {
		if (counter === NUM_NODES) {
			counter = 0;

			for (var i = 0; i < NUM_NODES; i++) {
				for (var j = i + 1; j < NUM_NODES; j++) {
					if (j < NUM_NODES) {
						nodes[i].fingerTable.send({
							recipient: nodes[j].id,
							from: nodes[i].id,
							type: 'test'
						});
					}
				}
			}
		}
	}
	function checkMessageBuffers() {
		for (var i = 0; i < NUM_NODES; i++) {
			var peers = nodes[i].peerTable.getPeers();
			console.log('peer' + i);
			for (var j in peers) {
				console.log(peers[j].messageBuffer);
			}
		}
	}

	function renderGraph() {
		var graphNodes = [];
		var graphEdges = [];
		var sortedNodes = [];

		for (var i = 0; i < nodes.length; i++) {
			sortedNodes.push(nodes[i].id);
		}
		sortedNodes.sort(function (a, b) { return a > b;});
		for (var i = 0; i < nodes.length; i++) {
			var sorted = sortedNodes.indexOf(nodes[i].id);
			graphNodes.push({
				id: nodes[i].id,
				label: 'node' + i + ' (sorted: '+ sorted +'): ' + nodes[i].id
			});
			var peers = nodes[i].peerTable.getPeers();

			for (var peer in peers) {
				var edge = {};
				edge.from = nodes[i].id;
				edge.to = peer;
				if (peers[peer].status === "connected") {
					edge.color = "FF00FF";
				}
				graphEdges.push(edge);
			}
		}

		var container = document.getElementById('network-graph');
		var data = {
			nodes: graphNodes,
			edges: graphEdges
		};
		var options = {
			edges: {
				length: NUM_NODES * 40
			}
		};
		var graph = new vis.Graph(container, data, options);

	}

	function testRingConnectivity() {
		for (var i = 0; i < nodes.length; i++) {
			if (nodes[i].peerTable.peers[nodes[(i + 1) % NUM_NODES].id].status !== "connected") {
				console.log(i);
				console.log(nodes[i]);
			}
		}
	}


	window.renderGraph = renderGraph;
	window.checkMessageBuffers = checkMessageBuffers;
});

asyncTest("Test 3 nodes DHT", function () {
	node1 = new DHT();
	node2 = new DHT();
	node3 = new DHT();
	var counter = 0;

	node1.node.connectionEstablished = function () {
		ok(true);
		counter++;
		checkCounter();
	};

	node2.node.connectionEstablished = function () {
		ok(true);
		counter++;
		checkCounter();
	};
	node3.node.connectionEstablished = function () {
		ok(true);
		counter++;
		checkCounter();
	};

	function checkCounter() {
		if (counter === 3) {
			node1.put('hello', 'world', function (response) {
				ok(true);
				console.log(response);
				node2.get('hello', function (response) {
					console.log(response);
					start();
				});
			});	
		}
	}
});

var NUM_NODES_2 = 3;

asyncTest("Test " + NUM_NODES_2 + " nodes DHT connect", function () {
	ok(NUM_NODES_2 >= 3);
	var counter = 0;
	nodes = [];

	var node = new DHT(1000);

	node.node.connectionEstablished = function () {
		ok(true);
		counter++;
		checkCounter();
	};
	nodes.push(node);


	function checkCounter() {
		if (counter === 1) {
			nodes[0].put('hello', 'world', function (response) {
				equal(response.val, "world");

				for (var i = 1; i < NUM_NODES_2; i++) {
					var node = new DHT((i + 1) * 1000);

					nodes.push(node);
				}

				setTimeout(function () {
					nodes[1].get('hello', function (response) {
						equal(response.val, "world");
						nodes[NUM_NODES_2 - 1].disconnect();
						setTimeout(function () {
							nodes[NUM_NODES_2 - 2].get('hello', function (response) {
								equal(response.val, "world");
								start();
								//window.location = window.location;
							});
						}, 2000);
					});
				}, 2000);

				
			});	
		}
	}
});



asyncTest("Test " + NUM_NODES_2 + " nodes DHT disconnect", function () {
	ok(NUM_NODES_2 >= 3);
	var counter = 0;
	nodes = [];
	for (var i = 0; i < NUM_NODES_2; i++) {
		var node = new DHT((i + 1) * 1000);

		node.node.connectionEstablished = function () {
			ok(true);
			counter++;
			checkCounter();
		};
		nodes.push(node);

	}

	function checkCounter() {
		if (counter === NUM_NODES_2) {
			nodes[0].put('hello', 'world', function (response) {
				equal(response.val, "world");
				nodes[1].get('hello', function (response) {
					equal(response.val, "world");
					nodes[NUM_NODES_2 - 1].disconnect();
					setTimeout(function () {
						nodes[NUM_NODES_2 - 2].get('hello', function (response) {
							equal(response.val, "world");
							start();
							//window.location = window.location;
						});
					}, 200);
				});
			});	
		}
	}
});


