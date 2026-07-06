// PAGE & PITCH HUB NAVIGATION
function switchPitchTab(tabId, element) {
    const tabs = document.querySelectorAll('#pitch-hub .tab-content');
    const buttons = document.querySelectorAll('#pitch-hub .tab-btn');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    buttons.forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    element.classList.add('active');
}

// SIMULATION TABS SELECTION
function selectSim(simId) {
    const panels = document.querySelectorAll('.sim-control-panel');
    const viewports = document.querySelectorAll('.viewport-content');
    const buttons = document.querySelectorAll('.sim-tab-btn');
    
    panels.forEach(panel => panel.classList.add('hidden'));
    viewports.forEach(view => view.classList.add('hidden'));
    buttons.forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`panel-${simId}`).classList.remove('hidden');
    document.getElementById(`view-${simId}`).classList.remove('hidden');
    document.getElementById(`btn-sim-${simId}`).classList.add('active');

    // Trigger resizing/refit of canvases if running
    if (simId === 'aeb') initAEBCanvas();
    if (simId === 'lka') initLKACanvas();
}

// -------------------------------------------------------------
// 1. AEB (AUTONOMOUS EMERGENCY BRAKING) SIMULATOR
// -------------------------------------------------------------
let aebCanvas, aebCtx;
let aebChartCanvas, aebChartCtx;
let aebAnimationId;
let aebRunning = false;
let aebX = 50; // Buggy X coordinate
let aebSpeed = 25; // Speed in km/h
let aebDist = 35; // Distance in m
let aebFriction = 0.6; // Coefficient of friction (based on surface)
let aebState = 'Standby'; // Standby, Driving, Braking, Safe Stop, Collision
let aebObstacleX = 550;
let aebBuggyWidth = 80;
let aebScale = 10; // 10 pixels = 1 meter
let aebDataPoints = []; // Deceleration data points for graphing

// Controls & Telemetry Elements
const sliderAebSpeed = document.getElementById('aeb-speed');
const sliderAebDist = document.getElementById('aeb-dist');
const selectAebSurface = document.getElementById('aeb-surface');
const telAebSpeed = document.getElementById('tel-aeb-speed');
const telAebBrake = document.getElementById('tel-aeb-brake');
const telAebStatus = document.getElementById('tel-aeb-status');

sliderAebSpeed.addEventListener('input', (e) => {
    document.getElementById('val-aeb-speed').innerText = e.target.value;
    resetAEB();
});
sliderAebDist.addEventListener('input', (e) => {
    document.getElementById('val-aeb-dist').innerText = e.target.value;
    resetAEB();
});
selectAebSurface.addEventListener('change', () => {
    resetAEB();
});

function initAEBCanvas() {
    aebCanvas = document.getElementById('canvas-aeb');
    aebCtx = aebCanvas.getContext('2d');
    aebChartCanvas = document.getElementById('chart-aeb');
    aebChartCtx = aebChartCanvas.getContext('2d');
    
    drawAEBScene();
    drawAEBPlot();
}

function resetAEB() {
    cancelAnimationFrame(aebAnimationId);
    aebRunning = false;
    aebX = 50;
    aebSpeed = parseFloat(sliderAebSpeed.value);
    aebDist = parseFloat(sliderAebDist.value);
    
    // Set friction based on surface selection
    const surface = selectAebSurface.value;
    if (surface === 'dry-dirt') aebFriction = 0.65;
    else if (surface === 'wet-mud') aebFriction = 0.35;
    else if (surface === 'gravel') aebFriction = 0.50;

    aebObstacleX = 100 + (aebDist * aebScale);
    aebState = 'Standby';
    aebDataPoints = [];
    
    telAebSpeed.innerText = aebSpeed.toFixed(1);
    telAebBrake.innerText = '0';
    telAebStatus.innerText = aebState;
    telAebStatus.className = 'status-off';
    
    drawAEBScene();
    drawAEBPlot();
}

