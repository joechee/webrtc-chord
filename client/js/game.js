(function (window) {
	var Game = function (dom) {
		this.store = new DHT();
		var thisStore = this.store;
		var thisGame = this;

		this.map = [
			"111111111111111",
			"100000000000001",
			"100000000000001",
			"100000000000001",
			"100000000000001",
			"100000000000001",
			"100000000000001",
			"100000000000001",
			"100000000000001",
			"100000000000001",
			"100000000000001",
			"100000000000001",
			"100000000000001",
			"111111111111111"
		];



		this.cache = {};

		this.store.onready = function () {
			var player_id = thisGame.player_id = Math.floor(Math.random() * 1000000);
			var player_name = "player-" + player_id;
			thisGame.location = {
				x: Random.generate() % 10 + 2,
				y: Random.generate() % 10 + 2
			};
			var renderer = new ThreeDRenderer(thisGame, dom);
			thisGame.updateLocation(thisGame.location.x, thisGame.location.y);
			thisStore.get("players", function (response) {
				var players = response.val;
				if (!players) {
					players = [];
				}
				players.push(player_name);
				thisStore.put("players", players, function (response) {
				});
			});

			thisGame.localState = {};
			thisGame.startMainLoop();
		};

	};

	Game.prototype.startMainLoop = function () {
		var thisStore = this.store;
		var thisGame = this;
		if (!this.started) {
			var mainLoop = setInterval(function () {
				thisGame.updateLocation(thisGame.location.x, thisGame.location.y);
				thisStore.get("players", function (response) {
					var players = response.val;
					thisGame.cache.players = players;
					if (players) {
						for (var i = 0; i < players.length; i++) {
							(function (i) {
								thisStore.get(players[i], function (response) {
									var location = response.val;
									thisGame.cache[players[i]] = location;
								});
							})(i);
						}
						for (var key in thisGame.cache) {
							if (players.indexOf(key) === -1) {
								delete thisGame.cache[key];
							}
						}
					}
				});
			}, 1);	
		}
		this.started = true;
		this.startKeyboardListeners();
	};

	Game.prototype.updateLocation = function (x, y) {
		if (this.map[x] && this.map[x][y] === "1") {
			return false;
		}
		this.location = {
			x: x,
			y: y,
			currentDir: this.currentDir
		};

		this.store.put("player-" + this.player_id, this.location);
	};

	Game.prototype.startKeyboardListeners = function () {

		var UP = 38;
		var DOWN = 40;
		var LEFT = 37;
		var RIGHT = 39;
		var SPACE = 32;
		var thisGame = this;

		this.currentDir = 0;

		window.addEventListener('keydown', function (e) {
			var currentX = thisGame.location.x;
			var currentY = thisGame.location.y;

			var directions = [
				[0, -1],
				[1, 0],
				[0, 1],
				[-1, 0]
			];
			var currentDirection = directions[thisGame.currentDir];
			switch (e.keyCode) {
				case UP:
					thisGame.updateLocation(currentDirection[0] + currentX, currentDirection[1] + currentY);
					break;
				case DOWN:
					thisGame.updateLocation(currentX - currentDirection[0], currentY - currentDirection[1]);
					break;
				case LEFT:
					thisGame.currentDir--;
					thisGame.currentDir = modulo(thisGame.currentDir, 4);
					break;
				case RIGHT:
					thisGame.currentDir++;
					thisGame.currentDir = modulo(thisGame.currentDir, 4);
					break;
				case SPACE:
					thisGame.shoot();
					break;
				default:
					console.log(e.keyCode);
					break;
			}
		})
	};

	Game.prototype.getPlayers = function (callback) {
		this.store.get("players", function (response) {
			console.log(response.val);
		});
	};

	Game.prototype.shoot = function () {
		this.bullet = {
			x: this.location.x,
			y: this.location.y
		}
	};

	window.Game = Game;

})(window);