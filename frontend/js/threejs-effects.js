// Three.js Effects for Multi-Agent Experiment Platform
// Professional animated background with subtle particle system

class ThreeJSBackground {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.particles = [];
        this.geometricShapes = [];
        this.robots = [];
        this.robotHead = null;
        this.robotHead2 = null;
        this.networkGraphs = [];
        this.animationId = null;
        
        this.init();
        this.createParticles();
        this.createGeometricShapes();
        this.createRobots();
        this.createRobotHead();
        this.createRobotHead2();
        this.createNetworkGraphs();
        this.animate();
        this.setupEventListeners();
    }

    init() {
        console.log('🎨 ThreeJS: Initializing background effects...');
        
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0xf8f9fa, 100, 1000);

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 100;

        // Renderer setup
        const canvas = document.getElementById('threejs-canvas');
        if (!canvas) {
            console.error('❌ ThreeJS: Canvas element not found!');
            return;
        }
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 0); // Transparent background
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        console.log('✅ ThreeJS: Renderer initialized');
    }

    createParticles() {
        // Create flowing particle streams
        const particleCount = 300;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            // Create particle streams flowing from left to right
            positions[i * 3] = (Math.random() - 0.5) * 1000; // x
            positions[i * 3 + 1] = (Math.random() - 0.5) * 800; // y
            positions[i * 3 + 2] = (Math.random() - 0.5) * 200; // z
            
            // Horizontal flow with some randomness
            velocities[i * 3] = Math.random() * 0.5 + 0.2; // x - rightward flow
            velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.1; // y - slight vertical
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1; // z - slight depth
            
            // Gradient colors - blue to purple
            const t = Math.random();
            colors[i * 3] = 0.2 + t * 0.4; // R
            colors[i * 3 + 1] = 0.3 + t * 0.2; // G  
            colors[i * 3 + 2] = 0.8 + t * 0.2; // B
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        // Create custom circular particle texture to avoid squares
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Draw a perfect circle
        ctx.beginPath();
        ctx.arc(32, 32, 30, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        
        const texture = new THREE.CanvasTexture(canvas);
        
        const material = new THREE.PointsMaterial({
            size: 3,
            transparent: true,
            opacity: 0.7,
            vertexColors: true,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending,
            map: texture  // Use circular texture instead of square pixels
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
        console.log('✅ ThreeJS: Created particle streams');
    }

    createGeometricShapes() {
        // Create sophisticated floating neural network nodes
        const nodeCount = 15;
        
        for (let i = 0; i < nodeCount; i++) {
            // ONLY SPHERES - no other geometry that could look square
            const shapes = [
                new THREE.SphereGeometry(12, 24, 24),        // Large smooth spheres
                new THREE.SphereGeometry(8, 16, 16),         // Medium smooth spheres
                new THREE.SphereGeometry(10, 20, 20),        // Medium-large spheres
                new THREE.SphereGeometry(15, 32, 32)         // Extra large smooth spheres
            ];
            
            const geometry = shapes[Math.floor(Math.random() * shapes.length)];
            
            // Dynamic materials with color variation
            const hue = (i / nodeCount) * 360;
            const material = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(hue / 360, 0.6, 0.7),
                transparent: true,
                opacity: 0.3,
                wireframe: true
            });

            const mesh = new THREE.Mesh(geometry, material);
            
            // Arrange in loose grid with randomness
            const gridSize = Math.ceil(Math.sqrt(nodeCount));
            const row = Math.floor(i / gridSize);
            const col = i % gridSize;
            
            mesh.position.x = (col - gridSize/2) * 100 + (Math.random() - 0.5) * 80;
            mesh.position.y = (row - gridSize/2) * 100 + (Math.random() - 0.5) * 80;
            mesh.position.z = (Math.random() - 0.5) * 300;
            
            // Complex animation parameters
            mesh.userData = {
                rotationSpeed: {
                    x: (Math.random() - 0.5) * 0.02,
                    y: (Math.random() - 0.5) * 0.02,
                    z: (Math.random() - 0.5) * 0.02
                },
                floatSpeed: Math.random() * 0.01 + 0.005,
                initialY: mesh.position.y,
                pulseSpeed: Math.random() * 0.02 + 0.01,
                originalOpacity: material.opacity
            };
            
            this.geometricShapes.push(mesh);
            this.scene.add(mesh);
        }
        
        // Create connecting lines between nearby nodes
        this.createConnections();
        console.log('✅ ThreeJS: Created neural network visualization');
    }
    
    createConnections() {
        const maxDistance = 120;
        
        for (let i = 0; i < this.geometricShapes.length; i++) {
            for (let j = i + 1; j < this.geometricShapes.length; j++) {
                const node1 = this.geometricShapes[i];
                const node2 = this.geometricShapes[j];
                
                const distance = node1.position.distanceTo(node2.position);
                
                if (distance < maxDistance) {
                    const geometry = new THREE.BufferGeometry().setFromPoints([
                        node1.position,
                        node2.position
                    ]);
                    
                    const material = new THREE.LineBasicMaterial({
                        color: 0x60a5fa, // Brighter blue
                        transparent: true,
                        opacity: 0.4     // Much more visible
                    });
                    
                    const line = new THREE.Line(geometry, material);
                    this.scene.add(line);
                }
            }
        }
    }
    
    createRobots() {
        const robotCount = 5;
        
        for (let i = 0; i < robotCount; i++) {
            const robot = this.createRobotModel();
            
            // Random starting positions
            robot.position.x = (Math.random() - 0.5) * 800;
            robot.position.y = -200 + Math.random() * 100; // Keep robots at bottom
            robot.position.z = (Math.random() - 0.5) * 400;
            
            // Random walking parameters
            robot.userData = {
                walkSpeed: Math.random() * 0.8 + 0.2,
                direction: Math.random() * Math.PI * 2,
                changeDirectionTimer: 0,
                bobSpeed: Math.random() * 0.05 + 0.02,
                initialY: robot.position.y
            };
            
            this.robots.push(robot);
            this.scene.add(robot);
        }
        
        console.log('🤖 ThreeJS: Created walking robots');
    }
    
    createRobotModel() {
        const robot = new THREE.Group();
        
        // Random color palettes for variety
        const colorPalettes = [
            { body: 0x4ade80, head: 0x60a5fa, arms: 0x64748b, legs: 0x475569, antenna: 0xfbbf24, tip: 0xef4444, eyes: 0xff6b6b },  // Original
            { body: 0xe11d48, head: 0xfbbf24, arms: 0x8b5cf6, legs: 0x374151, antenna: 0x06b6d4, tip: 0x10b981, eyes: 0xf97316 },  // Vibrant
            { body: 0x8b5cf6, head: 0x10b981, arms: 0xf59e0b, legs: 0x6b7280, antenna: 0xe11d48, tip: 0x3b82f6, eyes: 0x06b6d4 },  // Purple-green
            { body: 0x06b6d4, head: 0xf97316, arms: 0x10b981, legs: 0x8b5cf6, antenna: 0xe11d48, tip: 0xfbbf24, eyes: 0xef4444 },  // Cyan-orange
            { body: 0xf59e0b, head: 0x8b5cf6, arms: 0x06b6d4, legs: 0xe11d48, antenna: 0x10b981, tip: 0x60a5fa, eyes: 0xf97316 },  // Gold-purple
            { body: 0x10b981, head: 0xef4444, arms: 0x3b82f6, legs: 0xf59e0b, antenna: 0x8b5cf6, tip: 0x06b6d4, eyes: 0xfbbf24 }   // Green-red
        ];
        
        const colors = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
        
        // Robot body (random color)
        const bodyGeometry = new THREE.CylinderGeometry(8, 10, 20, 8);
        const bodyMaterial = new THREE.MeshBasicMaterial({
            color: colors.body,
            transparent: true,
            opacity: 0.8
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 10;
        robot.add(body);
        
        // Robot head (random color)
        const headGeometry = new THREE.SphereGeometry(6, 12, 12);
        const headMaterial = new THREE.MeshBasicMaterial({
            color: colors.head,
            transparent: true,
            opacity: 0.9
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 25;
        robot.add(head);
        
        // Robot eyes (random color)
        const eyeGeometry = new THREE.SphereGeometry(1, 8, 8);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: colors.eyes });
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-3, 27, 5);
        robot.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(3, 27, 5);
        robot.add(rightEye);
        
        // Robot arms (random color)
        const armGeometry = new THREE.CylinderGeometry(2, 2, 15, 6);
        const armMaterial = new THREE.MeshBasicMaterial({
            color: colors.arms,
            transparent: true,
            opacity: 0.7
        });
        
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-12, 12, 0);
        leftArm.rotation.z = Math.PI / 6;
        robot.add(leftArm);
        
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(12, 12, 0);
        rightArm.rotation.z = -Math.PI / 6;
        robot.add(rightArm);
        
        // Robot legs (random color)
        const legGeometry = new THREE.CylinderGeometry(3, 3, 12, 6);
        const legMaterial = new THREE.MeshBasicMaterial({
            color: colors.legs,
            transparent: true,
            opacity: 0.8
        });
        
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-5, -6, 0);
        robot.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(5, -6, 0);
        robot.add(rightLeg);
        
        // Add antenna (random color)
        const antennaGeometry = new THREE.CylinderGeometry(0.5, 0.5, 8, 6);
        const antennaMaterial = new THREE.MeshBasicMaterial({ color: colors.antenna });
        const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
        antenna.position.set(0, 35, 0);
        robot.add(antenna);
        
        // Antenna tip (random color)
        const antennaTipGeometry = new THREE.SphereGeometry(1.5, 8, 8);
        const antennaTipMaterial = new THREE.MeshBasicMaterial({ color: colors.tip });
        const antennaTip = new THREE.Mesh(antennaTipGeometry, antennaTipMaterial);
        antennaTip.position.set(0, 40, 0);
        robot.add(antennaTip);
        
        return robot;
    }
    
    createRobotHead() {
        // Create separate Three.js scene for robot head icon
        const headCanvas = document.getElementById('robot-head-canvas');
        if (!headCanvas) {
            console.error('❌ Robot head canvas not found');
            return;
        }
        
        // Setup mini scene for robot head
        const headScene = new THREE.Scene();
        const headCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        const headRenderer = new THREE.WebGLRenderer({
            canvas: headCanvas,
            antialias: true,
            alpha: true
        });
        
        headRenderer.setSize(48, 48);
        headRenderer.setClearColor(0x000000, 0);
        headCamera.position.z = 25;
        
        // Create mini robot head
        const robotHead = new THREE.Group();
        
        // Head sphere
        const headGeometry = new THREE.SphereGeometry(6, 16, 16);
        const headMaterial = new THREE.MeshBasicMaterial({
            color: 0x60a5fa,
            transparent: true,
            opacity: 0.9
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        robotHead.add(head);
        
        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(1, 8, 8);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff6b6b });
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-2, 1, 5);
        robotHead.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(2, 1, 5);
        robotHead.add(rightEye);
        
        // Antenna
        const antennaGeometry = new THREE.CylinderGeometry(0.3, 0.3, 4, 6);
        const antennaMaterial = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
        const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
        antenna.position.set(0, 8, 0);
        robotHead.add(antenna);
        
        const antennaTipGeometry = new THREE.SphereGeometry(0.8, 8, 8);
        const antennaTipMaterial = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const antennaTip = new THREE.Mesh(antennaTipGeometry, antennaTipMaterial);
        antennaTip.position.set(0, 10, 0);
        robotHead.add(antennaTip);
        
        headScene.add(robotHead);
        
        // Store references for animation
        this.robotHead = {
            scene: headScene,
            camera: headCamera,
            renderer: headRenderer,
            head: robotHead,
            antennaTip: antennaTip,
            leftEye: leftEye,
            rightEye: rightEye
        };
        
        console.log('🤖 ThreeJS: Created animated robot head icon');
    }
    
    createRobotHead2() {
        // Create second robot head with different colors
        const headCanvas = document.getElementById('robot-head-canvas-2');
        if (!headCanvas) {
            console.error('❌ Robot head canvas 2 not found');
            return;
        }
        
        // Setup mini scene for second robot head
        const headScene = new THREE.Scene();
        const headCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        const headRenderer = new THREE.WebGLRenderer({
            canvas: headCanvas,
            antialias: true,
            alpha: true
        });
        
        headRenderer.setSize(48, 48);
        headRenderer.setClearColor(0x000000, 0);
        headCamera.position.z = 25;
        
        // Create mini robot head with different colors
        const robotHead = new THREE.Group();
        
        // Head sphere (green instead of blue)
        const headGeometry = new THREE.SphereGeometry(6, 16, 16);
        const headMaterial = new THREE.MeshBasicMaterial({
            color: 0x4ade80, // Green
            transparent: true,
            opacity: 0.9
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        robotHead.add(head);
        
        // Eyes (purple instead of red)
        const eyeGeometry = new THREE.SphereGeometry(1, 8, 8);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xa855f7 }); // Purple
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-2, 1, 5);
        robotHead.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(2, 1, 5);
        robotHead.add(rightEye);
        
        // Antenna (orange instead of yellow)
        const antennaGeometry = new THREE.CylinderGeometry(0.3, 0.3, 4, 6);
        const antennaMaterial = new THREE.MeshBasicMaterial({ color: 0xf97316 }); // Orange
        const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
        antenna.position.set(0, 8, 0);
        robotHead.add(antenna);
        
        // Antenna tip (cyan instead of red)
        const antennaTipGeometry = new THREE.SphereGeometry(0.8, 8, 8);
        const antennaTipMaterial = new THREE.MeshBasicMaterial({ color: 0x06b6d4 }); // Cyan
        const antennaTip = new THREE.Mesh(antennaTipGeometry, antennaTipMaterial);
        antennaTip.position.set(0, 10, 0);
        robotHead.add(antennaTip);
        
        headScene.add(robotHead);
        
        // Store references for animation
        this.robotHead2 = {
            scene: headScene,
            camera: headCamera,
            renderer: headRenderer,
            head: robotHead,
            antennaTip: antennaTip,
            leftEye: leftEye,
            rightEye: rightEye
        };
        
        console.log('🤖 ThreeJS: Created second animated robot head icon');
    }
    
    createNetworkGraphs() {
        const graphCount = 3;
        
        for (let g = 0; g < graphCount; g++) {
            const networkGraph = new THREE.Group();
            
            // Position graphs in different areas
            const positions = [
                { x: -300, y: 150, z: -100 },  // Top left
                { x: 350, y: -50, z: 150 },    // Right center
                { x: -200, y: -180, z: 50 }    // Bottom left
            ];
            
            const graphPos = positions[g];
            networkGraph.position.set(graphPos.x, graphPos.y, graphPos.z);
            
            // Create network nodes
            const nodeCount = 8 + Math.floor(Math.random() * 5); // 8-12 nodes per graph
            const nodes = [];
            const edges = [];
            
            // Generate nodes in a circular or organic layout
            for (let i = 0; i < nodeCount; i++) {
                const angle = (i / nodeCount) * Math.PI * 2;
                const radius = 60 + Math.random() * 40;
                const height = (Math.random() - 0.5) * 30;
                
                // Create node
                const nodeGeometry = new THREE.SphereGeometry(3 + Math.random() * 2, 12, 12);
                const nodeColors = [0x3b82f6, 0x06b6d4, 0x10b981, 0xf59e0b, 0xef4444];
                const nodeMaterial = new THREE.MeshBasicMaterial({
                    color: nodeColors[Math.floor(Math.random() * nodeColors.length)],
                    transparent: true,
                    opacity: 0.8
                });
                
                const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
                node.position.set(
                    Math.cos(angle) * radius + (Math.random() - 0.5) * 20,
                    height,
                    Math.sin(angle) * radius + (Math.random() - 0.5) * 20
                );
                
                // Add pulsing animation data
                node.userData = {
                    originalScale: node.scale.x,
                    pulseSpeed: Math.random() * 0.02 + 0.01,
                    pulseOffset: Math.random() * Math.PI * 2
                };
                
                nodes.push(node);
                networkGraph.add(node);
            }
            
            // Create edges between nodes (neural network style)
            for (let i = 0; i < nodeCount; i++) {
                const connectionsPerNode = 2 + Math.floor(Math.random() * 3);
                
                for (let j = 0; j < connectionsPerNode; j++) {
                    const targetIndex = (i + 1 + j + Math.floor(Math.random() * 2)) % nodeCount;
                    if (targetIndex !== i) {
                        
                        // Create edge line
                        const edgeGeometry = new THREE.BufferGeometry().setFromPoints([
                            nodes[i].position,
                            nodes[targetIndex].position
                        ]);
                        
                        const edgeMaterial = new THREE.LineBasicMaterial({
                            color: 0x60a5fa,
                            transparent: true,
                            opacity: 0.3
                        });
                        
                        const edge = new THREE.Line(edgeGeometry, edgeMaterial);
                        
                        // Add flowing animation data
                        edge.userData = {
                            flowSpeed: Math.random() * 0.02 + 0.005,
                            flowOffset: Math.random() * Math.PI * 2,
                            originalOpacity: edgeMaterial.opacity
                        };
                        
                        edges.push(edge);
                        networkGraph.add(edge);
                    }
                }
            }
            
            // Store network components for animation
            networkGraph.userData = {
                nodes: nodes,
                edges: edges,
                rotationSpeed: (Math.random() - 0.5) * 0.003,
                floatSpeed: Math.random() * 0.005 + 0.002,
                initialY: graphPos.y
            };
            
            this.networkGraphs.push(networkGraph);
            this.scene.add(networkGraph);
        }
        
        console.log('🕸️ ThreeJS: Created network graphs with animated nodes and edges');
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        // Animate particles with subtle drift
        if (this.particles) {
            const positions = this.particles.geometry.attributes.position;
            const velocities = this.particles.geometry.attributes.velocity;

            for (let i = 0; i < positions.count; i++) {
                // Update positions based on velocities
                positions.array[i * 3] += velocities.array[i * 3];
                positions.array[i * 3 + 1] += velocities.array[i * 3 + 1];
                positions.array[i * 3 + 2] += velocities.array[i * 3 + 2];

                // Wrap around screen edges
                if (Math.abs(positions.array[i * 3]) > 400) {
                    velocities.array[i * 3] *= -1;
                }
                if (Math.abs(positions.array[i * 3 + 1]) > 300) {
                    velocities.array[i * 3 + 1] *= -1;
                }
            }
            positions.needsUpdate = true;
        }

        // Animate geometric shapes with complex motion
        this.geometricShapes.forEach((shape, index) => {
            // Rotation
            shape.rotation.x += shape.userData.rotationSpeed.x;
            shape.rotation.y += shape.userData.rotationSpeed.y;
            shape.rotation.z += shape.userData.rotationSpeed.z;
            
            // Complex floating motion
            const time = Date.now() * 0.001;
            shape.position.y = shape.userData.initialY + 
                Math.sin(time * shape.userData.floatSpeed + index) * 25 +
                Math.cos(time * shape.userData.floatSpeed * 0.7) * 10;
            
            // Gentle pulsing opacity
            const pulse = Math.sin(time * shape.userData.pulseSpeed) * 0.1 + 0.1;
            shape.material.opacity = shape.userData.originalOpacity + pulse;
            
            // Subtle position drift
            shape.position.x += Math.sin(time * 0.3 + index) * 0.1;
            shape.position.z += Math.cos(time * 0.2 + index) * 0.05;
        });
        
        // Animate walking robots
        this.robots.forEach((robot, index) => {
            const time = Date.now() * 0.001;
            
            // Walking motion
            robot.position.x += Math.cos(robot.userData.direction) * robot.userData.walkSpeed;
            robot.position.z += Math.sin(robot.userData.direction) * robot.userData.walkSpeed;
            
            // Bobbing motion while walking
            robot.position.y = robot.userData.initialY + 
                Math.sin(time * robot.userData.bobSpeed * 10) * 2;
            
            // Subtle rotation while walking
            robot.rotation.y = robot.userData.direction + Math.sin(time + index) * 0.1;
            
            // Change direction occasionally
            robot.userData.changeDirectionTimer++;
            if (robot.userData.changeDirectionTimer > 200 + Math.random() * 300) {
                robot.userData.direction += (Math.random() - 0.5) * 1.5;
                robot.userData.changeDirectionTimer = 0;
            }
            
            // Keep robots within bounds
            if (Math.abs(robot.position.x) > 500) {
                robot.userData.direction += Math.PI;
            }
            if (Math.abs(robot.position.z) > 400) {
                robot.userData.direction += Math.PI;
            }
            
            // Animate robot parts
            const arms = robot.children.filter(child => child.position.x !== 0 && child.position.y > 5);
            arms.forEach((arm, armIndex) => {
                arm.rotation.x = Math.sin(time * 5 + index + armIndex * Math.PI) * 0.3;
            });
            
            // Make antenna tip blink
            const antennaTip = robot.children.find(child => 
                child.position.y > 35 && child.geometry instanceof THREE.SphereGeometry
            );
            if (antennaTip) {
                antennaTip.material.opacity = 0.3 + Math.sin(time * 3 + index) * 0.7;
            }
        });
        
        // Animate robot head icon
        if (this.robotHead) {
            const time = Date.now() * 0.001;
            
            // Gentle head rotation
            this.robotHead.head.rotation.y = Math.sin(time * 0.5) * 0.3;
            
            // Blinking antenna tip
            this.robotHead.antennaTip.material.opacity = 0.3 + Math.sin(time * 2) * 0.7;
            
            // Blinking eyes occasionally
            const blinkCycle = Math.sin(time * 0.3);
            if (blinkCycle > 0.95) {
                this.robotHead.leftEye.scale.y = 0.1;
                this.robotHead.rightEye.scale.y = 0.1;
            } else {
                this.robotHead.leftEye.scale.y = 1;
                this.robotHead.rightEye.scale.y = 1;
            }
            
            // Render robot head
            this.robotHead.renderer.render(this.robotHead.scene, this.robotHead.camera);
        }
        
        // Animate second robot head icon (slightly different timing)
        if (this.robotHead2) {
            const time = Date.now() * 0.001;
            
            // Gentle head rotation (opposite direction)
            this.robotHead2.head.rotation.y = Math.sin(time * 0.7) * -0.4;
            
            // Blinking antenna tip (different speed)
            this.robotHead2.antennaTip.material.opacity = 0.4 + Math.sin(time * 1.5) * 0.6;
            
            // Blinking eyes occasionally (different timing)
            const blinkCycle = Math.sin(time * 0.4 + 1);
            if (blinkCycle > 0.92) {
                this.robotHead2.leftEye.scale.y = 0.1;
                this.robotHead2.rightEye.scale.y = 0.1;
            } else {
                this.robotHead2.leftEye.scale.y = 1;
                this.robotHead2.rightEye.scale.y = 1;
            }
            
            // Render second robot head
            this.robotHead2.renderer.render(this.robotHead2.scene, this.robotHead2.camera);
        }
        
        // Animate network graphs
        this.networkGraphs.forEach((graph, graphIndex) => {
            const time = Date.now() * 0.001;
            
            // Gentle rotation of entire graph
            graph.rotation.y += graph.userData.rotationSpeed;
            
            // Subtle floating motion
            graph.position.y = graph.userData.initialY + 
                Math.sin(time * graph.userData.floatSpeed + graphIndex) * 15;
            
            // Animate nodes - pulsing effect
            graph.userData.nodes.forEach((node, nodeIndex) => {
                const pulse = Math.sin(time * node.userData.pulseSpeed + node.userData.pulseOffset) * 0.3 + 1;
                node.scale.setScalar(node.userData.originalScale * pulse);
                
                // Subtle color shifting
                const colorShift = Math.sin(time * 0.5 + nodeIndex) * 0.1 + 0.9;
                node.material.opacity = 0.6 + colorShift * 0.3;
            });
            
            // Animate edges - flowing effect
            graph.userData.edges.forEach((edge, edgeIndex) => {
                const flow = Math.sin(time * edge.userData.flowSpeed + edge.userData.flowOffset + edgeIndex) * 0.4 + 0.6;
                edge.material.opacity = edge.userData.originalOpacity * flow;
                
                // Occasional bright pulse along edges
                if (Math.sin(time * 0.3 + edgeIndex) > 0.95) {
                    edge.material.opacity = 0.8;
                }
            });
        });

        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }

    setupEventListeners() {
        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Add mouse interaction for subtle camera movement
        let mouseX = 0;
        let mouseY = 0;
        
        document.addEventListener('mousemove', (event) => {
            mouseX = (event.clientX - window.innerWidth / 2) * 0.001;
            mouseY = (event.clientY - window.innerHeight / 2) * 0.001;
        });

        // Subtle camera movement based on mouse
        const updateCamera = () => {
            this.camera.position.x += (mouseX * 10 - this.camera.position.x) * 0.05;
            this.camera.position.y += (-mouseY * 10 - this.camera.position.y) * 0.05;
            this.camera.lookAt(this.scene.position);
            requestAnimationFrame(updateCamera);
        };
        updateCamera();
    }

    // Method to enhance loading states with 3D spinner
    createLoadingSpinner(container) {
        const spinnerGeometry = new THREE.RingGeometry(10, 15, 8);
        const spinnerMaterial = new THREE.MeshBasicMaterial({
            color: 0x374151,
            transparent: true,
            opacity: 0.8
        });
        const spinner = new THREE.Mesh(spinnerGeometry, spinnerMaterial);
        
        // Position in front of camera
        spinner.position.z = 50;
        
        this.scene.add(spinner);
        
        const animateSpinner = () => {
            spinner.rotation.z += 0.1;
            requestAnimationFrame(animateSpinner);
        };
        animateSpinner();
        
        return spinner;
    }

    // Method to create section transition effects
    createSectionTransition() {
        // Pulse effect for section changes
        this.geometricShapes.forEach(shape => {
            const originalOpacity = shape.material.opacity;
            shape.material.opacity = 0.3;
            
            const fadeBack = () => {
                shape.material.opacity += (originalOpacity - shape.material.opacity) * 0.1;
                if (shape.material.opacity < originalOpacity - 0.01) {
                    requestAnimationFrame(fadeBack);
                }
            };
            fadeBack();
        });
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}

// Initialize Three.js background when page loads
let threeJSBackground = null;

document.addEventListener('DOMContentLoaded', () => {
    threeJSBackground = new ThreeJSBackground();
    
    // Hook into existing navigation system for transition effects
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (threeJSBackground) {
                threeJSBackground.createSectionTransition();
            }
        });
    });
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (threeJSBackground) {
        threeJSBackground.destroy();
    }
});

// Export for potential use in other scripts
window.ThreeJSEffects = {
    background: threeJSBackground,
    createLoadingSpinner: (container) => {
        return threeJSBackground ? threeJSBackground.createLoadingSpinner(container) : null;
    }
};