function drawAEBScene() {
    aebCtx.clearRect(0, 0, aebCanvas.width, aebCanvas.height);
    
    // Draw Ground
    aebCtx.fillStyle = '#1c241f';
    aebCtx.fillRect(0, 200, aebCanvas.width, aebCanvas.height - 200);
    aebCtx.strokeStyle = 'rgba(44, 224, 104, 0.2)';
    aebCtx.lineWidth = 2;
    aebCtx.beginPath();
    aebCtx.moveTo(0, 200);
    aebCtx.lineTo(aebCanvas.width, 200);
    aebCtx.stroke();
    
    // Draw Sky Background
    aebCtx.fillStyle = '#0b110d';
    aebCtx.fillRect(0, 0, aebCanvas.width, 200);
    
    // Draw background trees (simplified vectors)
    aebCtx.fillStyle = 'rgba(29, 114, 59, 0.1)';
    for (let i = 20; i < aebCanvas.width; i += 80) {
        aebCtx.beginPath();
        aebCtx.moveTo(i, 200);
        aebCtx.lineTo(i + 30, 110);
        aebCtx.lineTo(i + 60, 200);
        aebCtx.fill();
    }

    // Draw Distance Markers
    aebCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    aebCtx.font = '10px Inter';
    for (let x = 100; x < aebCanvas.width; x += 100) {
        aebCtx.fillRect(x, 195, 2, 10);
        let distLabel = ((x - 100) / aebScale).toFixed(0) + 'm';
        aebCtx.fillText(distLabel, x - 10, 220);
    }
    
    // Draw Active Sensor Range (LiDAR/Camera Scan Wedge)
    if (aebState === 'Driving' || aebState === 'Braking') {
        const gradient = aebCtx.createRadialGradient(aebX + aebBuggyWidth, 150, 5, aebX + aebBuggyWidth, 150, 200);
        if (aebState === 'Braking') {
            gradient.addColorStop(0, 'rgba(255, 59, 48, 0.25)');
            gradient.addColorStop(1, 'rgba(255, 59, 48, 0)');
        } else {
            gradient.addColorStop(0, 'rgba(44, 224, 104, 0.25)');
            gradient.addColorStop(1, 'rgba(44, 224, 104, 0)');
        }
        aebCtx.fillStyle = gradient;
        aebCtx.beginPath();
        aebCtx.moveTo(aebX + aebBuggyWidth - 10, 140);
        aebCtx.lineTo(aebX + aebBuggyWidth + 180, 110);
        aebCtx.lineTo(aebX + aebBuggyWidth + 180, 190);
        aebCtx.closePath();
        aebCtx.fill();
    }

    // Draw Obstacle (Fallen Log / Tree)
    aebCtx.fillStyle = '#8b5a2b';
    aebCtx.strokeStyle = '#5c3a21';
    aebCtx.lineWidth = 3;
    aebCtx.fillRect(aebObstacleX, 160, 20, 40);
    aebCtx.strokeRect(aebObstacleX, 160, 20, 40);
    // Draw warning flag on obstacle
    aebCtx.fillStyle = varColor('accent-red');
    aebCtx.beginPath();
    aebCtx.moveTo(aebObstacleX + 10, 160);
    aebCtx.lineTo(aebObstacleX - 10, 145);
    aebCtx.lineTo(aebObstacleX + 10, 130);
    aebCtx.fill();
    aebCtx.strokeStyle = '#fff';
    aebCtx.beginPath();
    aebCtx.moveTo(aebObstacleX + 10, 160);
    aebCtx.lineTo(aebObstacleX + 10, 130);
    aebCtx.stroke();

    // Draw Vehicle (Stylized aBAJA Buggy)
    drawBuggy(aebX, 150);
}

