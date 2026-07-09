// ============================================================================
// ACS SWARM SIMULATOR & TELEMETRY ENGINE
// ============================================================================

let canvas, ctx;
let animationId;
let simActive = true;

// Swarm State Variables
let aeouv;
let drones = [];
let smartPods = [];
let animals = [];
let intruders = [];
let particles = [];
let sprouts = [];

// Log Console
const logLinesContainer = document.getElementById('log-console-lines');

// Inventory
let inventory = {
    vac: 2,
    seed: 2,
    samp: 1,
    em: 1
};

// Map Configurations
const trails = [
    { x: 50, y: 350 },
    { x: 180, y: 320 },
    { x: 300, y: 280 },
    { x: 420, y: 290 },
    { x: 550, y: 250 },
    { x: 650, y: 200 }
];

const riverPoints = [
    { x: 0, y: 150 },
    { x: 120, y: 180 },
    { x: 250, y: 200 },
    { x: 400, y: 160 },
    { x: 550, y: 120 },
    { x: 700, y: 80 }
];

// ----------------------------------------------------------------------------
// Initializer
// ----------------------------------------------------------------------------
window.onload = function() {
    initSwarmSimulator();
    initCalculator();
    
    // Listen for clicks on the canvas to deploy pods
    canvas.addEventListener('click', function(e) {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        // Only deploy if clicked inside canvas bounds and not on UI elements
        if (clickX > 0 && clickX < canvas.width && clickY > 0 && clickY < canvas.height) {
            deploySmartPodAt(clickX, clickY);
        }
    });
};

function initSwarmSimulator() {
    canvas = document.getElementById('canvas-swarm');
    ctx = canvas.getContext('2d');
    
    // 1. Initialize AEOUV
    aeouv = {
        x: trails[0].x,
        y: trails[0].y,
        targetIndex: 1,
        speed: 0.8,
        battery: 94.2,
        state: 'Patrolling', // Patrolling, Stopped, Sampling, Swapping
        armProgress: 0,
        direction: 1 // 1 forward, -1 backward
    };
    
    // 2. Initialize 3 Universal Drones (EcoWing-U)
    drones = [
        { id: 1, x: aeouv.x - 10, y: aeouv.y - 12, battery: 100, state: 'DOCKED', targetX: null, targetY: null, speed: 3.5, activePod: null, returning: false, altitude: 0, angle: 0 },
        { id: 2, x: aeouv.x, y: aeouv.y - 12, battery: 100, state: 'DOCKED', targetX: null, targetY: null, speed: 3.5, activePod: null, returning: false, altitude: 0, angle: 120 },
        { id: 3, x: aeouv.x + 10, y: aeouv.y - 12, battery: 100, state: 'DOCKED', targetX: null, targetY: null, speed: 3.5, activePod: null, returning: false, altitude: 0, angle: 240 }
    ];
    
    // 3. Initialize Deployed Smart Pods
    smartPods = [
        { id: 1, x: 100, y: 100, type: 'Acoustic', state: 'Active', pulseRadius: 0, targetPulse: 0 },
        { id: 2, x: 350, y: 80, type: 'Acoustic', state: 'Active', pulseRadius: 0, targetPulse: 0 },
        { id: 3, x: 580, y: 150, type: 'Camera', state: 'Active', pulseRadius: 0, targetPulse: 0 },
        { id: 4, x: 230, y: 210, type: 'pH River', state: 'Active', pulseRadius: 0, targetPulse: 0 }
    ];
    
    // 4. Initialize Wildlife
    animals = [
        { x: 120, y: 80, type: 'Deer', speedX: 0.2, speedY: 0.1, state: 'Grazing' },
        { x: 480, y: 60, type: 'Leopard', speedX: -0.3, speedY: 0.1, state: 'Stalking' },
        { x: 300, y: 130, type: 'Deer', speedX: 0.15, speedY: -0.15, state: 'Drinking' }
    ];
    
    // Start Game Loop
    if (animationId) cancelAnimationFrame(animationId);
    runSwarmLoop();
}

// ----------------------------------------------------------------------------
// Swarm Render & Physics Loop
// ----------------------------------------------------------------------------
function runSwarmLoop() {
    if (!simActive) return;
    
    updatePhysics();
    drawScene();
    updateTelemetryUI();
    
    animationId = requestAnimationFrame(runSwarmLoop);
}

