// Original local Three.js scene for the coastal cycling game.
var PelicanBikeScene = (function () {
  "use strict";

  function create(mount, course) {
    var T = window.PELICAN_THREE;
    if (!T) throw new Error("Local 3D library did not load");
    var mobile = window.matchMedia("(max-width: 760px)").matches;
    var renderer = new T.WebGLRenderer({ antialias: !mobile, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.7));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = !mobile;
    renderer.shadowMap.type = T.PCFShadowMap;
    renderer.domElement.className = "pelican-3d-canvas";
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-label", mount.dataset.canvasLabel || "3D coastal cycling game");
    mount.appendChild(renderer.domElement);

    var scene = new T.Scene();
    scene.background = new T.Color("#e3b0a0");
    scene.fog = new T.Fog("#e3b0a0", 38, 150);
    var skyUniforms = {
      topColor: { value: new T.Color("#7d99a6") },
      horizonColor: { value: new T.Color("#f0bba0") }
    };
    var sky = new T.Mesh(new T.SphereGeometry(185, 32, 16), new T.ShaderMaterial({
      uniforms: skyUniforms, side: T.BackSide, depthWrite: false,
      vertexShader: "varying vec3 vDirection; void main(){ vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform vec3 topColor; uniform vec3 horizonColor; varying vec3 vDirection; void main(){ float h = smoothstep(-0.12, 0.6, normalize(vDirection).y); gl_FragColor = vec4(mix(horizonColor, topColor, h), 1.0); }"
    }));
    sky.renderOrder = -1000;
    scene.add(sky);
    var camera = new T.PerspectiveCamera(56, 1, 0.1, 230);
    var hemi = new T.HemisphereLight("#d6ecff", "#70544d", 2.0);
    scene.add(hemi);
    var sunLight = new T.DirectionalLight("#fff1d4", 2.5);
    sunLight.position.set(-20, 28, -35);
    sunLight.castShadow = !mobile;
    if (!mobile) {
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.left = -14; sunLight.shadow.camera.right = 14;
      sunLight.shadow.camera.top = 14; sunLight.shadow.camera.bottom = -14;
      sunLight.shadow.camera.near = 1; sunLight.shadow.camera.far = 100;
      sunLight.shadow.bias = -0.0005;
    }
    scene.add(sunLight, sunLight.target);
    var moonLight = new T.DirectionalLight("#aabfff", 0);
    moonLight.position.set(22, 20, -35);
    scene.add(moonLight);
    var sunBall = new T.Mesh(new T.SphereGeometry(5, 24, 16), new T.MeshBasicMaterial({ color: "#ffe1a2", fog: false }));
    sunBall.position.set(55, 22, -130);
    scene.add(sunBall);
    var moonBall = new T.Mesh(new T.SphereGeometry(3.1, 24, 16), new T.MeshBasicMaterial({ color: "#e4edff", fog: false }));
    moonBall.position.set(50, 29, -130);
    scene.add(moonBall);
    var cloudMat = new T.MeshBasicMaterial({ color: "#fff0dc", transparent: true, opacity: .43, depthWrite: false, fog: false });
    var clouds = [];
    for (var ci = 0; ci < 9; ci++) {
      var cloud = new T.Group();
      cloud.position.set(-70 + ci * 19, 15 + (ci % 3) * 4, -105 - (ci % 2) * 20);
      scene.add(cloud);
      var puff = new T.Mesh(new T.SphereGeometry(1, 12, 8), cloudMat);
      puff.scale.set(7 + ci % 3, .65, 1.7); cloud.add(puff);
      var puff2 = new T.Mesh(new T.SphereGeometry(1, 12, 8), cloudMat);
      puff2.scale.set(4, .45, 1.2); puff2.position.set(4.5, -.35, 1.2); cloud.add(puff2);
      clouds.push(cloud);
    }
    var starPositions = [];
    var random = mulberry32(73421);
    for (var star = 0; star < 170; star++) {
      starPositions.push((random() - .5) * 205, 28 + random() * 80, -35 - random() * 140);
    }
    var starGeometry = new T.BufferGeometry();
    starGeometry.setAttribute("position", new T.Float32BufferAttribute(starPositions, 3));
    var starMaterial = new T.PointsMaterial({ color: "#ffffff", size: .45, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, fog: false });
    scene.add(new T.Points(starGeometry, starMaterial));

    var mat = {
      road: new T.MeshStandardMaterial({ color: "#35424b", roughness: .98 }),
      sand: new T.MeshStandardMaterial({ color: "#dfc59a", roughness: 1 }),
      grass: new T.MeshStandardMaterial({ color: "#71916a", roughness: 1 }),
      curb: new T.MeshStandardMaterial({ color: "#efeee3", roughness: .85 }),
      roadLine: new T.MeshBasicMaterial({ color: "#f3e8cc" }),
      roadEdge: new T.MeshBasicMaterial({ color: "#f8f6ee" }),
      frame: new T.MeshStandardMaterial({ color: "#ec8064", metalness: .45, roughness: .33 }),
      dark: new T.MeshStandardMaterial({ color: "#263e49", metalness: .28, roughness: .46 }),
      metal: new T.MeshStandardMaterial({ color: "#b5cbd0", metalness: .8, roughness: .27 }),
      tire: new T.MeshStandardMaterial({ color: "#1b2632", roughness: .86 }),
      feather: new T.MeshStandardMaterial({ color: "#fff9ea", roughness: .88 }),
      wing: new T.MeshStandardMaterial({ color: "#d8e0d5", roughness: .92 }),
      beak: new T.MeshStandardMaterial({ color: "#e7ad63", roughness: .5 }),
      pouch: new T.MeshStandardMaterial({ color: "#f3bf7c", roughness: .67 }),
      eye: new T.MeshStandardMaterial({ color: "#183443", roughness: .2 }),
      helmet: new T.MeshStandardMaterial({ color: "#227b86", metalness: .25, roughness: .3 }),
      scarf: new T.MeshStandardMaterial({ color: "#d94d52", side: T.DoubleSide, roughness: .75 }),
      trunk: new T.MeshStandardMaterial({ color: "#816850", roughness: 1 }),
      leaf: new T.MeshStandardMaterial({ color: "#4f8469", roughness: 1, flatShading: true }),
      palm: new T.MeshStandardMaterial({ color: "#4f8064", side: T.DoubleSide, roughness: 1 }),
      water: new T.MeshStandardMaterial({ color: "#438eac", metalness: .22, roughness: .35, side: T.DoubleSide, flatShading: true }),
      foam: new T.MeshBasicMaterial({ color: "#f3e9df", transparent: true, opacity: .72 }),
      lamp: new T.MeshStandardMaterial({ color: "#fbd38a", emissive: "#ffbb65", emissiveIntensity: .45 }),
      fish: new T.MeshStandardMaterial({ color: "#f5d078", metalness: .45, roughness: .25, emissive: "#9d5915", emissiveIntensity: .22 }),
      fishGold: new T.MeshStandardMaterial({ color: "#ffe38a", metalness: .75, roughness: .19, emissive: "#ffad35", emissiveIntensity: .65 }),
      crate: new T.MeshStandardMaterial({ color: "#ac6e47", roughness: .9 }),
      stripe: new T.MeshStandardMaterial({ color: "#e3a979", roughness: .9 }),
      gull: new T.MeshStandardMaterial({ color: "#f4efe1", roughness: .85 }),
    };

    function mesh(geometry, material, parent, x, y, z) {
      var object = new T.Mesh(geometry, material);
      object.position.set(x || 0, y || 0, z || 0);
      parent.add(object);
      return object;
    }
    function ball(parent, x, y, z, sx, sy, sz, material, detail) {
      var object = mesh(new T.SphereGeometry(1, detail || 16, 12), material, parent, x, y, z);
      object.scale.set(sx, sy, sz);
      object.castShadow = !mobile;
      return object;
    }
    function rod(parent, ax, ay, az, bx, by, bz, radius, material, sides) {
      var a = new T.Vector3(ax, ay, az), b = new T.Vector3(bx, by, bz);
      var direction = new T.Vector3().subVectors(b, a);
      var object = mesh(new T.CylinderGeometry(radius, radius, direction.length(), sides || 8), material, parent);
      object.position.copy(a).add(b).multiplyScalar(.5);
      object.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize());
      object.castShadow = !mobile;
      return object;
    }
    function plane(parent, width, depth, x, y, z, material) {
      var object = mesh(new T.PlaneGeometry(width, depth), material, parent, x, y, z);
      object.rotation.x = -Math.PI / 2;
      object.receiveShadow = !mobile;
      return object;
    }

    // The coast is intentionally asymmetric: low-poly woodland on the left,
    // sand, breaking surf and an open ocean on the right.
    plane(scene, 9, 160, 0, -.014, -53, mat.road);
    plane(scene, 55, 160, -32, -.08, -53, mat.grass);
    plane(scene, 5, 160, 7, -.07, -53, mat.sand);
    for (var edge of [-4.48, 4.48]) {
      plane(scene, .07, 160, edge, .014, -53, mat.roadEdge);
      var curb = mesh(new T.BoxGeometry(.23, .13, 160), mat.curb, scene, edge + (edge < 0 ? -.19 : .19), .02, -53);
      curb.receiveShadow = !mobile;
    }
    var marks = [];
    for (var l of [-1.5, 1.5]) for (var n = 0; n < 24; n++) {
      marks.push(plane(scene, .065, 2.6, l, .014, -n * 6, mat.roadLine));
    }
    var shadow = plane(scene, 3, 1.9, 0, .022, 2, new T.MeshBasicMaterial({ color: "#10242c", transparent: true, opacity: .15, depthWrite: false }));

    // Lightweight CPU waves, with shore foam placed over the animated mesh.
    var seaColumns = mobile ? 18 : 28, seaRows = mobile ? 36 : 50;
    var seaVertices = [], seaIndices = [];
    for (var iz = 0; iz <= seaRows; iz++) for (var ix = 0; ix <= seaColumns; ix++) {
      seaVertices.push(9.5 + ix * 2.0, -.15, 20 - iz * 3.1);
    }
    for (var row = 0; row < seaRows; row++) for (var col = 0; col < seaColumns; col++) {
      var k = row * (seaColumns + 1) + col;
      seaIndices.push(k, k + 1, k + seaColumns + 1, k + 1, k + seaColumns + 2, k + seaColumns + 1);
    }
    var seaGeometry = new T.BufferGeometry();
    seaGeometry.setAttribute("position", new T.Float32BufferAttribute(seaVertices, 3));
    seaGeometry.setIndex(seaIndices); seaGeometry.computeVertexNormals();
    mesh(seaGeometry, mat.water, scene);
    var foamBands = [];
    for (var fb = 0; fb < 13; fb++) {
      var foam = plane(scene, .08 + random() * .25, 2.1 + random() * 2.7, 9.55 + random() * 1.3, .02, -fb * 11, mat.foam);
      foam.rotation.z = (random() - .5) * .4;
      foamBands.push(foam);
    }

    function makeTree(x, z, seed) {
      var tree = new T.Group(); tree.position.set(x, 0, z); scene.add(tree);
      var tall = 1.7 + seed * 1.8;
      rod(tree, 0, 0, 0, 0, tall, 0, .12 + seed * .06, mat.trunk, 7);
      ball(tree, 0, tall + .1, 0, .7 + seed * .42, .95 + seed * .42, .7 + seed * .42, mat.leaf, 7);
      ball(tree, -.48, tall - .05, .15, .42, .57, .42, mat.leaf, 6);
      return tree;
    }
    function makePalm(x, z, seed) {
      var palm = new T.Group(); palm.position.set(x, 0, z); scene.add(palm);
      var tall = 2.4 + seed * 1.3;
      rod(palm, 0, 0, 0, -.25, tall * .55, .12, .13, mat.trunk, 7);
      rod(palm, -.25, tall * .55, .12, -.35, tall, -.12, .09, mat.trunk, 7);
      for (var i = 0; i < 6; i++) {
        var angle = i * Math.PI / 3;
        var span = 1.4 + seed * .3;
        rod(palm, -.35, tall, -.12, -.35 + Math.cos(angle) * span * .5, tall + .22, -.12 + Math.sin(angle) * span * .5, .025, mat.palm, 5);
        var leaf = ball(palm, -.35 + Math.cos(angle) * span * .8, tall + .07, -.12 + Math.sin(angle) * span * .8, .16, .035, .95, mat.palm, 7);
        leaf.rotation.y = -angle;
        leaf.rotation.x = -.17;
      }
      return palm;
    }
    function makeLamp(x, z) {
      var lampGroup = new T.Group(); lampGroup.position.set(x, 0, z); scene.add(lampGroup);
      rod(lampGroup, 0, 0, 0, 0, 4.3, 0, .055, mat.dark);
      rod(lampGroup, 0, 4.3, 0, x < 0 ? .65 : -.65, 4.3, 0, .04, mat.dark);
      ball(lampGroup, x < 0 ? .65 : -.65, 4.2, 0, .14, .1, .22, mat.lamp, 10);
      return lampGroup;
    }
    var decor = [];
    for (var ti = 0; ti < 30; ti++) {
      decor.push({ object: makeTree(-6.3 - random() * 12, -ti * 6.8, random()), base: ti * 6.8, cycle: 210 });
    }
    for (var pi = 0; pi < 18; pi++) {
      decor.push({ object: makePalm(7.9 + random() * 2, -pi * 11.4, random()), base: pi * 11.4, cycle: 215 });
    }
    for (var li = 0; li < 11; li++) {
      decor.push({ object: makeLamp(li % 2 ? 5.4 : -5.4, -li * 20), base: li * 20, cycle: 220 });
    }

    // The destination is a real landmark that approaches during the final stretch.
    var lighthouse = new T.Group(); scene.add(lighthouse);
    lighthouse.position.x = 13.2;
    var tower = mesh(new T.CylinderGeometry(.78, 1.25, 7.8, 18), mat.feather, lighthouse, 0, 4, 0);
    tower.castShadow = !mobile;
    for (var stripeY of [1.6, 4.0, 6.2]) {
      mesh(new T.CylinderGeometry(stripeY < 2 ? 1.13 : stripeY < 5 ? .96 : .82,
        stripeY < 2 ? 1.17 : stripeY < 5 ? 1.0 : .85, .55, 18), mat.frame, lighthouse, 0, stripeY, 0);
    }
    mesh(new T.CylinderGeometry(1.08, 1.08, .28, 18), mat.dark, lighthouse, 0, 8.03, 0);
    var beacon = mesh(new T.CylinderGeometry(.69, .72, 1.05, 18), mat.lamp, lighthouse, 0, 8.63, 0);
    beacon.material = new T.MeshStandardMaterial({ color: "#ffe4aa", emissive: "#ffbb65", emissiveIntensity: 2.2, transparent: true, opacity: .88 });
    mesh(new T.ConeGeometry(1.1, .85, 18), mat.dark, lighthouse, 0, 9.52, 0);
    var beaconGlow = ball(lighthouse, 0, 8.65, 0, 1.4, 1.4, 1.4,
      new T.MeshBasicMaterial({ color: "#fff3cb", transparent: true, opacity: .15, depthWrite: false }), 14);
    mesh(new T.BoxGeometry(.9, 1.8, .12), mat.dark, lighthouse, 0, 1.15, 1.08);
    var finishStripe = plane(scene, 9, 1.3, 0, .018, -140, mat.roadEdge);

    // Bicycle and rider: each part is a real 3D mesh, with rotating wheels,
    // animated legs, a moving scarf and a readable pelican silhouette.
    var rider = new T.Group(); rider.position.z = 2; scene.add(rider);
    var bicycle = new T.Group(); rider.add(bicycle);
    var wheels = [];
    function makeWheel(z) {
      var wheel = new T.Group(); wheel.position.set(0, .55, z); bicycle.add(wheel);
      var tire = mesh(new T.TorusGeometry(.52, .055, 8, 48), mat.tire, wheel);
      tire.rotation.y = Math.PI / 2;
      var rim = mesh(new T.TorusGeometry(.46, .018, 6, 48), mat.metal, wheel);
      rim.rotation.y = Math.PI / 2;
      for (var i = 0; i < 12; i++) {
        var a = i * Math.PI / 6;
        rod(wheel, 0, 0, 0, 0, Math.sin(a) * .46, Math.cos(a) * .46, .008, mat.metal, 5);
      }
      ball(wheel, 0, 0, 0, .06, .06, .06, mat.dark, 8);
      wheels.push(wheel);
    }
    makeWheel(.86); makeWheel(-.84);
    var rear = [0, .55, .86], front = [0, .55, -.84], crank = [0, .67, .12], saddle = [0, 1.33, .45], headTube = [0, 1.43, -.56];
    for (var pair of [[rear,saddle],[saddle,crank],[crank,rear],[crank,headTube],[headTube,saddle],[headTube,front]]) {
      rod(bicycle, ...pair[0], ...pair[1], .037, mat.frame, 9);
    }
    rod(bicycle, 0, 1.33, .45, 0, 1.46, .45, .04, mat.metal);
    ball(bicycle, 0, 1.47, .49, .24, .055, .14, mat.dark, 12);
    rod(bicycle, 0, 1.43, -.56, 0, 1.66, -.62, .04, mat.metal);
    rod(bicycle, -.3, 1.65, -.63, .3, 1.65, -.63, .035, mat.dark);
    var basket = mesh(new T.CylinderGeometry(.31, .23, .28, 12, 1, true), new T.MeshStandardMaterial({ color: "#a47957", side: T.DoubleSide, roughness: 1 }), bicycle, 0, 1.38, -.94);
    basket.castShadow = !mobile;
    plane(bicycle, .46, .43, 0, 1.22, -.94, mat.trunk);
    // Rider anatomy.
    ball(rider, 0, 1.69, .36, .37, .33, .52, mat.feather, 22);
    ball(rider, 0, 1.73, .03, .26, .3, .3, mat.feather, 18);
    ball(rider, 0, 2.03, -.07, .19, .39, .19, mat.feather, 16);
    ball(rider, 0, 2.44, -.18, .16, .31, .16, mat.feather, 16);
    ball(rider, 0, 2.69, -.26, .245, .22, .25, mat.feather, 20);
    ball(rider, 0, 2.51, -.74, .18, .14, .43, mat.pouch, 18);
    var beak = mesh(new T.ConeGeometry(.14, .9, 16), mat.beak, rider, 0, 2.64, -.79);
    beak.rotation.x = -Math.PI / 2;
    for (var eyeX of [-.2, .2]) {
      ball(rider, eyeX, 2.74, -.34, .036, .044, .036, mat.eye, 10);
      ball(rider, eyeX * 1.03, 2.755, -.365, .009, .012, .009, mat.feather, 6);
      ball(rider, eyeX * 1.15, 2.71, -.39, .08, .075, .047, mat.dark, 10);
      var wing = ball(rider, eyeX * 1.7, 1.78, .31, .12, .17, .31, mat.wing, 12);
      wing.rotation.x = -.25;
    }
    var helmet = ball(rider, 0, 2.84, -.22, .27, .12, .26, mat.helmet, 18);
    helmet.rotation.x = -.22;
    rod(rider, -.3, 2.23, -.11, .3, 2.23, -.11, .027, mat.scarf);
    var scarfSegments = [];
    for (var si = 0; si < 5; si++) {
      var segment = mesh(new T.BoxGeometry(.2 - si * .015, .055, .21), mat.scarf, rider, 0, 2.22, .2 + si * .2);
      scarfSegments.push(segment);
    }
    var thighs = [], shins = [], feet = [];
    for (var leg = 0; leg < 2; leg++) {
      var lx = leg ? .17 : -.17;
      thighs.push(rod(rider, lx, 1.48, .5, lx, 1.02, .2, .07, mat.pouch));
      shins.push(rod(rider, lx, 1.02, .2, lx, .72, .12, .055, mat.pouch));
      feet.push(ball(rider, lx, .72, .12, .085, .04, .15, mat.beak, 10));
    }
    function alignRod(object, a, b) {
      var direction = new T.Vector3().subVectors(b, a);
      object.position.copy(a).add(b).multiplyScalar(.5);
      object.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.clone().normalize());
      object.scale.y = direction.length() / object.geometry.parameters.height;
    }

    function makeFish(golden) {
      var g = new T.Group();
      var material = golden ? mat.fishGold : mat.fish;
      ball(g, 0, 0, 0, .3, .18, .15, material, 12);
      var tail = mesh(new T.ConeGeometry(.18, .28, 4), material, g, 0, 0, .35);
      tail.rotation.x = Math.PI / 2;
      ball(g, -.12, .06, -.2, .025, .025, .025, mat.eye, 6);
      var ring = mesh(new T.TorusGeometry(.39, .022, 5, 30), golden ? mat.fishGold : mat.metal, g);
      ring.rotation.y = Math.PI / 2;
      return g;
    }
    function makeCrate() {
      var g = new T.Group();
      var box = mesh(new T.BoxGeometry(.9, .65, .8), mat.crate, g, 0, .34, 0);
      box.castShadow = !mobile;
      rod(g, -.45, .1, -.41, .45, .6, -.41, .035, mat.stripe, 5);
      rod(g, .45, .1, -.41, -.45, .6, -.41, .035, mat.stripe, 5);
      return g;
    }
    function makeGull() {
      var g = new T.Group();
      ball(g, 0, 1.75, 0, .26, .15, .2, mat.gull, 12);
      var leftWing = ball(g, -.32, 1.82, 0, .35, .04, .12, mat.gull, 10);
      leftWing.rotation.z = -.25;
      var rightWing = ball(g, .32, 1.82, 0, .35, .04, .12, mat.gull, 10);
      rightWing.rotation.z = .25;
      var bill = mesh(new T.ConeGeometry(.065, .26, 7), mat.beak, g, 0, 1.72, .23);
      bill.rotation.x = Math.PI / 2;
      g.userData.wings = [leftWing, rightWing];
      return g;
    }
    var objects = [];
    for (var entity of course) {
      var object = entity.type === "fish" ? makeFish(entity.golden) : entity.kind === "gull" ? makeGull() : makeCrate();
      object.visible = false;
      scene.add(object);
      objects.push({ data: entity, object: object });
    }

    var skyDay = new T.Color("#e4c1ad"), skyNight = new T.Color("#101b37"), skyDusk = new T.Color("#bd8c91");
    var seaDay = new T.Color("#3899b3"), seaNight = new T.Color("#163657");
    var cameraTarget = new T.Vector3();
    var clock = 0, wheelAngle = 0, lastTravel = 0;
    function resize() {
      var width = Math.max(1, mount.clientWidth), height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    var resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (resizeObserver) resizeObserver.observe(mount);
    window.addEventListener("resize", resize);
    resize();

    function update(view, dt) {
      clock += dt;
      var travel = view.travel || 0;
      lighthouse.position.z = 2 - (600 - travel);
      lighthouse.visible = lighthouse.position.z > -145;
      beaconGlow.scale.setScalar(1.3 + Math.sin(clock * 3) * .15);
      finishStripe.position.z = lighthouse.position.z;
      finishStripe.visible = lighthouse.visible;
      var deltaTravel = Math.max(0, travel - lastTravel);
      lastTravel = travel;
      wheelAngle -= deltaTravel / .52;
      wheels[0].rotation.x = wheelAngle;
      wheels[1].rotation.x = wheelAngle;
      rider.position.x += (view.x - rider.position.x) * Math.min(1, dt * 10);
      rider.position.y = view.jump + Math.sin(clock * (2 + view.speed * .16)) * .013;
      rider.rotation.z += ((view.x - rider.position.x) * -.08 - rider.rotation.z) * Math.min(1, dt * 8);
      rider.rotation.x = view.trick ? -.19 : 0;
      shadow.position.x = rider.position.x;
      shadow.material.opacity = Math.max(.04, .15 - view.jump * .08);
      shadow.scale.setScalar(1 + view.jump * .12);
      for (var wi = 0; wi < scarfSegments.length; wi++) {
        var seg = scarfSegments[wi];
        seg.position.x = Math.sin(clock * 6 - wi * .7) * (.04 + wi * .02);
        seg.position.y = 2.22 + Math.sin(clock * 7 - wi * .48) * .045;
        seg.rotation.y = Math.sin(clock * 5 - wi * .6) * .18;
      }
      for (var legIndex = 0; legIndex < 2; legIndex++) {
        var side = legIndex ? 1 : -1;
        var hip = new T.Vector3(side * .17, 1.47, .47);
        var pedalAngle = wheelAngle * .6 + legIndex * Math.PI;
        var foot = new T.Vector3(side * .17, .68 + Math.sin(pedalAngle) * .16, .12 + Math.cos(pedalAngle) * .17);
        var knee = new T.Vector3(side * .19, 1.06 + Math.sin(pedalAngle) * .1, .24 + Math.cos(pedalAngle) * .13);
        alignRod(thighs[legIndex], hip, knee);
        alignRod(shins[legIndex], knee, foot);
        feet[legIndex].position.copy(foot);
      }
      var offset = travel % 144;
      for (var mi = 0; mi < marks.length; mi++) {
        marks[mi].position.z = 12 - (((mi % 24) * 6 - offset + 144) % 144);
      }
      for (var decorItem of decor) {
        decorItem.object.position.z = 12 - ((decorItem.base - travel + decorItem.cycle * 1000) % decorItem.cycle);
      }
      for (var band = 0; band < foamBands.length; band++) {
        foamBands[band].position.z = 12 - ((band * 11 - travel * .8 + 16000) % 154);
        foamBands[band].position.x = 9.6 + Math.sin(clock * 1.2 + band) * .35;
      }
      var seaPosition = seaGeometry.attributes.position;
      for (var v = 0; v < seaPosition.count; v++) {
        var sx = seaPosition.getX(v), sz = seaPosition.getZ(v);
        var amplitude = Math.min(.38, (sx - 9) * .023);
        seaPosition.setY(v, -.18 + Math.sin(sx * .42 + clock * 1.7) * amplitude + Math.sin(sz * .24 - clock * 1.2) * .075);
      }
      seaPosition.needsUpdate = true;
      if (Math.floor(clock * 12) % 3 === 0) seaGeometry.computeVertexNormals();
      for (var entry of objects) {
        var distance = entry.data.at - travel;
        var object = entry.object;
        object.visible = !entry.data.taken && distance > -9 && distance < 125;
        if (!object.visible) continue;
        object.position.set(entry.data.lane * 3, entry.data.type === "fish" ? (entry.data.golden ? 1.7 : 1.1) + Math.sin(clock * 4 + entry.data.at) * .11 : 0, 2 - distance);
        if (entry.data.type === "fish") object.rotation.y = clock * 1.8;
        else if (entry.data.kind === "gull") {
          object.position.y = Math.sin(clock * 5 + entry.data.at) * .13;
          object.userData.wings[0].rotation.z = -.25 + Math.sin(clock * 11) * .33;
          object.userData.wings[1].rotation.z = .25 - Math.sin(clock * 11) * .33;
        }
      }
      var hour = view.hour || 17.5;
      var night = Math.max(0, Math.min(1, (hour - 18.7) / 2.3));
      var dusk = Math.max(0, Math.min(1, (hour - 17.5) / 1.8));
      scene.background.copy(skyDay).lerp(skyDusk, dusk).lerp(skyNight, night);
      scene.fog.color.copy(scene.background);
      skyUniforms.topColor.value.set("#7d99a6").lerp(new T.Color("#514e75"), dusk).lerp(new T.Color("#11172f"), night);
      skyUniforms.horizonColor.value.set("#f0bba0").lerp(new T.Color("#c78085"), dusk).lerp(new T.Color("#344263"), night);
      cloudMat.opacity = .43 * (1 - night * .72);
      for (var ci = 0; ci < clouds.length; ci++) clouds[ci].position.x = -70 + ci * 19 + Math.sin(clock * .08 + ci) * 3;
      hemi.intensity = 1.9 - night * 1.15;
      sunLight.intensity = 2.6 * (1 - night);
      moonLight.intensity = night * 1.6;
      sunBall.position.y = 22 - (hour - 17.5) * 9;
      sunBall.visible = night < .35;
      moonBall.visible = night > .3;
      starMaterial.opacity = Math.max(0, night - .28) * .9;
      mat.water.color.copy(seaDay).lerp(seaNight, night);
      mat.lamp.emissiveIntensity = .35 + night * 2.4;
      renderer.toneMappingExposure = 1.22 + night * .38;
      var focusX = rider.position.x;
      var mode = view.camera || "chase";
      if (mode === "side") {
        cameraTarget.set(focusX + 7.3, 3.1, 7.6);
      } else if (mode === "front") {
        cameraTarget.set(focusX - 3.6, 3.1, -8.2);
      } else {
        cameraTarget.set(focusX + 4.1, 3.7, 10.3);
      }
      camera.position.lerp(cameraTarget, Math.min(1, dt * 3.3));
      camera.lookAt(focusX, 1.4 + view.jump * .25, mode === "side" ? .7 : mode === "front" ? 1.2 : -3.4);
      renderer.render(scene, camera);
    }
    function dispose() {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      var geometries = new Set(), materials = new Set();
      scene.traverse(function (object) {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach(function (m) { materials.add(m); });
          else materials.add(object.material);
        }
      });
      geometries.forEach(function (g) { g.dispose(); });
      materials.forEach(function (m) { m.dispose(); });
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode) renderer.domElement.remove();
    }
    return { update: update, resize: resize, dispose: dispose };
  }
  function mulberry32(seed) {
    return function () {
      var t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  return { create: create };
})();