function drawBuggy(x, y) {
    // Wheels
    aebCtx.fillStyle = '#050706';
    aebCtx.beginPath();
    aebCtx.arc(x + 15, y + 40, 16, 0, Math.PI * 2);
    aebCtx.arc(x + 65, y + 40, 16, 0, Math.PI * 2);
    aebCtx.fill();
    
    // Hubcaps (green accent)
    aebCtx.fillStyle = varColor('primary-glow');
    aebCtx.beginPath();
    aebCtx.arc(x + 15, y + 40, 6, 0, Math.PI * 2);
    aebCtx.arc(x + 65, y + 40, 6, 0, Math.PI * 2);
    aebCtx.fill();

    // Roll cage frame structure
    aebCtx.strokeStyle = varColor('text');
    aebCtx.lineWidth = 3;
    
    // Roll Cage lines
    aebCtx.beginPath();
    aebCtx.moveTo(x + 5, y + 25); // Lower back
    aebCtx.lineTo(x + 20, y - 5); // RRH Top
    aebCtx.lineTo(x + 50, y - 5); // RHO Top
    aebCtx.lineTo(x + 75, y + 20); // Front Brace
    aebCtx.lineTo(x + 65, y + 35); // Front frame lower
    aebCtx.lineTo(x + 5, y + 35); // LFS bottom
    aebCtx.closePath();
    aebCtx.stroke();
    
    // Diagonal brace
    aebCtx.beginPath();
    aebCtx.moveTo(x + 20, y - 5);
    aebCtx.lineTo(x + 35, y + 35);
    aebCtx.stroke();

    // Body panel (glowing gradient body panel)
    aebCtx.fillStyle = varColor('primary');
    aebCtx.fillRect(x + 10, y + 15, 45, 20);
    aebCtx.fillStyle = varColor('primary-glow');
    aebCtx.fillRect(x + 55, y + 20, 15, 15);
    
    // Dashboard TSAL/ASAL lights (pulsing display)
    const time = Date.now() * 0.005;
    const pulse = Math.sin(time) > 0;
    
    // ASAL Active Indicator on Buggy top
    aebCtx.fillStyle = (pulse && aebState === 'Braking') ? varColor('accent-red') : varColor('accent');
    aebCtx.beginPath();
    aebCtx.arc(x + 35, y - 8, 4, 0, Math.PI * 2);
    aebCtx.fill();
}

function startAEBSim() {
    if (aebRunning) return;
    resetAEB();
    aebRunning = true;
    aebState = 'Driving';
    telAebStatus.className = 'status-on';
    runAEBLoop();
}

function runAEBLoop() {
    if (!aebRunning) return;
    
    // Physics parameters
    let velocityMS = (aebSpeed * 1000) / 3600; // km/h to m/s
    const gravity = 9.81;
    const decelMax = aebFriction * gravity; // m/s^2 deceleration
    const dt = 1 / 60; // frame time

    const buggyFrontX = aebX + aebBuggyWidth;
    const distanceToObstacle = (aebObstacleX - buggyFrontX) / aebScale; // in meters
    
    // AEB Algorithmic Decision Window
    // Stopping distance formula: d = v^2 / (2 * a)
    // Add reaction time buffer (say 150ms computational reaction)
    const reactionBuffer = 0.15;
    const requiredStoppingDist = (velocityMS * velocityMS) / (2 * decelMax) + (velocityMS * reactionBuffer);
    
    let brakePressure = 0;
    
    if (distanceToObstacle <= requiredStoppingDist && aebSpeed > 0) {
        aebState = 'Braking';
        // Decelerate vehicle
        velocityMS -= decelMax * dt;
        aebSpeed = (velocityMS * 3600) / 1000;
        
        if (aebSpeed < 0.1) {
            aebSpeed = 0;
            aebState = 'Safe Stop';
        }
        
        brakePressure = 100; // Full braking
    } else if (aebSpeed > 0) {
        // Drive at constant configured speed
        aebX += (velocityMS * aebScale) * dt;
    }
    
    // Check Collision
    if (buggyFrontX >= aebObstacleX && aebSpeed > 0) {
        aebSpeed = 0;
        aebState = 'Collision';
        brakePressure = 0;
        aebRunning = false;
    }
    
    // Update Telemetry
    telAebSpeed.innerText = aebSpeed.toFixed(1);
    telAebBrake.innerText = brakePressure.toFixed(0);
    telAebStatus.innerText = aebState;
    
    if (aebState === 'Braking') {
        telAebStatus.className = 'status-on';
        telAebStatus.style.color = varColor('accent');
    } else if (aebState === 'Safe Stop') {
        telAebStatus.className = 'status-on';
        telAebStatus.style.color = varColor('primary-glow');
        aebRunning = false;
    } else if (aebState === 'Collision') {
        telAebStatus.className = 'status-off';
        telAebStatus.style.color = varColor('accent-red');
    }

    // Save Data point for deceleration graph
    if (aebState === 'Braking' || aebState === 'Safe Stop') {
        aebDataPoints.push({
            dist: distanceToObstacle,
            speed: aebSpeed
        });
    }

    drawAEBScene();
    drawAEBPlot();
    
    if (aebRunning) {
        aebAnimationId = requestAnimationFrame(runAEBLoop);
    }
}

