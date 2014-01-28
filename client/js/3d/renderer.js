(function (window) {
    var ThreeDRenderer = function (game, dom) {
        this.init(game, dom);
    };

    ThreeDRenderer.prototype.init = function (game, dom) {
        this.game = game;
        this.dom = dom;
        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

        var renderer = new THREE.WebGLRenderer();
        renderer.setSize( window.innerWidth, window.innerHeight );
        dom.appendChild( renderer.domElement );

        var geometry = new THREE.CubeGeometry(1,1,1);
        var material = new THREE.MeshBasicMaterial( { map: THREE.ImageUtils.loadTexture('/img/brick.jpg') } );
        var floorMaterial = new THREE.MeshBasicMaterial( { map: THREE.ImageUtils.loadTexture('/img/floor.jpg') } );
        var cube = new THREE.Mesh( geometry, material );
        scene.add( cube );

        camera.position.x = 0;
        camera.position.y = 0;
        camera.position.z = 5;
        for (var i = 0; i < game.map.length; i++) {
                for (var j = 0; j < game.map[0].length; j++) {
                        var floor = new THREE.Mesh(geometry, floorMaterial);
                        floor.position.x = i;
                        floor.position.z = j;
                        floor.position.y = -1;
                        scene.add(floor);
                        var ceil = new THREE.Mesh(geometry, floorMaterial);
                        ceil.position.x = i;
                        ceil.position.z = j;
                        ceil.position.y = 2;
                        scene.add(ceil);
                        
                        if (game.map[i][j] === "1") {
                            var wall = new THREE.Mesh(geometry, material);
                            wall.position.x = i;
                            wall.position.z = j;
                            wall.position.y = 0;
                            scene.add(wall);
                            var wall = new THREE.Mesh(geometry, material);
                            wall.position.x = i;
                            wall.position.z = j;
                            wall.position.y = 1;
                            scene.add(wall);
                        }
                }
        }

        

        window.addEventListener('resize', function() {
            var WIDTH = window.innerWidth,
              HEIGHT = window.innerHeight;
            renderer.setSize(WIDTH, HEIGHT);
            camera.aspect = WIDTH / HEIGHT;
            camera.updateProjectionMatrix();
        });
        var rotation = 0;


        var loader = new THREE.JSONLoader(); // init the loader util

        // init loading

        var ninjaGeom;
        var ninjaMaterial;
        loader.load('/js/3d/Ninja.js', function (geometry) {
            ninjaGeom = geometry;
            ninjaMaterial = new THREE.MeshBasicMaterial({
                color: 0xAAAAAA
            });

            render();

        });


        var objects = {

        };
        function render() {
            camera.position.x = this.game.location.x;
            camera.position.z = this.game.location.y;
            camera.rotation.y = Math.PI * 2 - this.game.currentDir / 2 * Math.PI;

            for (var i in this.game.cache) {
                if (i.indexOf("player-") !== -1 && i !== "player-" + this.game.player_id) {
                    var player = this.game.cache[i];
                    if (!player) {
                        continue;
                    }
                    var name = i;
                    var playerObj = objects[name] || new THREE.Mesh(
                        ninjaGeom,
                        ninjaMaterial
                    );
                    playerObj.position.x = player.x;
                    playerObj.position.y = 0;
                    playerObj.position.z = player.y;
                    playerObj.rotation.x = - Math.PI / 2;
                    playerObj.rotation.z = player.currentDir / 2 * Math.PI;
                    if (!objects[name]) {
                        scene.add(playerObj);
                        objects[name] = playerObj;
                    }

                }

                if (i.indexOf("bullet-") !== -1) {
                    var bullet = this.game.cache[i];
                    if (!bullet) {
                        continue;
                    }
                    var name = i;
                    var geometry = new THREE.SphereGeometry(1,1,1);
                    var material = new THREE.MeshBasicMaterial( { map: THREE.ImageUtils.loadTexture('/img/brick.jpg') } );
                    var bulletObj = objects[name] || new THREE.Mesh(geometry, material);
                    bulletObj.position.x = bullet.x;
                    bulletObj.position.y = bullet.y;
                    if (!objects[name]) {
                        scene.add(bulletObj);
                        objects[name] = bulletObj;
                    }
                }

            }

            requestAnimationFrame(render);
            renderer.render(scene, camera);


        }

    };



    window.ThreeDRenderer = ThreeDRenderer;


})(window);