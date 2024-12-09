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

        // Listen for theme changes
        document.addEventListener('DOMContentLoaded', () => {
            const themeToggle = document.getElementById('theme-toggle');
            if (themeToggle) {
                themeToggle.addEventListener('click', () => {
                    setTimeout(() => this.updateVisualizerTheme(), 0); // Update after theme change
                });
            }
        });
    }

    getThemeColors() {
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        return {
            background: theme === 'light' ? 0xECEFF4 : 0x2E3440, // Nord background colors
            grid: theme === 'light' ? 0x4C566A : 0xD8DEE9,     // Dark grid in light theme, light grid in dark theme
            axes: {
                x: 0xBF616A, // Red axis
                y: 0xA3BE8C, // Green axis
                z: 0x81A1C1  // Blue axis
            },
            cube: 0x88C0D0,      // Nord cyan
            text: 0xE5E9F0       // Nord text
        };
    }

    updateVisualizerTheme() {
        this.colors = this.getThemeColors();
        this.scene.background = new THREE.Color(this.colors.background);
        this.gridHelper.material.color.setHex(this.colors.grid);
        this.gridHelper.material.opacity = 0.5;
        
        // Update axes colors
        this.axesHelper.children.forEach((axis, index) => {
            const colors = [this.colors.axes.x, this.colors.axes.y, this.colors.axes.z];
            if (axis.material) {
                axis.material.color.setHex(colors[index]);
            }
        });

        // Force a render
        this.renderer.render(this.scene, this.camera);
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.colors.background);
    }

    setupCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.OrthographicCamera(-5 * aspect, 5 * aspect, 5, -5, 0.1, 1000);
        
        if (this.plane === 'xy') {
            this.camera.position.set(0, 0, 10);
        } else {
            this.camera.position.set(-10, 0, 0);
        }
        
        this.camera.lookAt(0, 0, 0);
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(this.colors.background, 1);
        this.container.appendChild(this.renderer.domElement);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(this.colors.text, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(this.colors.text, 0.6);
        directionalLight.position.set(10, 10, 10);
        this.scene.add(directionalLight);
    }

    setupObjects() {
        // Grid
        this.gridHelper = new THREE.GridHelper(10, 10, this.colors.grid, this.colors.grid);
        this.gridHelper.material.opacity = 0.5;
        this.gridHelper.material.transparent = true;

        // Set grid rotation based on plane
        if (this.plane === 'xy') {
            this.gridHelper.rotation.x = Math.PI / 2;
        } else if (this.plane === 'yz') {
            this.gridHelper.rotation.z = Math.PI / 2;
        }
        this.scene.add(this.gridHelper);

        // Axes
        this.axesHelper = new THREE.AxesHelper(5);
        this.axesHelper.children.forEach((axis, index) => {
            const colors = [this.colors.axes.x, this.colors.axes.y, this.colors.axes.z];
            if (axis.material) {
                axis.material.color.setHex(colors[index]);
            }
        });
        this.scene.add(this.axesHelper);

        // Cube
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshPhongMaterial({
            color: this.colors.cube,
            transparent: true,
            opacity: 0.8,
            specular: this.colors.text,
            shininess: 30
        });
        this.cube = new THREE.Mesh(geometry, material);
        this.scene.add(this.cube);

        // Arrow helpers for rotation
        this.arrowHelpers = {
            x: new THREE.ArrowHelper(
                new THREE.Vector3(1, 0, 0),
                new THREE.Vector3(0, 0, 0),
                2,
                this.colors.axes.x
            ),
            y: new THREE.ArrowHelper(
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(0, 0, 0),
                2,
                this.colors.axes.y
            ),
            z: new THREE.ArrowHelper(
                new THREE.Vector3(0, 0, 1),
                new THREE.Vector3(0, 0, 0),
                2,
                this.colors.axes.z
            )
        };

        Object.values(this.arrowHelpers).forEach(arrow => this.scene.add(arrow));
    }

    onWindowResize() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        if (this.camera.isOrthographicCamera) {
            this.camera.left = -5 * aspect;
            this.camera.right = 5 * aspect;
            this.camera.top = 5;
            this.camera.bottom = -5;
        }
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    updatePosition(x, y, z) {
        if (this.plane === 'xy') {
            this.cube.position.set(x, y, 0);
        } else if (this.plane === 'yz') {
            this.cube.position.set(0, y, z);
        }
    }

    updateRotation(rx, ry, rz) {
        this.cube.rotation.set(rx, ry, rz);
        
        // Update arrow helpers
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationFromEuler(this.cube.rotation);

        const xAxis = new THREE.Vector3(1, 0, 0).applyMatrix4(rotationMatrix);
        const yAxis = new THREE.Vector3(0, 1, 0).applyMatrix4(rotationMatrix);
        const zAxis = new THREE.Vector3(0, 0, 1).applyMatrix4(rotationMatrix);

        this.arrowHelpers.x.setDirection(xAxis);
        this.arrowHelpers.y.setDirection(yAxis);
        this.arrowHelpers.z.setDirection(zAxis);
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
            this.element.style.backgroundColor = '#A3BE8C'; // Nord green
            this.element.style.opacity = '1';

            if (this.timeout) {
                clearTimeout(this.timeout);
            }

            this.timeout = setTimeout(() => {
                if (this.element) {
                    this.element.style.backgroundColor = '#4C566A'; // Nord darker gray
                    this.element.style.opacity = '0.5';
                }
            }, 100);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SpaceMouseVisualizer,
        OSCIndicator
    };
}
