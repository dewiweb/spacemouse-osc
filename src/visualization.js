/* global THREE */

class SpaceMouseVisualizer {
    constructor(containerId, plane = 'xy') {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container element with id '${containerId}' not found`);
        }

        // Theme-aware colors
        this.colors = this.getThemeColors();

        this.plane = plane;
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupLights();
        this.setupObjects();
        this.animate();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Current position and rotation
        this.currentPosition = { x: 0, y: 0 };
        this.currentRotation = { x: 0, y: 0 };
        
        // Animation properties
        this.animationSpeed = 0.1; // Smoothing factor
    }

    getThemeColors() {
        const isDark = document.documentElement.className.includes('theme-dark');
        return {
            background: isDark ? 0x2E3440 : 0xECEFF4, // Nord background colors
            grid: isDark ? 0xD8DEE9 : 0x4C566A,      // Light grid in dark theme, dark grid in light theme
            axes: {
                x: 0xBF616A, // Red axis
                y: 0xA3BE8C, // Green axis
                z: 0x81A1C1  // Blue axis
            },
            cube: isDark ? 0x88C0D0 : 0x5E81AC,  // Different shades for dark/light themes
            text: isDark ? 0xE5E9F0 : 0x2E3440    // Nord text colors
        };
    }

    updateVisualizerTheme() {
        this.colors = this.getThemeColors();
        
        // Update renderer background
        this.renderer.setClearColor(this.colors.background);
        
        // Update grid material
        this.grid.material.color.setHex(this.colors.grid);
        
        // Update cube material
        this.cube.material.color.setHex(this.colors.cube);
        
        // Update axes
        this.axes.children.forEach((axis, index) => {
            const color = [this.colors.axes.x, this.colors.axes.y, this.colors.axes.z][index];
            axis.material.color.setHex(color);
        });
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.colors.background);
    }

    setupCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.z = 5;
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setClearColor(this.colors.background);
        this.container.appendChild(this.renderer.domElement);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(10, 10, 10);
        this.scene.add(directionalLight);
    }

    setupObjects() {
        // Add grid
        const gridHelper = new THREE.GridHelper(10, 10, this.colors.grid, this.colors.grid);
        if (this.plane === 'yz') {
            gridHelper.rotation.z = Math.PI / 2;
        }
        this.grid = gridHelper;
        this.scene.add(this.grid);

        // Add axes
        this.axes = new THREE.Group();
        const axisLength = 5;
        const axisColors = [this.colors.axes.x, this.colors.axes.y, this.colors.axes.z];
        
        for (let i = 0; i < 3; i++) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, axisLength, 0, 0], 3));
            const material = new THREE.LineBasicMaterial({ color: axisColors[i] });
            const axis = new THREE.Line(geometry, material);
            axis.rotation.z = (i * Math.PI) / 2;
            this.axes.add(axis);
        }
        this.scene.add(this.axes);

        // Add cube
        const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const material = new THREE.MeshPhongMaterial({ 
            color: this.colors.cube,
            transparent: true,
            opacity: 0.8
        });
        this.cube = new THREE.Mesh(geometry, material);
        this.scene.add(this.cube);
    }

    updatePosition(x, y) {
        const targetX = this.plane === 'yz' ? 0 : x;
        const targetY = y;
        
        // Smoothly interpolate to target position
        this.currentPosition.x += (targetX - this.currentPosition.x) * this.animationSpeed;
        this.currentPosition.y += (targetY - this.currentPosition.y) * this.animationSpeed;
        
        this.cube.position.x = this.currentPosition.x;
        this.cube.position.y = this.currentPosition.y;
    }

    updateRotation(x, y) {
        const targetRotationX = this.plane === 'yz' ? 0 : x;
        const targetRotationY = y;
        
        // Smoothly interpolate to target rotation
        this.currentRotation.x += (targetRotationX - this.currentRotation.x) * this.animationSpeed;
        this.currentRotation.y += (targetRotationY - this.currentRotation.y) * this.animationSpeed;
        
        this.cube.rotation.x = this.currentRotation.x;
        this.cube.rotation.y = this.currentRotation.y;
    }

    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }
}

class OSCIndicator {
    constructor(elementId) {
        this.element = document.getElementById(elementId);
        this.timeout = null;
    }

    pulse() {
        if (this.element) {
            this.element.classList.add('pulse');
            clearTimeout(this.timeout);
            this.timeout = setTimeout(() => {
                this.element.classList.remove('pulse');
            }, 100);
        }
    }
}

module.exports = {
    SpaceMouseVisualizer,
    OSCIndicator
};
