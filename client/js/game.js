(function (window) {
	var Game = function () {
		this.store = new DHT();
		var thisStore = this.store;
		var thisGame = this;

		this.store.onready = function () {
			var player_id = thisGame.player_id = Math.floor(Math.random() * 1000000);
			var player_name = "player-" + player_id;
			var location = {
				x: Random.generate() % 1280,
				y: Random.generate() % 800
			};

			thisStore.put("player-" + player_id, location);
			thisStore.get("players", function (players) {
				if (!players) {
					players = [];
				}
				players.push(player_name);
				thisStore.put("players", players);
			});

			thisGame.localState = {};
			thisGame.startMainLoop();

		};

	};


	Game.prototype.startMainLoop = function () {
		var thisStore = this.store;
		if (!this.started) {
			var mainLoop = setInterval(function () {
				thisStore.get("players", function (players) {
					for (var i = 0; i < players.length; i++) {
						thisStore.get(players[i], function (location) {
							console.log(location);
						});
					}
				});

			}, 1000);	
		}

		this.started = true;


	};

	window.Game = Game;

})(window);