function drawAEBPlot() {
    aebChartCtx.clearRect(0, 0, aebChartCanvas.width, aebChartCanvas.height);
    
    // Draw grid lines
    aebChartCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    aebChartCtx.lineWidth = 1;
    for (let i = 20; i < aebChartCanvas.width; i += 40) {
        aebChartCtx.beginPath();
        aebChartCtx.moveTo(i, 0);
        aebChartCtx.lineTo(i, aebChartCanvas.height);
        aebChartCtx.stroke();
    }
    
    // If no data points, draw a straight baseline
    aebChartCtx.strokeStyle = varColor('primary-glow');
    aebChartCtx.lineWidth = 2;
    aebChartCtx.beginPath();
    
    if (aebDataPoints.length === 0) {
        aebChartCtx.moveTo(0, 30);
        aebChartCtx.lineTo(aebChartCanvas.width, 30);
        aebChartCtx.stroke();
        return;
    }
    
    // Plot decel curve points
    const maxVal = parseFloat(sliderAebSpeed.value);
    aebChartCtx.moveTo(0, 10 + (1 - aebDataPoints[0].speed / maxVal) * (aebChartCanvas.height - 20));
    
    for (let i = 1; i < aebDataPoints.length; i++) {
        let x = (i / aebDataPoints.length) * aebChartCanvas.width;
        let y = 10 + (1 - aebDataPoints[i].speed / maxVal) * (aebChartCanvas.height - 20);
        aebChartCtx.lineTo(x, y);
    }
    aebChartCtx.stroke();
}

// Helper to resolve CSS variable colors
function varColor(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
}

// -------------------------------------------------------------
// 2. LKA (LANE KEEP ASSIST) SIMULATOR
// -------------------------------------------------------------
let lkaCanvas, lkaCtx;
let lkaAnimationId;
let lkaRunning = false;
let lkaMode = 'auto'; // auto, manual
let buggyLkaSpeed = 20;
let buggyLkaX = 350;
let buggyLkaY = 280;
let steerAngle = 0; // steering correction angle
let trackAngle = 0; // Winding track current angle
let lkaFrame = 0;
let roadCurves = []; // curve segments of forest track
let deviation = 0; // deviation from lane center

const selectLkaControl = document.getElementById('lka-control');
const sliderLkaSpeed = document.getElementById('lka-speed');
const telLkaStatus = document.getElementById('tel-lka-status');
const telLkaSteer = document.getElementById('tel-lka-steer');
const telLkaDev = document.getElementById('tel-lka-dev');

sliderLkaSpeed.addEventListener('input', (e) => {
    document.getElementById('val-lka-speed').innerText = e.target.value;
    buggyLkaSpeed = parseFloat(e.target.value);
});

function toggleLkaMode() {
    lkaMode = selectLkaControl.value;
    if (lkaMode === 'auto') {
        telLkaStatus.innerText = 'ACTIVE';
        telLkaStatus.className = 'status-on';
    } else {
        telLkaStatus.innerText = 'OVERRIDDEN';
        telLkaStatus.className = 'status-off';
        telLkaStatus.style.color = varColor('accent');
    }
}

function initLKACanvas() {
    lkaCanvas = document.getElementById('canvas-lka');
    lkaCtx = lkaCanvas.getContext('2d');
    
    // Initialize curve elements of path
    roadCurves = [];
    let curX = 350;
    for (let y = lkaCanvas.height; y > -500; y -= 10) {
        roadCurves.push({
            y: y,
            x: curX
        });
    }
    
    lkaRunning = true;
    runLKALoop();
}

