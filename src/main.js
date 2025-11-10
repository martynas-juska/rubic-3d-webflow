import * as THREE from 'three';

class RubiksCube3D {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);

    if (!this.container) {
      console.error(`Container with ID "${containerId}" not found.`);
      return;
    }

    this.canvas = this.container.querySelector('#webgl-canvas');

    if (!this.canvas) {
      console.error('Canvas not found inside container.');
      return;
    }

    this.isVisible = false;
    this.isInitialized = false;
    this.animationId = null;
    this.time = 0;
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.autoRotate = true;
    this.rotationVelocity = { x: 0, y: 0 }; // ← NEW for damping

    this.animate = this.animate.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

    this.init();
    this.setupEventListeners();
    this.setupIntersectionObserver();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.scene.fog = null;

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    this.camera.position.set(3, 3, 5.5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });

    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.5;

    this.setupLights();
    this.createRubiksCube();

    // prevent oversized scale on big local viewports
    const scaleFactor = Math.min(this.container.clientWidth, this.container.clientHeight) / 500;
    this.cubeGroup.scale.setScalar(Math.min(scaleFactor, 1));

    this.createGround();
    this.setupEnvironment();

    this.isInitialized = true;
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0x3d5a7a, 0.4);
    this.scene.add(ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xffeaa7, 2.0);
    this.keyLight.position.set(5, 6, 4);
    this.keyLight.castShadow = true;
    this.scene.add(this.keyLight);

    const fillLight = new THREE.DirectionalLight(0x74b9ff, 1.4);
    fillLight.position.set(-6, 3, 3);
    this.scene.add(fillLight);

    const rimLight = new THREE.SpotLight(0x60a5fa, 4.8, 15, Math.PI / 4, 0.3);
    rimLight.position.set(-3, 4, -5);
    this.scene.add(rimLight);

    const accentLight1 = new THREE.PointLight(0x3b82f6, 4.0, 10);
    accentLight1.position.set(-4, 0, 4);
    this.scene.add(accentLight1);

    const accentLight2 = new THREE.PointLight(0xffa726, 2.5, 10);
    accentLight2.position.set(5, 2, 3);
    this.scene.add(accentLight2);

    const topLight = new THREE.PointLight(0xdfe6e9, 1.0, 12);
    topLight.position.set(0, 8, 0);
    this.scene.add(topLight);

    const frontLight = new THREE.DirectionalLight(0xb2bec3, 0.8);
    frontLight.position.set(0, 2, 6);
    this.scene.add(frontLight);

    this.movingLight = new THREE.PointLight(0x60a5fa, 2.0, 12);
    this.movingLight.position.set(4, 2, 0);
    this.scene.add(this.movingLight);
  }

  createRubiksCube() {
    this.cubeGroup = new THREE.Group();

    const steelMaterial = new THREE.MeshStandardMaterial({
      color: 0xbababa,
      metalness: 0.95,
      roughness: 0.18,
      envMapIntensity: 2.5
    });

    const darkSteelMaterial = new THREE.MeshStandardMaterial({
      color: 0x505050,
      metalness: 0.95,
      roughness: 0.22,
      envMapIntensity: 2.2
    });

    const cubeSize = 0.9;
    const gap = 0.06;
    const totalSize = cubeSize + gap;

    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
          const material =
            (x === 1 && y === 1 && z === 1) || (x !== 1 && y !== 1 && z !== 1)
              ? darkSteelMaterial
              : steelMaterial;

          const cube = new THREE.Mesh(geometry, material);
          cube.position.set((x - 1) * totalSize, (y - 1) * totalSize, (z - 1) * totalSize);
          cube.castShadow = true;
          cube.receiveShadow = true;

          this.cubeGroup.add(cube);

          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(geometry),
            new THREE.LineBasicMaterial({ color: 0x0a0a0a })
          );
          cube.add(edges);
        }
      }
    }

    this.cubeGroup.rotation.set(-1, 0.7, -0.2);
    this.targetRotationX = this.cubeGroup.rotation.x;
    this.targetRotationY = this.cubeGroup.rotation.y;
    this.scene.add(this.cubeGroup);
  }

  createGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.ShadowMaterial({ opacity: 0.0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.5;
    ground.receiveShadow = false;
    this.scene.add(ground);
  }

  setupEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    const envMesh = new THREE.Mesh(
      new THREE.SphereGeometry(500, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide })
    );
    envScene.add(envMesh);
    this.scene.environment = pmrem.fromScene(envScene).texture;
    pmrem.dispose();
  }

  setupEventListeners() {
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.autoRotate = false;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
      this.rotationVelocity = { x: 0, y: 0 };
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;

      const dx = e.clientX - this.previousMousePosition.x;
      const dy = e.clientY - this.previousMousePosition.y;

      this.targetRotationY += dx * 0.005;
      this.targetRotationX += dy * 0.005;

      this.rotationVelocity.x = dy * 0.005;
      this.rotationVelocity.y = dx * 0.005;

      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    const endDrag = () => {
      this.isDragging = false;
      setTimeout(() => {
        if (!this.isDragging) this.autoRotate = true;
      }, 300);
    };

    this.canvas.addEventListener('mouseup', endDrag);
    this.canvas.addEventListener('mouseleave', endDrag);

    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  setupIntersectionObserver() {
    this.observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => (entry.isIntersecting ? this.start() : this.stop())),
      { threshold: 0.1 }
    );

    this.observer.observe(this.container);
  }

  handleResize() {
    if (!this.isInitialized) return;

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  handleVisibilityChange() {
    if (document.hidden) this.stop();
    else this.start();
  }

  animate() {
    if (!this.isVisible) return;
    this.animationId = requestAnimationFrame(() => this.animate());
    this.time += 0.01;

    this.movingLight.position.x = Math.cos(this.time * 0.4) * 5;
    this.movingLight.position.z = Math.sin(this.time * 0.4) * 5;
    this.movingLight.position.y = 3 + Math.sin(this.time * 0.25) * 1.5;

    if (this.isDragging) {
      // Manual control
    } else if (this.autoRotate) {
      this.targetRotationY += 0.002;
      this.targetRotationX += 0.002;
    } else {
      // Smooth damping
      this.targetRotationX += this.rotationVelocity.x;
      this.targetRotationY += this.rotationVelocity.y;
      this.rotationVelocity.x *= 0.92;
      this.rotationVelocity.y *= 0.92;
      if (
        Math.abs(this.rotationVelocity.x) < 0.0001 &&
        Math.abs(this.rotationVelocity.y) < 0.0001
      ) {
        this.autoRotate = true;
      }
    }

    // Smooth interpolation
    this.cubeGroup.rotation.y += (this.targetRotationY - this.cubeGroup.rotation.y) * 0.12;
    this.cubeGroup.rotation.x += (this.targetRotationX - this.cubeGroup.rotation.x) * 0.12;

    this.renderer.render(this.scene, this.camera);
  }

  start() {
    if (this.isVisible) return;
    this.isVisible = true;
    this.animate();
  }

  stop() {
    if (!this.isVisible) return;
    this.isVisible = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }
}

// ✅ Matches your Webflow div
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new RubiksCube3D('rubic-3d'));
} else {
  new RubiksCube3D('rubic-3d');
}

export default RubiksCube3D;