function updatePhysics() {
    // 1. Move AEOUV along trails
    if (aeouv.state === 'Patrolling') {
        let target = trails[aeouv.targetIndex];
        let dx = target.x - aeouv.x;
        let dy = target.y - aeouv.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 2) {
            aeouv.targetIndex += aeouv.direction;
            if (aeouv.targetIndex >= trails.length || aeouv.targetIndex < 0) {
                aeouv.direction *= -1;
                aeouv.targetIndex += aeouv.direction;
            }
        } else {
            aeouv.x += (dx / dist) * aeouv.speed;
            aeouv.y += (dy / dist) * aeouv.speed;
        }
        
        // Slowly drain main battery
        aeouv.battery = Math.max(0, aeouv.battery - 0.002);
    }
    
    // 2. Manage Drones
    drones.forEach(drone => {
        if (drone.state === 'DOCKED') {
            // Keep locked to AEOUV position
            let offset = (drone.id - 2) * 12; // Spread drones slightly
            drone.x = aeouv.x + offset;
            drone.y = aeouv.y - 12;
            drone.altitude = 0;
            
            // Charge docked drone batteries
            if (drone.battery < 100) {
                drone.battery = Math.min(100, drone.battery + 0.15);
            }
        }
        else if (drone.state === 'LAUNCHING') {
            drone.altitude += 1.5;
            // Spawn thrust particles downward
            if (Math.random() < 0.4) {
                particles.push({
                    x: drone.x + (Math.random() - 0.5) * 6,
                    y: drone.y + (Math.random() - 0.5) * 4,
                    vx: (Math.random() - 0.5) * 0.4,
                    vy: 1.5 + Math.random() * 0.5,
                    radius: 1.5,
                    color: 'rgba(44, 224, 104, 0.45)',
                    life: 15,
                    type: 'thrust'
                });
            }
            if (drone.altitude >= 40) {
                drone.state = 'FLYING';
                addLog(`[DRONE ${drone.id}] Alt cruise level reached. Navigating to mission site.`);
            }
        }
        else if (drone.state === 'FLYING' || drone.state === 'RETURNING') {
            let tx = drone.targetX;
            let ty = drone.targetY;
            if (drone.state === 'RETURNING') {
                tx = aeouv.x;
                ty = aeouv.y - 12;
            }
            let dx = tx - drone.x;
            let dy = ty - drone.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 5) {
                if (drone.state === 'FLYING') {
                    drone.state = 'MISSION';
                    drone.missionTimer = 120; // 2 seconds at 60 FPS
                    addLog(`[DRONE ${drone.id}] Arrived at target coordinates. Commencing payload deployment.`);
                } else {
                    drone.state = 'LANDING';
                }
            } else {
                drone.x += (dx / dist) * drone.speed;
                drone.y += (dy / dist) * drone.speed;
            }
            drone.battery = Math.max(0, drone.battery - 0.06);
            
            // Thrust tail particles
            if (Math.random() < 0.3) {
                particles.push({
                    x: drone.x - (dx / dist) * 8 + (Math.random() - 0.5) * 3,
                    y: (drone.y - drone.altitude) - (dy / dist) * 8 + (Math.random() - 0.5) * 3,
                    vx: -(dx / dist) * 0.5 + (Math.random() - 0.5) * 0.2,
                    vy: -(dy / dist) * 0.5 + (Math.random() - 0.5) * 0.2,
                    radius: 1.5,
                    color: 'rgba(44, 224, 104, 0.4)',
                    life: 15,
                    type: 'thrust'
                });
            }
        }
        else if (drone.state === 'MISSION') {
            drone.missionTimer--;
            
            // Deploy particles based on active pod
            if (drone.activePod === 'seed' && drone.missionTimer % 12 === 0) {
                particles.push({
                    x: drone.x,
                    y: drone.y,
                    vx: (Math.random() - 0.5) * 0.6,
                    vy: 2.0 + Math.random() * 0.8,
                    radius: 3,
                    color: '#2ce068',
                    life: 45,
                    type: 'seed'
                });
            }
            else if (drone.activePod === 'vac' && drone.missionTimer === 90) {
                // Shoot a dart at poacher/animal
                particles.push({
                    x: drone.x,
                    y: drone.y,
                    vx: 0,
                    vy: 2.8,
                    radius: 2,
                    color: '#ff3b30',
                    life: 25,
                    type: 'dart',
                    tx: drone.targetX,
                    ty: drone.targetY + 20
                });
            }
            
            if (drone.missionTimer <= 0) {
                drone.state = 'RETURNING';
                addLog(`[DRONE ${drone.id}] Payload deployed. Returning to AEOUV ground hub.`);
            }
            drone.battery = Math.max(0, drone.battery - 0.08);
        }
        else if (drone.state === 'LANDING') {
            drone.altitude -= 1.5;
            if (drone.altitude <= 0) {
                drone.state = 'DOCKED';
                drone.activePod = null;
                addLog(`[DRONE ${drone.id}] Touchdown confirmed. Commencing power charging.`);
                
                // If AEOUV was stopped waiting for this drone, resume patrol
                if (aeouv.state === 'Stopped' && !drones.some(d => d.state !== 'DOCKED')) {
                    aeouv.state = 'Patrolling';
                    document.getElementById('scenario-details').innerText = "Swarm is in passive patrol mode. The AEOUV ground vehicle navigates the trail, collecting local weather telemetry.";
                }
            }
        }
    });
    
    // 3. Move Animals
    animals.forEach(animal => {
        animal.x += animal.speedX;
        animal.y += animal.speedY;
        
        // Keep inside canvas bounds and in forest area (upper half mostly)
        if (animal.x < 20 || animal.x > canvas.width - 20) animal.speedX *= -1;
        if (animal.y < 30 || animal.y > 220) animal.speedY *= -1;
        
        // Randomly change state
        if (Math.random() < 0.005) {
            animal.state = Math.random() > 0.5 ? 'Moving' : 'Grazing';
        }
    });
    
    // 4. Move Intruders (Poachers)
    intruders.forEach(intruder => {
        intruder.x += intruder.speedX;
        intruder.y += intruder.speedY;
        
        if (intruder.x < 100 || intruder.x > canvas.width - 100) intruder.speedX *= -1;
        if (intruder.y < 40 || intruder.y > 180) intruder.speedY *= -1;
    });
    
    // 5. Update Particles
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        
        // Drop effect landing
        if (p.life <= 0) {
            if (p.type === 'seed') {
                sprouts.push({ x: p.x, y: p.y + 10, radius: 1, maxRadius: 4 });
            }
            return false;
        }
        return true;
    });
    
    // Grow Sprouts (Tree botanical growth)
    sprouts.forEach(s => {
        if (s.radius < s.maxRadius) s.radius += 0.04;
    });
    
    // 6. Update smart pod pulse waves
    smartPods.forEach(pod => {
        if (pod.pulseRadius < pod.targetPulse) {
            pod.pulseRadius += 2;
        } else {
            pod.pulseRadius = 0;
            pod.targetPulse = 0;
        }
    });
}