function runLKALoop() {
    if (!lkaRunning) return;
    lkaFrame++;

    lkaCtx.clearRect(0, 0, lkaCanvas.width, lkaCanvas.height);

    // Draw background turf
    lkaCtx.fillStyle = '#0c120e';
    lkaCtx.fillRect(0, 0, lkaCanvas.width, lkaCanvas.height);
    
    // Generate curved dirt track
    // Curve coordinates move downward to simulate movement
    const movementIncrement = (buggyLkaSpeed * 0.18); // scaled motion speed
    
    roadCurves.forEach(pt => {
        pt.y += movementIncrement;
    });

    // Remove nodes that leave viewport, and append new ones on top
    if (roadCurves[0].y > lkaCanvas.height + 50) {
        roadCurves.shift();
        
        let lastPt = roadCurves[roadCurves.length - 1];
        // Calculate new winding curve path
        let newX = lastPt.x + Math.sin(lkaFrame * 0.015) * 4;
        // Clamp track within bounds
        newX = Math.max(150, Math.min(lkaCanvas.width - 150, newX));
        
        roadCurves.push({
            y: lastPt.y - 10,
            x: newX
        });
    }

    // Draw Winding Track (Dirt Road boundaries)
    lkaCtx.strokeStyle = '#4e3b2b';
    lkaCtx.lineWidth = 100; // Road width
    lkaCtx.lineCap = 'round';
    lkaCtx.lineJoin = 'round';
    
    lkaCtx.beginPath();
    lkaCtx.moveTo(roadCurves[0].x, roadCurves[0].y);
    for (let i = 1; i < roadCurves.length; i++) {
        lkaCtx.lineTo(roadCurves[i].x, roadCurves[i].y);
    }
    lkaCtx.stroke();

    // Draw center dashed lane markings (white trail lines)
    lkaCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    lkaCtx.lineWidth = 4;
    lkaCtx.setLineDash([15, 25]);
    lkaCtx.beginPath();
    lkaCtx.moveTo(roadCurves[0].x, roadCurves[0].y);
    for (let i = 1; i < roadCurves.length; i++) {
        lkaCtx.lineTo(roadCurves[i].x, roadCurves[i].y);
    }
    lkaCtx.stroke();
    lkaCtx.setLineDash([]); // reset

    // Find the track center coordinate at the buggy's Y position (approx. Y=280)
    let closestTrackPt = roadCurves.reduce((prev, curr) => {
        return (Math.abs(curr.y - buggyLkaY) < Math.abs(prev.y - buggyLkaY) ? curr : prev);
    });
    
    let trackCenterX = closestTrackPt.x;
    
    // Autonomous control loop vs Manual Drift
    if (lkaMode === 'auto') {
        // Simple proportional-derivative control to target track Center
        const error = trackCenterX - buggyLkaX;
        deviation = error / 30; // scaled to meters
        
        // Steering correction calculation
        let targetSteer = error * 0.12; 
        steerAngle += (targetSteer - steerAngle) * 0.15; // Smooth steering transition
        
        // Update buggy position
        buggyLkaX += steerAngle * 0.3;
    } else {
        // Manual override: Let buggy drift away based on track curve
        const drift = Math.sin(lkaFrame * 0.02) * 2;
        buggyLkaX += drift;
        deviation = (trackCenterX - buggyLkaX) / 30;
        steerAngle = 0; // Steering center locked in manual
    }

    // Telemetry updates
    telLkaSteer.innerText = (steerAngle * -1).toFixed(1) + '°';
    telLkaDev.innerText = Math.abs(deviation).toFixed(2) + 'm';
    
    // If deviation too high, flash warning
    if (Math.abs(deviation) > 1.2) {
        telLkaDev.style.color = varColor('accent-red');
        lkaCtx.strokeStyle = 'rgba(255, 59, 48, 0.3)';
        lkaCtx.lineWidth = 10;
        lkaCtx.strokeRect(0, 0, lkaCanvas.width, lkaCanvas.height); // Red screen alert border
    } else {
        telLkaDev.style.color = varColor('primary-glow');
    }

    // Draw LKA Buggy Vector
    drawLKABuggy(buggyLkaX, buggyLkaY, steerAngle);

    lkaAnimationId = requestAnimationFrame(runLKALoop);
}

