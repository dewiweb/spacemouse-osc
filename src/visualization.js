/* global THREE */

class SpaceMouseVisualizer {
    constructor(containerId, mode = 'xyz') {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container element with id '${containerId}' not found`);
        }

        // Clean up existing renderer if present
        if (this.renderer) {
            this.renderer.dispose();
            this.container.removeChild(this.renderer.domElement);
        }

        this.mode = mode;
        this.colors = this.getThemeColors();
        
        // Current values
        this.currentPosition = { x: 0, y: 0, z: 0 };
        this.currentRotation = { x: 0, y: 0, z: 0 };
        
        // Animation properties
        this.animationSpeed = 0.1; // Smoothing factor
        
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupLights();
        this.setupObjects();
        this.animate();

        // Handle window resize
        this.resizeHandler = () => this.onWindowResize();
        window.addEventListener('resize', this.resizeHandler);
    }

    cleanup() {
        // Remove event listener
        window.removeEventListener('resize', this.resizeHandler);

        // Dispose of Three.js objects
        if (this.scene) {
            this.scene.traverse((object) => {
                if (object.geometry) {
                    object.geometry.dispose();
                }
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }

        // Dispose of renderer
        if (this.renderer) {
            this.renderer.dispose();
            this.container.removeChild(this.renderer.domElement);
        }
    }

    setupCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        
        if (this.mode === 'xyz') {
            // Isometric view for XYZ translation
            const d = 5;
            this.camera.position.set(d, -d, d);
            this.camera.lookAt(0, 0, 0);
            this.camera.up.set(0, 0, 1); // Set Z as up vector
        } else {
            // Orbital view - position camera at an angle to see all rings
            this.camera.position.set(2, 2, 2);
        }
        this.camera.lookAt(0, 0, 0);
    }

    setupObjects() {
        if (this.mode === 'xyz') {
            this.setupXYZObjects();
        } else {
            this.setupOrbitalObjects();
        }
    }

    setupXYZObjects() {
        // Add axes (colored cross)
        this.axes = new THREE.Group();
        const axisLength = 1;
        const axisWidth = 3;
        const axisColors = [this.colors.axes.x, this.colors.axes.y, this.colors.axes.z];
        
        ['x', 'y', 'z'].forEach((axis, i) => {
            const geometry = new THREE.BufferGeometry();
            const vertices = new Float32Array(6);
            if (axis === 'x') {
                vertices.set([-axisLength, 0, 0, axisLength, 0, 0]);
            } else if (axis === 'y') {
                vertices.set([0, -axisLength, 0, 0, axisLength, 0]);
            } else {
                vertices.set([0, 0, -axisLength, 0, 0, axisLength]);
            }
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            const material = new THREE.LineBasicMaterial({ 
                color: axisColors[i],
                linewidth: axisWidth
            });
            const axisLine = new THREE.Line(geometry, material);
            this.axes.add(axisLine);
        });
        this.scene.add(this.axes);

        // Add joystick vector line
        const vectorGeometry = new THREE.BufferGeometry();
        const vectorVertices = new Float32Array(6);
        vectorVertices.set([0, 0, 0, 0, 0, 0]); // Will be updated in animation
        vectorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vectorVertices, 3));
        const vectorMaterial = new THREE.LineBasicMaterial({ 
            color: this.colors.cube,
            linewidth: 4
        });
        this.vectorLine = new THREE.Line(vectorGeometry, vectorMaterial);
        this.scene.add(this.vectorLine);

        // Add point at the end of vector
        const pointGeometry = new THREE.SphereGeometry(0.05, 16, 16);
        const pointMaterial = new THREE.MeshPhongMaterial({ 
            color: this.colors.cube,
            transparent: false,
            opacity: 1.0
        });
        this.point = new THREE.Mesh(pointGeometry, pointMaterial);
        this.scene.add(this.point);

        // Scale factors
        this.positionScale = 1.0;
    }

    setupOrbitalObjects() {
        const radius = 1;

        // Create a single group for all rings and grid
        this.gyroGroup = new THREE.Group();
        
        // Create longitude and latitude lines
        const gridMaterial = new THREE.LineBasicMaterial({
            color: this.colors.grid,
            transparent: true,
            opacity: 0.3
        });

        // Add longitude lines
        const longitudeCount = 12;
        for (let i = 0; i < longitudeCount; i++) {
            const phi = (i / longitudeCount) * Math.PI * 2;
            const points = [];
            const segments = 32;
            
            for (let j = 0; j <= segments; j++) {
                const theta = (j / segments) * Math.PI;
                const x = radius * Math.sin(theta) * Math.cos(phi);
                const y = radius * Math.sin(theta) * Math.sin(phi);
                const z = radius * Math.cos(theta);
                points.push(new THREE.Vector3(x, y, z));
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, gridMaterial);
            this.gyroGroup.add(line);
        }

        // Add latitude lines
        const latitudeCount = 6;
        for (let i = 0; i <= latitudeCount; i++) {
            const theta = (i / latitudeCount) * Math.PI;
            const points = [];
            const segments = 32;
            
            for (let j = 0; j <= segments; j++) {
                const phi = (j / segments) * Math.PI * 2;
                const x = radius * Math.sin(theta) * Math.cos(phi);
                const y = radius * Math.sin(theta) * Math.sin(phi);
                const z = radius * Math.cos(theta);
                points.push(new THREE.Vector3(x, y, z));
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, gridMaterial);
            this.gyroGroup.add(line);
        }
        
        // Create rings
        // Pitch ring (red) - Rotates around X axis
        const pitchGeometry = new THREE.RingGeometry(radius, radius + 0.03, 64);
        const pitchMaterial = new THREE.MeshBasicMaterial({ 
            color: this.colors.axes.x,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7
        });
        this.pitchRing = new THREE.Mesh(pitchGeometry, pitchMaterial);
        this.pitchRing.rotation.y = Math.PI / 2;
        this.gyroGroup.add(this.pitchRing);

        // Roll ring (green) - Rotates around Y axis
        const rollGeometry = new THREE.RingGeometry(radius, radius + 0.03, 64);
        const rollMaterial = new THREE.MeshBasicMaterial({ 
            color: this.colors.axes.y,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7
        });
        this.rollRing = new THREE.Mesh(rollGeometry, rollMaterial);
        this.rollRing.rotation.x = Math.PI / 2;
        this.gyroGroup.add(this.rollRing);

        // Yaw ring (blue) - Rotates around Z axis
        const yawGeometry = new THREE.RingGeometry(radius, radius + 0.03, 64);
        const yawMaterial = new THREE.MeshBasicMaterial({ 
            color: this.colors.axes.z,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7
        });
        this.yawRing = new THREE.Mesh(yawGeometry, yawMaterial);
        this.gyroGroup.add(this.yawRing);

        // Create a small sphere at the center
        const sphereGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const sphereMaterial = new THREE.MeshPhongMaterial({ 
            color: this.colors.cube,
            transparent: false,
            opacity: 1.0
        });
        this.centerSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        this.gyroGroup.add(this.centerSphere);
        
        // Position camera for CAD-like view
        if (this.mode === 'orbital') {
            const d = 5;
            this.camera.position.set(d, -d, d);
            this.camera.lookAt(0, 0, 0);
            this.camera.up.set(0, 0, 1);
        }
        
        this.scene.add(this.gyroGroup);

        // Initialize quaternion for rotation
        this.currentQuaternion = new THREE.Quaternion();
        this.targetQuaternion = new THREE.Quaternion();

        // Scale factors
        this.rotationScale = Math.PI / 2;
    }

    update(data) {
        if (this.mode === 'xyz') {
            this.updateXYZ(data);
        } else {
            this.updateOrbital(data);
        }
    }

    updateXYZ(data) {
        // Get position values (clamped to [-1, 1] range)
        const targetPosition = {
            x: Math.max(-1, Math.min(1, (data.translate?.x || 0))) * this.positionScale,
            y: Math.max(-1, Math.min(1, (data.translate?.y || 0))) * this.positionScale,
            z: Math.max(-1, Math.min(1, (data.translate?.z || 0))) * this.positionScale
        };

        // Smoothly update current position
        this.currentPosition.x += (targetPosition.x - this.currentPosition.x) * this.animationSpeed;
        this.currentPosition.y += (targetPosition.y - this.currentPosition.y) * this.animationSpeed;
        this.currentPosition.z += (targetPosition.z - this.currentPosition.z) * this.animationSpeed;

        // Update vector line
        const positions = this.vectorLine.geometry.attributes.position.array;
        positions[0] = 0;
        positions[1] = 0;
        positions[2] = 0;
        positions[3] = this.currentPosition.x;
        positions[4] = this.currentPosition.y;
        positions[5] = this.currentPosition.z;
        this.vectorLine.geometry.attributes.position.needsUpdate = true;

        // Update point position
        this.point.position.set(
            this.currentPosition.x,
            this.currentPosition.y,
            this.currentPosition.z
        );
    }

    updateOrbital(data) {
        // Get rotation values (clamped to [-1, 1] range)
        // Map to CAD conventions:
        // Pitch around X (red)
        // Roll around Y (green)
        // Yaw around Z (blue)
        const rx = Math.max(-1, Math.min(1, (data.rotate?.x || 0))) * this.rotationScale; // Pitch
        const ry = Math.max(-1, Math.min(1, (data.rotate?.z || 0))) * this.rotationScale; // Roll
        const rz = Math.max(-1, Math.min(1, (data.rotate?.y || 0))) * this.rotationScale; // Yaw

        // Create rotation quaternion
        const euler = new THREE.Euler(rx, ry, rz, 'XYZ');
        this.targetQuaternion.setFromEuler(euler);

        // Smoothly interpolate current rotation towards target
        this.currentQuaternion.slerp(this.targetQuaternion, this.animationSpeed);

        // Apply rotation to the entire group
        this.gyroGroup.quaternion.copy(this.currentQuaternion);
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

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.colors.background);
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

let xyzVisualizer = null;
let orbitalVisualizer = null;

function initVisualizers() {
    // Clean up existing visualizers
    if (xyzVisualizer) {
        xyzVisualizer.cleanup();
        xyzVisualizer = null;
    }
    
    if (orbitalVisualizer) {
        orbitalVisualizer.cleanup();
        orbitalVisualizer = null;
    }

    // Create new visualizers
    xyzVisualizer = new SpaceMouseVisualizer('xyz-visualizer', 'xyz');
    orbitalVisualizer = new SpaceMouseVisualizer('orbital-visualizer', 'orbital');
}

function updateVisualizers(data) {
    const translationData = {
        translate: {
            x: data.translate?.x || 0,
            y: data.translate?.y || 0,
            z: data.translate?.z || 0
        },
        rotate: {
            x: 0,
            y: 0,
            z: 0
        }
    };

    const rotationData = {
        translate: {
            x: 0,
            y: 0,
            z: 0
        },
        rotate: {
            x: data.rotate?.x || 0,
            y: data.rotate?.y || 0,
            z: data.rotate?.z || 0
        }
    };

    if (xyzVisualizer) xyzVisualizer.update(translationData);
    if (orbitalVisualizer) orbitalVisualizer.update(rotationData);
}

module.exports = {
    initVisualizers,
    updateVisualizers,
    OSCIndicator
};