// ----------------------------------------------------------------------------
// Canvas Draw Suite
// ----------------------------------------------------------------------------
function drawScene() {
    // Clear canvas
    ctx.fillStyle = '#060a07';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 1. Draw Forest Background elements
    // Canopy areas with dynamic wind sway
    let windSway = Math.sin(Date.now() / 650) * 4;
    
    ctx.fillStyle = 'rgba(29, 114, 59, 0.08)';
    ctx.beginPath();
    ctx.arc(150 + windSway * 0.5, 100, 120, 0, Math.PI * 2);
    ctx.arc(350 + windSway * 0.7, 90, 110, 0, Math.PI * 2);
    ctx.arc(580 + windSway * 0.5, 110, 130, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw trees in canopy zones
    drawTreeAt(120, 90, windSway);
    drawTreeAt(180, 130, windSway * 1.2);
    drawTreeAt(320, 80, windSway * 0.8);
    drawTreeAt(380, 110, windSway * 1.1);
    drawTreeAt(540, 100, windSway * 0.9);
    drawTreeAt(620, 140, windSway * 1.3);
    
    // 2. Draw River with flowing ripple lines
    ctx.strokeStyle = 'rgba(0, 122, 255, 0.25)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(riverPoints[0].x, riverPoints[0].y);
    for (let i = 1; i < riverPoints.length; i++) {
        ctx.lineTo(riverPoints[i].x, riverPoints[i].y);
    }
    ctx.stroke();
    
    // River current ripples flow animation
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    let rippleOffset = (Date.now() / 25) % 45;
    ctx.setLineDash([10, 20]);
    ctx.beginPath();
    ctx.moveTo(riverPoints[0].x + rippleOffset, riverPoints[0].y);
    for (let i = 1; i < riverPoints.length; i++) {
        ctx.lineTo(riverPoints[i].x + rippleOffset, riverPoints[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 3. Draw Trail Path
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(trails[0].x, trails[0].y);
    for (let i = 1; i < trails.length; i++) {
        ctx.lineTo(trails[i].x, trails[i].y);
    }
    ctx.stroke();
    
    // 4. Draw Sprouts (Growing Tree nodes)
    sprouts.forEach(s => {
        // Draw wood trunk
        ctx.strokeStyle = '#8b5a2b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x, s.y - s.radius * 2.2);
        ctx.stroke();
        
        // Draw green leaves canopy
        ctx.fillStyle = '#1d723b';
        ctx.beginPath();
        ctx.arc(s.x, s.y - s.radius * 2.2, s.radius * 1.6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#2ce068';
        ctx.beginPath();
        ctx.arc(s.x - s.radius * 0.4, s.y - s.radius * 2.5, s.radius * 0.8, 0, Math.PI * 2);
        ctx.arc(s.x + s.radius * 0.4, s.y - s.radius * 2.0, s.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // 5. Draw Mesh Network Connections & Data Packet Pulses
    let dataPulseProgress = (Date.now() / 20) % 100;
    
    for (let i = 0; i < smartPods.length; i++) {
        let p1 = smartPods[i];
        
        for (let j = i + 1; j < smartPods.length; j++) {
            let p2 = smartPods[j];
            let dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
            
            if (dist < 300) {
                // Base mesh lines
                ctx.strokeStyle = 'rgba(44, 224, 104, 0.12)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Flowing data pulse particle
                let ratio = dataPulseProgress / 100;
                let pulseX = p1.x + (p2.x - p1.x) * ratio;
                let pulseY = p1.y + (p2.y - p1.y) * ratio;
                ctx.fillStyle = 'rgba(44, 224, 104, 0.7)';
                ctx.beginPath();
                ctx.arc(pulseX, pulseY, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Connect mesh to AEOUV base
        let dToAeouv = Math.sqrt((p1.x - aeouv.x) ** 2 + (p1.y - aeouv.y) ** 2);
        if (dToAeouv < 250) {
            ctx.strokeStyle = 'rgba(44, 224, 104, 0.25)';
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(aeouv.x, aeouv.y - 12);
            ctx.stroke();
            
            // Flowing data pulse to vehicle
            let ratio = dataPulseProgress / 100;
            let pulseX = p1.x + (aeouv.x - p1.x) * ratio;
            let pulseY = p1.y + ((aeouv.y - 12) - p1.y) * ratio;
            ctx.fillStyle = 'rgba(44, 224, 104, 0.8)';
            ctx.beginPath();
            ctx.arc(pulseX, pulseY, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // 6. Draw Smart Pod Nodes
    smartPods.forEach(pod => {
        ctx.fillStyle = pod.state === 'Triggered' ? '#ff3b30' : '#2ce068';
        ctx.beginPath();
        ctx.arc(pod.x, pod.y, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw sensor node outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pod.x, pod.y, 8, 0, Math.PI * 2);
        ctx.stroke();
        
        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '9px Outfit';
        ctx.fillText(`${pod.type} #${pod.id}`, pod.x - 22, pod.y - 12);
        
        // Render pulse wave if triggered
        if (pod.pulseRadius > 0) {
            ctx.strokeStyle = pod.state === 'Triggered' ? 'rgba(255, 59, 48, 0.4)' : 'rgba(44, 224, 104, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(pod.x, pod.y, pod.pulseRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
    });
    
    // 7. Draw Wildlife
    animals.forEach(animal => {
        ctx.fillStyle = '#ff9f1c';
        ctx.beginPath();
        ctx.arc(animal.x, animal.y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '8px Inter';
        ctx.fillText(animal.type, animal.x - 10, animal.y - 8);
    });
    
    // 8. Draw Intruders
    intruders.forEach(intruder => {
        ctx.fillStyle = '#ff3b30';
        ctx.beginPath();
        ctx.arc(intruder.x, intruder.y, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(255, 59, 48, 0.8)';
        ctx.font = '8px Courier New';
        ctx.fillText('INTRUDER', intruder.x - 20, intruder.y - 10);
    });
    
    // 9. Draw AEOUV Vehicle Base
    drawAEOUV();
    
    // 10. Draw Particles (seed drop, darts, thruster smoke)
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // 11. Draw Drones
    drones.forEach(drone => {
        if (drone.state !== 'DOCKED') {
            drawDrone(drone);
        }
    });
    
    // 12. Futuristic HUD Overlay
    drawHUDOverlay();
}

function drawTreeAt(x, y, sway) {
    // Draw trunk
    ctx.strokeStyle = '#2d1e10';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + sway * 0.4, y - 24);
    ctx.stroke();
    
    // Canopy leaf circles
    ctx.fillStyle = 'rgba(29, 114, 59, 0.4)';
    ctx.beginPath();
    ctx.arc(x + sway * 0.5, y - 25, 14, 0, Math.PI * 2);
    ctx.arc(x + sway * 0.5 - 8, y - 30, 11, 0, Math.PI * 2);
    ctx.arc(x + sway * 0.5 + 8, y - 28, 12, 0, Math.PI * 2);
    ctx.fill();
}

function drawHUDOverlay() {
    // Grid Corners
    ctx.strokeStyle = 'rgba(44, 224, 104, 0.35)';
    ctx.lineWidth = 1.5;
    const pad = 12;
    const len = 10;
    
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(pad, pad + len); ctx.lineTo(pad, pad); ctx.lineTo(pad + len, pad);
    ctx.stroke();
    
    // Top-Right
    ctx.beginPath();
    ctx.moveTo(canvas.width - pad, pad + len); ctx.lineTo(canvas.width - pad, pad); ctx.lineTo(canvas.width - pad - len, pad);
    ctx.stroke();
    
    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(pad, canvas.height - pad - len); ctx.lineTo(pad, canvas.height - pad); ctx.lineTo(pad + len, canvas.height - pad);
    ctx.stroke();
    
    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(canvas.width - pad, canvas.height - pad - len); ctx.lineTo(canvas.width - pad, canvas.height - pad); ctx.lineTo(canvas.width - pad - len, canvas.height - pad);
    ctx.stroke();
    
    // HUD Scanline
    let scanY = (Date.now() / 22) % (canvas.height + 40) - 20;
    ctx.fillStyle = 'rgba(44, 224, 104, 0.03)';
    ctx.fillRect(0, scanY - 4, canvas.width, 8);
    ctx.strokeStyle = 'rgba(44, 224, 104, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, scanY);
    ctx.lineTo(canvas.width, scanY);
    ctx.stroke();
    
    // HUD Labels
    ctx.fillStyle = 'rgba(44, 224, 104, 0.65)';
    ctx.font = '700 9px Outfit';
    ctx.fillText('SWARM: SECURE', pad + 15, pad + 11);
    ctx.fillText('MESH STATS: CONNECTED', canvas.width - pad - 128, pad + 11);
}

function drawAEOUV() {
    // Draw body
    ctx.fillStyle = '#18231b';
    ctx.strokeStyle = '#2ce068';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(aeouv.x - 15, aeouv.y - 8, 30, 16);
    ctx.fill();
    ctx.stroke();
    
    // Draw wheels
    ctx.fillStyle = '#000000';
    ctx.fillRect(aeouv.x - 14, aeouv.y - 11, 8, 4);
    ctx.fillRect(aeouv.x + 6, aeouv.y - 11, 8, 4);
    ctx.fillRect(aeouv.x - 14, aeouv.y + 7, 8, 4);
    ctx.fillRect(aeouv.x + 6, aeouv.y + 7, 8, 4);
    
    // Draw LiDAR spinner (rotating line)
    ctx.strokeStyle = 'rgba(44, 224, 104, 0.8)';
    ctx.lineWidth = 1;
    let angle = (Date.now() / 150) % (Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(aeouv.x, aeouv.y);
    ctx.lineTo(aeouv.x + Math.cos(angle) * 20, aeouv.y + Math.sin(angle) * 20);
    ctx.stroke();
    
    // Draw rotating scan sweep cone
    ctx.fillStyle = 'rgba(44, 224, 104, 0.05)';
    ctx.beginPath();
    ctx.moveTo(aeouv.x, aeouv.y);
    ctx.arc(aeouv.x, aeouv.y, 20, angle - 0.2, angle + 0.2);
    ctx.closePath();
    ctx.fill();
    
    // Robotic Arm rendering (when Sampling)
    if (aeouv.state === 'Sampling') {
        ctx.strokeStyle = '#ff9f1c';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        
        let armX1 = aeouv.x;
        let armY1 = aeouv.y;
        
        // Arm joint dynamics
        let armX2 = aeouv.x - 20 * Math.sin(aeouv.armProgress);
        let armY2 = aeouv.y - 30 * Math.sin(aeouv.armProgress);
        
        ctx.beginPath();
        ctx.moveTo(armX1, armY1);
        ctx.lineTo(armX2, armY2);
        ctx.stroke();
        
        // Sampling ripples
        ctx.strokeStyle = 'rgba(255, 159, 28, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(armX2, armY2, (Date.now() / 15) % 15, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function drawDrone(drone) {
    // Offset height (perspective altitude shadow)
    let alt = drone.altitude;
    
    // Draw shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(drone.x, drone.y + alt * 0.4, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw drone body
    ctx.fillStyle = drone.activePod ? '#2ce068' : '#ffffff';
    ctx.beginPath();
    ctx.arc(drone.x, drone.y - alt, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw rotors (lines)
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    let rAngle = (Date.now() / 35) % (Math.PI * 2);
    
    ctx.beginPath();
    ctx.moveTo(drone.x - 10 * Math.cos(rAngle), drone.y - alt - 10 * Math.sin(rAngle));
    ctx.lineTo(drone.x + 10 * Math.cos(rAngle), drone.y - alt + 10 * Math.sin(rAngle));
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(drone.x - 10 * Math.sin(rAngle), drone.y - alt + 10 * Math.cos(rAngle));
    ctx.lineTo(drone.x + 10 * Math.sin(rAngle), drone.y - alt - 10 * Math.cos(rAngle));
    ctx.stroke();
    
    // Active label
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '8px Outfit';
    ctx.fillText(`D${drone.id}`, drone.x - 5, drone.y - alt - 14);
    
    // Draw camera scan cone if in MISSION mode (scouting)
    if (drone.state === 'MISSION') {
        ctx.fillStyle = 'rgba(44, 224, 104, 0.1)';
        ctx.strokeStyle = 'rgba(44, 224, 104, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(drone.x, drone.y - alt);
        ctx.lineTo(drone.targetX - 25, drone.targetY + 25);
        ctx.lineTo(drone.targetX + 25, drone.targetY + 25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Target bounding box overlay
        ctx.strokeStyle = drone.activePod === 'vac' ? '#ff3b30' : '#2ce068';
        ctx.strokeRect(drone.targetX - 12, drone.targetY - 12, 24, 24);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '7px Courier New';
        ctx.fillText('TARGET DETECTED', drone.targetX - 28, drone.targetY - 16);
    }
}

// ----------------------------------------------------------------------------
// Swarm Telemetry & Log Console Updates
// ----------------------------------------------------------------------------
function updateTelemetryUI() {
    // AEOUV battery display
    document.getElementById('tel-aeouv-bat').innerText = aeouv.battery.toFixed(1);
    
    // Drones status displays
    for (let i = 1; i <= 3; i++) {
        let d = drones[i - 1];
        let statusEl = document.getElementById(`tel-d${i}-status`);
        let batEl = document.getElementById(`tel-d${i}-bat`);
        
        batEl.innerText = d.battery.toFixed(0);
        statusEl.innerText = d.state;
        
        if (d.state === 'DOCKED') {
            statusEl.className = 'status-off';
        } else if (d.state === 'FLYING' || d.state === 'LAUNCHING') {
            statusEl.className = 'status-on';
        } else if (d.state === 'MISSION') {
            statusEl.className = 'status-on';
            statusEl.style.color = '#ff9f1c'; // Alert status
        } else {
            statusEl.className = 'status-off';
        }
    }
    
    // Update inventory badges UI
    document.getElementById('inv-vac').innerText = inventory.vac;
    document.getElementById('inv-seed').innerText = inventory.seed;
    document.getElementById('inv-samp').innerText = inventory.samp;
    document.getElementById('inv-em').innerText = inventory.em;
}

function addLog(text, colorClass = '') {
    const p = document.createElement('div');
    p.className = `log-line ${colorClass}`;
    p.innerText = `${new Date().toLocaleTimeString()} ${text}`;
    logLinesContainer.appendChild(p);
    
    // Auto-scroll
    logLinesContainer.scrollTop = logLinesContainer.scrollHeight;
}

// ----------------------------------------------------------------------------
// Swarm Control Logic - Scenarios Trigger
// ----------------------------------------------------------------------------
function triggerScenario(type) {
    if (type === 'poacher') {
        // Spawn poacher if none active
        if (intruders.length === 0) {
            let px = 380;
            let py = 60;
            intruders.push({ x: px, y: py, speedX: 0.1, speedY: 0 });
            
            // Trigger Acoustic Pod pulse
            let pod = smartPods[1]; // Pod #2 is closest to (380, 60)
            pod.state = 'Triggered';
            pod.targetPulse = 180;
            
            addLog(`[MESH NET] Acoustic Pod #2 triggered: Chainsaw signatures detected in valley.`, 'text-red');
            document.getElementById('scenario-details').innerText = "ALERT: Poacher intrusion detected by tree-mounted acoustic sensors. Swarm AI is organizing a dynamic response.";
            
            // AEOUV halts
            aeouv.state = 'Stopped';
            
            // Swaps pod and launches Drone 1
            setTimeout(() => {
                addLog(`[AEOUV] Swapping Drone 1 to Vaccination/Scout Pod in AMB (Estimated time: 25s)`);
                inventory.vac = Math.max(0, inventory.vac - 1);
                
                setTimeout(() => {
                    let d = drones[0];
                    d.state = 'LAUNCHING';
                    d.activePod = 'vac';
                    d.targetX = px;
                    d.targetY = py;
                    addLog(`[AEOUV] Drone 1 launched with Vaccination/Scout Pod. Flying to target coordinates.`, 'text-green');
                    
                    // Capture poacher
                    setTimeout(() => {
                        intruders = [];
                        pod.state = 'Active';
                        addLog(`[DRONE 1] Neutralization/treatment dart successfully delivered. Intruder cleared.`, 'text-orange');
                    }, 4500);
                    
                }, 2000);
            }, 1000);
        }
    }
    else if (type === 'seed') {
        // Find first docked drone
        let idleDrone = drones.find(d => d.state === 'DOCKED');
        if (idleDrone) {
            addLog(`[AEOUV] Reforestation directive received. Swapping Drone ${idleDrone.id} to Seed Pod.`);
            inventory.seed = Math.max(0, inventory.seed - 1);
            
            aeouv.state = 'Stopped';
            
            setTimeout(() => {
                idleDrone.state = 'LAUNCHING';
                idleDrone.activePod = 'seed';
                // Pick a barren area coordinates (left/mid-left)
                idleDrone.targetX = 180;
                idleDrone.targetY = 70;
                addLog(`[AEOUV] Drone ${idleDrone.id} deployed for afforestation seed drop.`, 'text-green');
                document.getElementById('scenario-details').innerText = "MISSION: Deploying drone with seed capsules to launch aerial reforestation drop on steep clearing.";
            }, 2000);
        } else {
            addLog(`[SYSTEM] Swarm error: No docked drones currently available.`, 'text-red');
        }
    }
    else if (type === 'sampling') {
        // Move AEOUV close to river sampling point
        addLog(`[AEOUV] Robotic Arm sampling command received. Navigating to nearest river beat.`);
        aeouv.state = 'Patrolling';
        aeouv.speed = 1.8; // Speed up
        
        let checkSampling = setInterval(() => {
            // Distance to river point #3 (250, 200) or check if on trail near river
            let dx = aeouv.x - 280;
            let dy = aeouv.y - 290;
            let dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 30) {
                clearInterval(checkSampling);
                aeouv.state = 'Sampling';
                aeouv.armProgress = 0.1;
                addLog(`[AEOUV] River waypoint reached. Deploying 5-DOF arm.`, 'text-green');
                document.getElementById('scenario-details').innerText = "SAMPLING: Ground hub deploying robotic arm to collect river water. Diagnostics run locally.";
                
                // Arm sweep animation loop
                let armLoop = setInterval(() => {
                    aeouv.armProgress += 0.05;
                    if (aeouv.armProgress >= Math.PI / 3.2) {
                        clearInterval(armLoop);
                        // Complete sampling
                        aeouv.state = 'Patrolling';
                        aeouv.speed = 0.8;
                        addLog(`[AEOUV] Water sample collected and cataloged. pH = 7.1, Dissolved Oxygen = 8.2mg/L.`, 'text-orange');
                        document.getElementById('scenario-details').innerText = "Swarm is in passive patrol mode. The AEOUV ground vehicle navigates the trail, collecting local weather telemetry.";
                    }
                }, 100);
            }
        }, 100);
    }
    else if (type === 'deploy-pod') {
        // Deploy pod at a random coordinate
        let rx = 100 + Math.random() * (canvas.width - 200);
        let ry = 80 + Math.random() * 120;
        deploySmartPodAt(rx, ry);
    }
}

function deploySmartPodAt(x, y) {
    let idleDrone = drones.find(d => d.state === 'DOCKED');
    if (idleDrone) {
        addLog(`[AEOUV] Swapping Drone ${idleDrone.id} to Delivery Pod to drop new Smart Pod.`);
        inventory.em = Math.max(0, inventory.em - 1);
        
        aeouv.state = 'Stopped';
        
        setTimeout(() => {
            idleDrone.state = 'LAUNCHING';
            idleDrone.activePod = 'em';
            idleDrone.targetX = x;
            idleDrone.targetY = y;
            addLog(`[AEOUV] Drone ${idleDrone.id} dispatched to place Smart Pod at (${x.toFixed(0)}, ${y.toFixed(0)}).`, 'text-green');
            document.getElementById('scenario-details').innerText = `DEPLOYMENT: Swarming Drone ${idleDrone.id} placing passive monitoring node at targeted coordinate.`;
            
            // Once drone reaches, insert a new Smart Pod
            let checkArrived = setInterval(() => {
                if (idleDrone.state === 'MISSION') {
                    clearInterval(checkArrived);
                    
                    // Create new pod in system
                    let newId = smartPods.length + 1;
                    smartPods.push({
                        id: newId,
                        x: x,
                        y: y,
                        type: 'Mesh Node',
                        state: 'Active',
                        pulseRadius: 0,
                        targetPulse: 100
                    });
                    
                    addLog(`[SYSTEM] Mesh Node #${newId} placed successfully. Linking with adjacent nodes.`, 'text-orange');
                }
            }, 200);
            
        }, 2000);
    } else {
        addLog(`[SYSTEM] Swarm error: No docked drones currently available.`, 'text-red');
    }
}

// ----------------------------------------------------------------------------
// Pitch Hub Tab Selection
// ----------------------------------------------------------------------------
function switchPitchTab(tabId, element) {
    const tabs = document.querySelectorAll('#pitch-hub .tab-content');
    const buttons = document.querySelectorAll('#pitch-hub .tab-btn');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    buttons.forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    element.classList.add('active');
}

// ----------------------------------------------------------------------------
// ROI Financial Calculator
// ----------------------------------------------------------------------------
function initCalculator() {
    const fleetSlider = document.getElementById('calc-fleet');
    const distSlider = document.getElementById('calc-dist');
    const dieselSlider = document.getElementById('calc-diesel');
    const yearsSlider = document.getElementById('calc-years');
    
    // Event listeners
    fleetSlider.addEventListener('input', updateCalcDisplay);
    distSlider.addEventListener('input', updateCalcDisplay);
    dieselSlider.addEventListener('input', updateCalcDisplay);
    yearsSlider.addEventListener('input', updateCalcDisplay);
    
    // Initial calculate
    updateCalcDisplay();
}

function updateCalcDisplay() {
    const fleet = parseFloat(document.getElementById('calc-fleet').value);
    const dist = parseFloat(document.getElementById('calc-dist').value);
    const diesel = parseFloat(document.getElementById('calc-diesel').value);
    const years = parseFloat(document.getElementById('calc-years').value);
    
    // Update value labels
    document.getElementById('val-calc-fleet').innerText = `${fleet} System${fleet > 1 ? 's' : ''}`;
    document.getElementById('val-calc-dist').innerText = `${dist} km`;
    document.getElementById('val-calc-diesel').innerText = `₹${diesel}`;
    document.getElementById('val-calc-years').innerText = `${years} Year${years > 1 ? 's' : ''}`;
    
    // ROI Formulas
    // 1. Total patrol cost saved compared to conventional patrol diesel vehicles
    // Diesel vehicle consumes ~0.15 liters per km. Maintenance adds 30%.
    const convPatrolCost = fleet * dist * 365 * years * 0.15 * diesel * 1.30;
    // Electric vehicle cost is ~80% cheaper in electricity vs fuel and low maintenance.
    const acsCost = convPatrolCost * 0.18;
    const netSavings = (convPatrolCost - acsCost) / 100000; // in Lakhs
    
    // 2. CO2 emissions prevented (2.68 kg CO2 per liter diesel consumed)
    const co2Saved = (fleet * dist * 365 * years * 0.15 * 2.68) / 1000; // in tons
    
    // 3. Habitat protection index (ratio of off-road footprint avoidance)
    // Drones cover off-road areas with 0 weight on soil.
    const footprintRatio = 92.5 + (fleet * 0.2); // baseline percentage
    const finalRatio = Math.min(99.8, footprintRatio);
    
    // Update display values
    document.getElementById('res-savings').innerText = `₹${netSavings.toFixed(1)} Lakhs`;
    document.getElementById('res-co2').innerText = `${co2Saved.toFixed(0)} Tons`;
    document.getElementById('res-payback').innerText = `${finalRatio.toFixed(1)} %`;
}