function drawLKABuggy(x, y, steer) {
    lkaCtx.save();
    lkaCtx.translate(x, y);
    
    // Draw wheels (Front wheels turn with steer angle)
    lkaCtx.fillStyle = '#0d130e';
    
    // Rear wheels (straight)
    lkaCtx.fillRect(-26, 12, 10, 22);
    lkaCtx.fillRect(16, 12, 10, 22);
    
    // Front wheels (turning)
    lkaCtx.save();
    lkaCtx.translate(-26, -20);
    lkaCtx.rotate((steer * Math.PI) / 180);
    lkaCtx.fillRect(-5, -11, 10, 22);
    lkaCtx.restore();

    lkaCtx.save();
    lkaCtx.translate(16, -20);
    lkaCtx.rotate((steer * Math.PI) / 180);
    lkaCtx.fillRect(-5, -11, 10, 22);
    lkaCtx.restore();

    // Draw buggy chassis
    lkaCtx.fillStyle = varColor('primary');
    lkaCtx.fillRect(-18, -15, 36, 30);
    
    // Nose frame cone
    lkaCtx.fillStyle = varColor('primary-glow');
    lkaCtx.beginPath();
    lkaCtx.moveTo(-18, -15);
    lkaCtx.lineTo(0, -32);
    lkaCtx.lineTo(18, -15);
    lkaCtx.fill();
    
    // Roll cage lines (aerial top view)
    lkaCtx.strokeStyle = '#fff';
    lkaCtx.lineWidth = 2.5;
    lkaCtx.strokeRect(-12, -15, 24, 25);
    lkaCtx.beginPath();
    lkaCtx.moveTo(-12, -15);
    lkaCtx.lineTo(0, -32);
    lkaCtx.lineTo(12, -15);
    lkaCtx.stroke();
    
    // TSAL / ASAL beacons (Flashing blue/amber)
    const active = Math.sin(lkaFrame * 0.2) > 0;
    if (active) {
        lkaCtx.fillStyle = varColor('primary-glow'); // ASAL Blue/Green
        lkaCtx.beginPath();
        lkaCtx.arc(-8, 5, 3, 0, Math.PI * 2);
        lkaCtx.fill();
        
        lkaCtx.fillStyle = varColor('accent'); // TSAL Amber
        lkaCtx.beginPath();
        lkaCtx.arc(8, 5, 3, 0, Math.PI * 2);
        lkaCtx.fill();
    }

    lkaCtx.restore();
}

// -------------------------------------------------------------
// 3. PERCEPTION OBSTACLE DETECTION FEED
// -------------------------------------------------------------
const percLogElement = document.getElementById('perc-log');

function triggerPerceptionTarget(targetType) {
    const boxes = document.querySelectorAll('.bbox');
    boxes.forEach(box => box.classList.add('hidden'));

    if (targetType === 'clear') {
        percLogElement.innerText = "Feed online. No immediate path threats detected. Resuming standard cruise.";
        return;
    }

    // Un-hide targeted bounding box
    document.getElementById(`bbox-${targetType}`).classList.remove('hidden');

    // Update Decision log based on type
    if (targetType === 'deer') {
        percLogElement.innerHTML = `<strong>[TARGET DETECTED]</strong> Wildlife (Deer family) identified at 12.4 meters.<br>
                                    <strong>[DBW DECISION]</strong> De-energized accelerator (TBW). Applied gentle 15% brake pressure (BBW).<br>
                                    <strong>[SAFETY ACTION]</strong> Silent operation check passed. Avoided sounding horn to prevent animal panic. Wait for clear path.`;
    } else if (targetType === 'poacher') {
        percLogElement.innerHTML = `<strong>[ALERT: SECURITY THREAT]</strong> Human presence detected off-trail at 18.2 meters.<br>
                                    <strong>[DBW DECISION]</strong> Speed throttled to stealth mode (10 km/h). Logged geolocation details via GNSS.<br>
                                    <strong>[SAFETY ACTION]</strong> Transmitting thermal/camera image snippet to central command circle. Silent approach activated.`;
    } else if (targetType === 'tree') {
        percLogElement.innerHTML = `<strong>[ALERT: ROAD BLOCKAGE]</strong> Fallen timber obstacle detected at 8.6 meters.<br>
                                    <strong>[DBW DECISION]</strong> Initiated Autonomous Emergency Braking (AEB). full 100% brake line lock.<br>
                                    <strong>[SAFETY ACTION]</strong> Vehicle halted safely at 3.2m margin from log. Flashing hazard active lights (ASAL/TSAL).`;
    }
}

