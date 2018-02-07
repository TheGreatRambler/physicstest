// Detects webgl
        if (!Detector.webgl) {
            Detector.addGetWebGLMessage();
            document.getElementById('container').innerHTML = "";
        }

        // - Global variables -

        // Heightfield parameters
        var terrainWidthExtents = 500;
        var terrainDepthExtents = 500;
        
        var terrainWidth = 500;
        var terrainDepth = 500;
        
        var terrainmultiplier = 200;
        
        var terrainHalfWidth = terrainWidth / 2;
        var terrainHalfDepth = terrainDepth / 2;
        var terrainMaxHeight = 8;
        var terrainMinHeight = -8;
        
        var gravityvector = new Ammo.btVector3(0, -200, 0);

        // Graphics variables
        var container, stats;
        var camera, scene, renderer;
        var terrainMesh, texture;
        var clock = new THREE.Clock();

        // Physics variables
        var collisionConfiguration;
        var dispatcher;
        var broadphase;
        var solver;
        var physicsWorld;
        var terrainBody;
        var dynamicObjects = [];
        var transformAux1 = new Ammo.btTransform();

        var heightData = null;
        var ammoHeightData = null;
        
        var width = window.innerWidth;
        var height = window.innerHeight;
        
        var playerindex;
        var playerpower = 50;
        
        var distancefromplayercamera = 0;
        var speedofrotation = 2;
        
        var playerphysics;
        
        var keydata = {
            up: false,
            down: false,
            left: false,
            right: false,
            w: false,
            s: false,
            a: false,
            d: false,
            space: false
        };
        
        var clockkeydata = {
            up: new THREE.Clock(),
            down: new THREE.Clock(),
            left: new THREE.Clock(),
            right: new THREE.Clock()
        }

        // - Main code -
        init();
        animate();
        for (var f = 0; f < 10; f++) {
            generateObject({
                type: "sphere",
                radius: 3,
                mass: 1,
                x: 10,
                y: f * 11,
                z: 0,
                material: new THREE.MeshPhongMaterial({ 
                    color: 0x996633, 
                    specular: 0x050505,
                    shininess: 100
                }) 
            });
        }

        function init() {

            heightData = generateHeight(terrainWidth, terrainDepth);

            initGraphics();

            initPhysics();
            
            initplayer();
        }

        function initGraphics() {

            container = document.getElementById('container');

            renderer = new THREE.WebGLRenderer();
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(width, height);
            renderer.shadowMap.enabled = true;

            container.innerHTML = "";

            container.appendChild(renderer.domElement);

            stats = new Stats();
            stats.domElement.style.position = 'absolute';
            stats.domElement.style.top = '0px';
            container.appendChild(stats.domElement);


            camera = new THREE.PerspectiveCamera(60, width / height, 0.2, 2000);

            scene = new THREE.Scene();
            scene.background = new THREE.Color(0xbfd1e5);
            camera.lookAt(new THREE.Vector3(0, 0, 0));
            camera.rotation.order = 'YXZ';
            
            // Start of important terrain part

            var geometry = new THREE.PlaneBufferGeometry(terrainWidthExtents, terrainDepthExtents, terrainWidth - 1, terrainDepth - 1);
            geometry.rotateX(-Math.PI / 2);

            var vertices = geometry.attributes.position.array;

            for (var i = 0, j = 0, l = vertices.length; i < l; i++, j += 3) {

                // j + 1 because it is the y component that we modify
                vertices[j + 1] = heightData[i];

            }
            
            // end of important terrain part

            geometry.computeVertexNormals();

            var groundMaterial = new THREE.MeshPhongMaterial({
                color: 0xC7C7C7
            });
            
            terrainMesh = new THREE.Mesh(geometry, groundMaterial);
            terrainMesh.receiveShadow = true;
            terrainMesh.castShadow = true;

            scene.add(terrainMesh);

            /*
            var textureLoader = new THREE.TextureLoader();
            textureLoader.load("textures/grid.png", function(texture) {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(terrainWidth - 1, terrainDepth - 1);
                groundMaterial.map = texture;
                groundMaterial.needsUpdate = true;
            });
            */

            var light = new THREE.DirectionalLight(0xffffff, 1);
            light.position.set(100, 100, 50);
            light.castShadow = true;
            var dLight = 200;
            var sLight = dLight * 0.25;
            light.shadow.camera.left = -sLight;
            light.shadow.camera.right = sLight;
            light.shadow.camera.top = sLight;
            light.shadow.camera.bottom = -sLight;

            light.shadow.camera.near = dLight / 30;
            light.shadow.camera.far = dLight;

            light.shadow.mapSize.x = 1024 * 2;
            light.shadow.mapSize.y = 1024 * 2;

            scene.add(light);


            window.addEventListener('resize', onWindowResize, false);
        }
        
        function initplayer() {
            var startx = 0;
            var starty = 200;
            var startz = 0;
            var player = generateObject({
                    type: "sphere",
                    radius: 5,
                    x: startx,
                    y: starty,
                    z: startz,
                    mass: 10,
                    material: createObjectMaterial()
                });
            playerindex = player.index;
            playerphysics = player.physicsbody;
        }

        function onWindowResize() {

            camera.aspect = width / height;
            camera.updateProjectionMatrix();

            renderer.setSize(width, height);

        }

        function initPhysics() {

            // Physics configuration

            collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
            dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
            broadphase = new Ammo.btDbvtBroadphase();
            solver = new Ammo.btSequentialImpulseConstraintSolver();
            physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration);
            physicsWorld.setGravity(gravityvector);

            // Create the terrain body

            var groundShape = this.createTerrainShape(heightData);
            var groundTransform = new Ammo.btTransform();
            groundTransform.setIdentity();
            // Shifts the terrain, since bullet re-centers it on its bounding box.
            groundTransform.setOrigin(new Ammo.btVector3(0, (terrainMaxHeight + terrainMinHeight) / 2, 0));
            var groundMass = 0;
            var groundLocalInertia = new Ammo.btVector3(0, 0, 0);
            var groundMotionState = new Ammo.btDefaultMotionState(groundTransform);
            var groundBody = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(groundMass, groundMotionState, groundShape, groundLocalInertia));
            physicsWorld.addRigidBody(groundBody);

        }

        function generateHeight(width, depth) {
            
            var terrain = new betterterrain({freq: 100});

            var size = width * depth;
            var data = new Float32Array(size);

            var p = 0;
            for (var j = 0; j < depth; j++) {
                for (var i = 0; i < width; i++) {
                    var height = terrain.getdata(i, j).h * terrainmultiplier;
                    data[p] = height;

                    p++;
                }
            }

            return data;

        }
        
        window.addEventListener("keydown", function(e) {
            if (e.key === "ArrowLeft") {
                // left arrow
                keydata.left = true;
                e.preventDefault();
            } else if (e.key === "ArrowUp") {
                // up arrow
                keydata.up = true;
                e.preventDefault();
            } else if (e.key === "ArrowRight") {
                // right arrow
                keydata.right = true;
                e.preventDefault();
            } else if (e.key === "ArrowDown") {
                // down arrow
                keydata.down = true;
                e.preventDefault();
            } else if (e.key === 's') {
                keydata.s = true;
            } else if (e.key === 'w') {
                keydata.w = true;
            } else if (e.key === 'a') {
                keydata.a = true;
            } else if (e.key === 'd') {
                keydata.d = true;
            } else if (e.key === "Space") {
                keydata.space = true;
                e.preventDefault();
            }
        });
        
        window.addEventListener("keyup", function(e) {
            if (e.key === "ArrowLeft") {
                // left arrow
                keydata.left = false;
                e.preventDefault();
            } else if (e.key === "ArrowUp") {
                // up arrow
                keydata.up = false;
                e.preventDefault();
            } else if (e.key === "ArrowRight") {
                // right arrow
                keydata.right = false;
                e.preventDefault();
            } else if (e.key === "ArrowDown") {
                // down arrow
                keydata.down = false;
                e.preventDefault();
            } else if (e.key === 's') {
                keydata.s = false;
            } else if (e.key === 'w') {
                keydata.w = false;
            } else if (e.key === 'a') {
                keydata.a = false;
            } else if (e.key === 'd') {
                keydata.d = false;
            } else if (e.key === "Space") {
                keydata.space = false;
                e.preventDefault();
            }
        });
        
        function returnproperdegrees(degree) {
            var degreedecision = degree > 360 ? degree % 360 : degree;
            return degreedecision;
            console.log(degree, degreedecision);
        }
        
        function returnveolocity(angle, power) {
            angle = returnproperdegrees(angle + 180);
            // console.log(angle);
            if (angle === 0) {
                return [0, 0, power * -1];
            } else if (angle < 90) {
                var fraction = angle / 90;
                return [power * fraction * -1, 0, power * (1 - fraction) * -1];
            } else if (angle === 90) {
                return [power, 0, 0];
            } else if (angle < 180) {
                var fraction = (angle - 90) / 90;
                return [power * (1 - fraction) * -1, 0, power * fraction];
            } else if (angle === 180) {
                return [0, 0, power];
            } else if (angle < 270) {
                var fraction = (angle - 180) / 90;
                return [power * fraction, 0, power * (1 - fraction)];
            } else if (angle === 270) {
                return [-power, 0, 0];
            } else if (angle <= 360) {
                var fraction = (angle - 270) / 90;
                return [power * (1 - fraction), 0, power * fraction * -1];
            }
        }

        function createTerrainShape() {

            // This parameter is not really used, since we are using PHY_FLOAT height data type and hence it is ignored
            var heightScale = 1;

            // Up axis = 0 for X, 1 for Y, 2 for Z. Normally 1 = Y is used.
            var upAxis = 1;

            // hdt, height data type. "PHY_FLOAT" is used. Possible values are "PHY_FLOAT", "PHY_UCHAR", "PHY_SHORT"
            var hdt = "PHY_FLOAT";

            // Set this to your needs (inverts the triangles)
            var flipQuadEdges = false;

            // Creates height data buffer in Ammo heap
            ammoHeightData = Ammo._malloc(4 * terrainWidth * terrainDepth);

            // Copy the javascript height data array to the Ammo one.
            var p = 0;
            var p2 = 0;
            for (var j = 0; j < terrainDepth; j++) {
                for (var i = 0; i < terrainWidth; i++) {

                    // write 32-bit float data to memory
                    Ammo.HEAPF32[ammoHeightData + p2 >> 2] = heightData[p];

                    p++;

                    // 4 bytes/float
                    p2 += 4;
                }
            }

            // Creates the heightfield physics shape
            var heightFieldShape = new Ammo.btHeightfieldTerrainShape(
                terrainWidth,
                terrainDepth,
                ammoHeightData,
                heightScale,
                -terrainmultiplier,
                terrainmultiplier,
                upAxis,
                hdt,
                flipQuadEdges
            );

            // Set horizontal scale
            var scaleX = terrainWidthExtents / (terrainWidth - 1);
            var scaleZ = terrainDepthExtents / (terrainDepth - 1);
            heightFieldShape.setLocalScaling(new Ammo.btVector3(scaleX, 1, scaleZ));

            heightFieldShape.setMargin(0.05);

            return heightFieldShape;

        }

        function generateObject(shapedata) {
            
            // shapedata = {}

            var threeObject = null;
            var shape = null;
            
            var margin = 0.05;

            switch (shapedata.type) {
                case "sphere":
                    // Sphere
                    var radius = shapedata.radius;
                    threeObject = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 20), shapedata.material);
                    shape = new Ammo.btSphereShape(radius);
                    shape.setMargin(margin);
                    break;
                case "box":
                    // Box
                    var sx = shapedata.width;
                    var sy = shapedata.height;
                    var sz = shapedata.depth;
                    threeObject = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz, 1, 1, 1), shapedata.material);
                    shape = new Ammo.btBoxShape(new Ammo.btVector3(sx * 0.5, sy * 0.5, sz * 0.5));
                    shape.setMargin(margin);
                    break;
                case "cylinder":
                    // Cylinder
                    var radius = shapedata.radius;
                    var height = shapedata.height;
                    threeObject = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20, 1), shapedata.material);
                    shape = new Ammo.btCylinderShape(new Ammo.btVector3(radius, height * 0.5, radius));
                    shape.setMargin(margin);
                    break;
                case "cone":
                    // Cone
                    var radius = shapedata.radius;
                    var height = shapedata.height;
                    threeObject = new THREE.Mesh(new THREE.CylinderGeometry(0, radius, height, 20, 2), shapedata.material);
                    shape = new Ammo.btConeShape(radius, height);
                    break;
            }

            threeObject.position.set(shapedata.x, shapedata.y, shapedata.z);

            var mass = shapedata.mass;
            var localInertia = new Ammo.btVector3(0, 0, 0);
            shape.calculateLocalInertia(mass, localInertia);
            var transform = new Ammo.btTransform();
            transform.setIdentity();
            var pos = threeObject.position;
            transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
            var motionState = new Ammo.btDefaultMotionState(transform);
            var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
            var body = new Ammo.btRigidBody(rbInfo);

            threeObject.userData.physicsBody = body;

            threeObject.receiveShadow = true;
            threeObject.castShadow = true;

            scene.add(threeObject);
            var index = dynamicObjects.length;
            dynamicObjects.push(threeObject);

            physicsWorld.addRigidBody(body);

            return {threejsobject: threeObject, index: index, physicsbody: body};

        }

        function createObjectMaterial() {
            var c = Math.floor(Math.random() * (1 << 24));
            return new THREE.MeshPhongMaterial({
                color: c
            });
        }

        function animate() {

            requestAnimationFrame(animate);

            render();
            stats.update();

        }

        function render() {

            var deltaTime = clock.getDelta();

            updatePhysics(deltaTime);
            
            updatecamera();
            
            updatelooking();

            renderer.render(scene, camera);

        }
        
        function updatelooking() {
            if (keydata.left) {
                if (THREE.Math.radToDeg(dynamicObjects[playerindex].rotation.y) > 360 - speedofrotation) {
                    camera.rotation.y = THREE.Math.degToRad(THREE.Math.radToDeg(camera.rotation.y) + speedofrotation - 360);
                } else {
                    camera.rotation.y = THREE.Math.degToRad(THREE.Math.radToDeg(camera.rotation.y) + speedofrotation);
                }
                camera.updateProjectionMatrix();
            }
            
            if (keydata.right) {
                if (THREE.Math.radToDeg(camera.rotation.y) < speedofrotation) {
                    camera.rotation.y = THREE.Math.degToRad(THREE.Math.radToDeg(camera.rotation.y) - speedofrotation + 360);
                } else {
                    camera.rotation.y = THREE.Math.degToRad(THREE.Math.radToDeg(camera.rotation.y) - speedofrotation);
                }
                camera.updateProjectionMatrix();
            }
            
            if (keydata.down) {
                if (THREE.Math.radToDeg(camera.rotation.x) < speedofrotation) {
                    camera.rotation.x = THREE.Math.degToRad(THREE.Math.radToDeg(camera.rotation.x) - speedofrotation + 360);
                } else {
                    camera.rotation.x = THREE.Math.degToRad(THREE.Math.radToDeg(camera.rotation.x) - speedofrotation);
                }
                camera.updateProjectionMatrix();
            }
            
            if (keydata.up) {
                if (THREE.Math.radToDeg(camera.rotation.x) > 360 - speedofrotation) {
                    camera.rotation.x = THREE.Math.degToRad(THREE.Math.radToDeg(camera.rotation.x) + speedofrotation - 360);
                } else {
                    camera.rotation.x = THREE.Math.degToRad(THREE.Math.radToDeg(camera.rotation.x) + speedofrotation);
                }
                camera.updateProjectionMatrix();
            }
            
            if (keydata.s) {
                var vector = camera.getWorldDirection();
                var vectordata = returnveolocity(returnproperdegrees(THREE.Math.radToDeg(Math.atan2(vector.x,vector.z)) + 180), playerpower);
                var force = new Ammo.btVector3(vectordata[0], vectordata[1], vectordata[2]);
                playerphysics.setLinearVelocity(force);
            }
            
            if (keydata.w) {
                var vector = camera.getWorldDirection();
                var vectordata = returnveolocity(returnproperdegrees(THREE.Math.radToDeg(Math.atan2(vector.x,vector.z))), playerpower);
                var force = new Ammo.btVector3(vectordata[0], vectordata[1], vectordata[2]);
                playerphysics.setLinearVelocity(force);
            }
            
            if (keydata.d) {
                var vector = camera.getWorldDirection();
                var vectordata = returnveolocity(returnproperdegrees(THREE.Math.radToDeg(Math.atan2(vector.x,vector.z)) + 270), playerpower);
                var force = new Ammo.btVector3(vectordata[0], vectordata[1], vectordata[2]);
                playerphysics.setLinearVelocity(force);
            }
            
            if (keydata.a) {
                var vector = camera.getWorldDirection();
                var vectordata = returnveolocity(returnproperdegrees(THREE.Math.radToDeg(Math.atan2(vector.x,vector.z)) + 90), playerpower);
                var force = new Ammo.btVector3(vectordata[0], vectordata[1], vectordata[2]);
                playerphysics.setLinearVelocity(force);
            }
            
            if (keydata.space) {
                var force = new Ammo.btVector3(0, playerpower / 2, 0);
                playerphysics.setLinearVelocity(force);
            }
        }

        function updatePhysics(deltaTime) {

            physicsWorld.stepSimulation(deltaTime, 10);

            // Update objects
            for (var i = 0, il = dynamicObjects.length; i < il; i++) {
                var objThree = dynamicObjects[i];
                var objPhys = objThree.userData.physicsBody;
                var ms = objPhys.getMotionState();
                if (ms) {
                    ms.getWorldTransform(transformAux1);
                    var p = transformAux1.getOrigin();
                    var q = transformAux1.getRotation();
                    objThree.position.set(p.x(), p.y(), p.z());
                    objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());

                }
            }
        }
        
        function updatecamera() {
            /*
            var vector = camera.getWorldDirection();
            var cameraangle = THREE.Math.radToDeg(Math.atan2(vector.x,vector.z)) + 180;
            var x = distancefromplayercamera * Math.sin(THREE.Math.degToRad(degrees))
            var y = 
            var z = 
            */
            /*
            var heading2 = camera.rotation.x;
            var radians2 = heading2 > 0 ? heading2 : (2 * Math.PI) + heading2;
            var xdeg = returnproperdegrees(THREE.Math.radToDeg(radians2));
            var heading1 = camera.rotation.y;
            var radians1 = heading1 > 0 ? heading1 : (2 * Math.PI) + heading1;
            var ydeg = returnproperdegrees(THREE.Math.radToDeg(radians1));
            var heading3 = camera.rotation.z;
            var radians3 = heading3 > 0 ? heading3 : (2 * Math.PI) + heading3;
            var zdeg = returnproperdegrees(THREE.Math.radToDeg(radians3));
            
            console.log(xdeg, ydeg, zdeg);
            
            var x = distancefromplayercamera * Math.cos(THREE.Math.degToRad(ydeg)) * Math.cos(THREE.Math.degToRad(zdeg));
            var z = distancefromplayercamera * Math.sin(THREE.Math.degToRad(ydeg)) * Math.cos(THREE.Math.degToRad(zdeg));
            var y = distancefromplayercamera * Math.sin(THREE.Math.degToRad(zdeg));
            
            console.log(x, y, z);
            */
            
            var playerobject = dynamicObjects[playerindex];
            camera.position.x = playerobject.position.x;
            camera.position.y = playerobject.position.y;
            camera.position.z = playerobject.position.z;
            camera.updateProjectionMatrix();
        }