// -------------------------------------------------------------
// 4. FINANCIAL BID & ROI CALCULATOR
// -------------------------------------------------------------
const inputFleet = document.getElementById('calc-fleet');
const inputDist = document.getElementById('calc-dist');
const inputDiesel = document.getElementById('calc-diesel');
const inputYears = document.getElementById('calc-years');

// UI display fields
const resSavings = document.getElementById('res-savings');
const resCo2 = document.getElementById('res-co2');
const resPayback = document.getElementById('res-payback');

function runCalculator() {
    const fleet = parseInt(inputFleet.value);
    const dist = parseFloat(inputDist.value);
    const dieselPrice = parseFloat(inputDiesel.value);
    const years = parseInt(inputYears.value);

    // Updates label displays
    document.getElementById('val-calc-fleet').innerText = `${fleet} ${fleet === 1 ? 'Vehicle' : 'Vehicles'}`;
    document.getElementById('val-calc-dist').innerText = `${dist} km`;
    document.getElementById('val-calc-diesel').innerText = `₹${dieselPrice}`;
    document.getElementById('val-calc-years').innerText = `${years} ${years === 1 ? 'Year' : 'Years'}`;

    // Math models:
    // A standard diesel ATV runs about 8 km per Liter of diesel fuel.
    // Daily liters per vehicle = patrol distance / 8
    const dieselLitersPerDay = dist / 8;
    const dieselFuelCostPerDay = dieselLitersPerDay * dieselPrice;
    
    // An electric buggy consumes approx 0.12 kWh of electricity per kilometer.
    // Average agricultural/government electricity cost = ₹8 per kWh.
    const elecKwhPerDay = dist * 0.12;
    const elecFuelCostPerDay = elecKwhPerDay * 8; // ₹8 rate
    
    // Maintenance savings: Electric has ~60% fewer moving parts (no engine oils, filters, Spark plugs, CVT belts).
    // Estimated yearly maintenance: Diesel ATV = ₹30,000 | Electric Buggy = ₹12,000.
    const maintSavingsPerYear = 18000 * fleet;

    // Operational Savings calculation
    const fuelSavingsPerDay = (dieselFuelCostPerDay - elecFuelCostPerDay) * fleet;
    const totalFuelSavings = (fuelSavingsPerDay * 365 * years) + (maintSavingsPerYear * years);
    const totalSavingsLakhs = totalFuelSavings / 100000;

    // CO2 calculation (1 Liter of burned diesel releases roughly 2.68 kg of CO2)
    const yearlyLitersSaved = dieselLitersPerDay * 365 * fleet;
    const totalCo2Saved = (yearlyLitersSaved * 2.68 * years) / 1000; // in metric Tons

    // Payback period logic:
    // Acquisition cost difference of Electric Buggy is roughly ₹1.5 Lakhs higher initially.
    // Total investment delta = fleet * 150000.
    // Payback months = Investment delta / Monthly savings.
    const investmentDelta = fleet * 150000;
    const monthlySavings = (fuelSavingsPerDay * 30.4) + (maintSavingsPerYear / 12);
    const paybackMonths = monthlySavings > 0 ? (investmentDelta / monthlySavings) : 0;

    // Update results onto cards
    resSavings.innerText = `₹${totalSavingsLakhs.toFixed(1)} Lakhs`;
    resCo2.innerText = `${totalCo2Saved.toFixed(1)} Tons`;
    resPayback.innerText = paybackMonths > 0 ? `${Math.ceil(paybackMonths)} Months` : 'Instant';
}

// Add event listeners to calculator inputs
[inputFleet, inputDist, inputDiesel, inputYears].forEach(input => {
    input.addEventListener('input', runCalculator);
});

// -------------------------------------------------------------
// INITIALIZE ALL SYSTEMS ON LOAD
// -------------------------------------------------------------
window.onload = function() {
    initAEBCanvas();
    runCalculator();
};
