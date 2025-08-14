let points = [];
let redoStack = [];
let currentPos = null;
let closestPoint = null;
let offsetX = 0;
let offsetZ = 0;
let isDragging = false;
let dragStartMouseX = 0;
let dragStartMouseY = 0;
let dragStartOffsetX = 0;
let dragStartOffsetZ = 0;
let movedDuringDrag = false;
let blockSizeInPixels = 32; 

const worldLimit = 50000; // Max ± blocks

const canvas = document.getElementById("gridCanvas");
const ctx = canvas.getContext("2d");

// NEW: match canvas to container size
const container = document.getElementById("canvasContainer");
canvas.width = container.clientWidth;
canvas.height = container.clientHeight;

let centerX = canvas.width / 2;
let centerZ = canvas.height / 2;


// load saved points
const saved = localStorage.getItem("savedPoints");
if (saved) {
  try { points = JSON.parse(saved) || []; } catch(e) { points = []; }
}

function drawDirectionLabels() {
    ctx.font = "18px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // N (Z -) correct
    ctx.fillText("S", canvas.width / 2, 20);

    // S (Z +) correct
    ctx.fillText("N", canvas.width / 2, canvas.height - 20);

    // E (X +) correct
    ctx.fillText("E", canvas.width - 20, canvas.height / 2);

    // W (X -) correct
    ctx.fillText("W", 20, canvas.height / 2);
}


function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const blockSizeInPixels = scale;

  // Large grid (always visible)
  drawGridLayer(512, "#555555", 2);

  // Medium grid
  if (256 * blockSizeInPixels >= 25) {
      drawGridLayer(256, "#555555", 1.2);
  }

  // Small grid
  if (64 * blockSizeInPixels >= 25) {
      drawGridLayer(64, "#555555", 1);
  }

  // Axes
  ctx.strokeStyle = "#f00";
  ctx.lineWidth = 1.5;
  const axisX = worldToCanvasX(0);
  const axisZ = worldToCanvasZ(0);
  ctx.beginPath();
  ctx.moveTo(axisX, 0);
  ctx.lineTo(axisX, canvas.height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, axisZ);
  ctx.lineTo(canvas.width, axisZ);
  ctx.stroke();

  // Points
  points.forEach(p => {
    ctx.fillStyle = (p === closestPoint) ? "red" : "yellow";
    drawPoint(p.x, p.z, ctx.fillStyle, p.note);
  });
  if (currentPos) drawPoint(currentPos.x, currentPos.z, "lime");

  if (currentPos && closestPoint) {
      drawLineBetweenPoints(currentPos, closestPoint);
  }

  // Direction labels
  drawDirectionLabels();
}

function drawGridLayer(spacing, color, lineWidth) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  const leftWorldX = (0 - centerX - offsetX) / scale;
  const rightWorldX = (canvas.width - centerX - offsetX) / scale;
  const topWorldZ = -(0 - centerZ - offsetZ) / scale;
  const bottomWorldZ = -(canvas.height - centerZ - offsetZ) / scale;

  const startGridX = Math.floor(leftWorldX / spacing) * spacing;
  for (let gx = startGridX; gx <= rightWorldX; gx += spacing) {
    const px = worldToCanvasX(gx);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, canvas.height);
    ctx.stroke();
  }

  const startGridZ = Math.floor(bottomWorldZ / spacing) * spacing;
  for (let gz = startGridZ; gz <= topWorldZ; gz += spacing) {
    const pz = worldToCanvasZ(gz);
    ctx.beginPath();
    ctx.moveTo(0, pz);
    ctx.lineTo(canvas.width, pz);
    ctx.stroke();
  }
}

function drawPoint(x, z, color, note = "") {
  const px = worldToCanvasX(x);
  const pz = worldToCanvasZ(z);

  ctx.beginPath();
  ctx.arc(px, pz, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  if (note) {
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.fillText(note, px + 8, pz - 8);
  }
}

// coordinate conversions (canvas px <-> world blocks)
function worldToCanvasX(x) {
  return centerX + (x * scale) + offsetX;
}
function worldToCanvasZ(z) {
  return centerZ - (z * scale) + offsetZ;
}
function canvasToWorldX(px) {
  return (px - centerX - offsetX) / scale;
}
function canvasToWorldZ(pz) {
  return -(pz - centerZ - offsetZ) / scale;
}

// mouse coordinate display (3 decimals) coorddisplay
// Floating coord display
const coordDisplay = document.createElement("div");
coordDisplay.id = "coordDisplay";
document.body.appendChild(coordDisplay);

coordDisplay.style.position = "absolute";
coordDisplay.style.background = "#3C3D37";
coordDisplay.style.color = "#fff";
coordDisplay.style.padding = "4px 8px";
coordDisplay.style.borderRadius = "4px";
coordDisplay.style.fontSize = "14px";
coordDisplay.style.pointerEvents = "none";
coordDisplay.style.zIndex = "1000";
coordDisplay.style.display = "none";

canvas.addEventListener("mousemove", (ev) => {
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    const wx = canvasToWorldX(mx);
    const wz = canvasToWorldZ(my);

    coordDisplay.innerText = `X: ${wx.toFixed(2)}, Z: ${wz.toFixed(2)}`;
    coordDisplay.style.left = `${ev.clientX + 10}px`;
    coordDisplay.style.top = `${ev.clientY + 10}px`;
    coordDisplay.style.display = "block";

    // pan logic
    if (isDragging) {
        const dx = ev.clientX - dragStartMouseX;
        const dy = ev.clientY - dragStartMouseY;
        if (!movedDuringDrag && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) movedDuringDrag = true;
        if (movedDuringDrag) {
            offsetX = dragStartOffsetX + dx;
            offsetZ = dragStartOffsetZ + dy;
            drawGrid();
            canvas.style.cursor = "grabbing";
        }
    }
});

canvas.addEventListener("mouseleave", () => {
    coordDisplay.style.display = "none";
});


// mousedown -> start pan
canvas.addEventListener("mousedown", (ev) => {
  if (ev.button !== 0) return;
  isDragging = true;
  movedDuringDrag = false;
  dragStartMouseX = ev.clientX;
  dragStartMouseY = ev.clientY;
  dragStartOffsetX = offsetX;
  dragStartOffsetZ = offsetZ;
  canvas.style.cursor = "grabbing";
});

// mouseup -> either add point (if no drag) or stop pan addPoint()
canvas.addEventListener("mouseup", (ev) => {
  if (ev.button !== 0) return;
  // if the user didn't move enough, treat as click to add point (with prompt)
  if (!movedDuringDrag) {
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    const worldX = Math.round(canvasToWorldX(mx));
    const worldZ = Math.round(canvasToWorldZ(my));
    const note = prompt(`Enter note for (${worldX}, ${worldZ})`);
    if (note !== null) {
      points.push({ x: worldX, z: worldZ, note: note.trim() });
      redoStack = []; // clear redo stack
      localStorage.setItem("savedPoints", JSON.stringify(points));
      drawGrid();
    }
  }
  // stop dragging
  isDragging = false;
  canvas.style.cursor = "grab";
});

// if pointer leaves canvas while dragging, stop dragging
canvas.addEventListener("mouseleave", () => {
  isDragging = false;
  canvas.style.cursor = "grab";
});

// Add point from the top form
function addPoint() {
  const x = parseInt(document.getElementById("xCoord").value);
  const z = parseInt(document.getElementById("zCoord").value);
  const note = document.getElementById("note").value.trim();

  if (isNaN(x) || isNaN(z)) return;
  if (Math.abs(x) > worldLimit || Math.abs(z) > worldLimit) {
    alert(`Coordinates must be between -${worldLimit} and ${worldLimit}`);
    return;
  }
  points.push({ x, z, note });
  redoStack = [];
  localStorage.setItem("savedPoints", JSON.stringify(points));
  drawGrid();
}

// Find closest with direction + degrees
function findClosest() {
    const x = parseFloat(document.getElementById("currentX").value);
    const z = parseFloat(document.getElementById("currentZ").value);
    if (isNaN(x) || isNaN(z)) return;

    currentPos = { x, z };
    let minDist = Infinity;
    let closest = null;

    points.forEach(p => {
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < minDist) {
            minDist = d;
            closest = p;
        }
    });

    closestPoint = closest;
    drawGrid();

    if (closest) {
        const { direction, degrees } = getDirectionWithDegrees(x, z, closest.x, closest.z);
        alert(`Closest Point: (${closest.x}, ${closest.z})\nDistance: ${minDist.toFixed(2)} blocks\nDirection: ${direction} (${degrees}°)`);
        document.getElementById("directionDisplay").textContent = `Facing: ${direction} (${degrees}°)`;
    }
}

// Helper function to get direction + degrees
function getDirectionWithDegrees(fromX, fromZ, toX, toZ) {
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    let angle = Math.atan2(dz, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360; // Normalize to 0–360

    let direction = "?";
    if (angle >= 337.5 || angle < 22.5) direction = "East";
    else if (angle >= 22.5 && angle < 67.5) direction = "North-East";
    else if (angle >= 67.5 && angle < 112.5) direction = "North";
    else if (angle >= 112.5 && angle < 157.5) direction = "North-West";
    else if (angle >= 157.5 && angle < 202.5) direction = "West";
    else if (angle >= 202.5 && angle < 247.5) direction = "South-West";
    else if (angle >= 247.5 && angle < 292.5) direction = "South";
    else if (angle >= 292.5 && angle < 337.5) direction = "South-East";

    return { direction, degrees: Math.round(angle) };
}

// clear points
function clearPoints() {
  points = [];
  localStorage.removeItem("savedPoints");
  drawGrid();
}


// zoom (mouse wheel) - zoom center is current canvas center
let scale = 0.3; // <-- start at normal zoom

const maxBlocks = 20000;
const minScale = canvas.width / maxBlocks; // can't see more than 20000 blocks
const maxScale = 10; // max zoom-in

canvas.addEventListener("wheel", (ev) => {
  ev.preventDefault();

  const zoomAmount = 0.08;
  if (ev.deltaY < 0) {
    scale *= (1 + zoomAmount);
  } else {
    scale *= (1 - zoomAmount);
  }

  // clamp zoom
  scale = Math.max(minScale, Math.min(maxScale, scale));

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
}, { passive: false });

function drawLineBetweenPoints(pointA, pointB) {
    ctx.save();
    ctx.strokeStyle = "#ffcc00"; // bright red line  mousemove
    ctx.lineWidth = 2;

    const ax = worldToCanvasX(pointA.x);
    const az = worldToCanvasZ(pointA.z);
    const bx = worldToCanvasX(pointB.x);
    const bz = worldToCanvasZ(pointB.z);

    // Draw line
    ctx.beginPath();
    ctx.moveTo(ax, az);
    ctx.lineTo(bx, bz);
    ctx.stroke();

    // Calculate distance in blocks (world space)
    const dx = pointB.x - pointA.x;
    const dz = pointB.z - pointA.z;
    const distance = Math.sqrt(dx * dx + dz * dz).toFixed(1); // one decimal

    // Midpoint for label
    const midX = (ax + bx) / 2;
    const midZ = (az + bz) / 2;

    // Draw background box for readability
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(midX - 20, midZ - 10, 40, 20);

    // Draw text
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${distance} blocks`, midX, midZ);

    ctx.restore();
}

// === Undo / Redo === mouseup
document.getElementById("undoBtn").addEventListener("click", function () {
    if (points.length > 0) {
        redoStack.push(points.pop());
        localStorage.setItem("savedPoints", JSON.stringify(points));
        drawGrid();
    }
});

document.getElementById("redoBtn").addEventListener("click", function () {
    if (redoStack.length > 0) {
        points.push(redoStack.pop());
        localStorage.setItem("savedPoints", JSON.stringify(points));
        drawGrid();
    }
});

document.addEventListener("keydown", function (e) {
    if (e.ctrlKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        document.getElementById("undoBtn").click();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        document.getElementById("redoBtn").click();
    }
});

function getDirection(fromX, fromZ, toX, toZ) {
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const angle = Math.atan2(dz, dx) * (180 / Math.PI); // Convert to degrees

    // Normalize to 0–360
    const normalized = (angle + 360) % 360;

    if (normalized >= 337.5 || normalized < 22.5) return "East";
    if (normalized >= 22.5 && normalized < 67.5) return "North-East";
    if (normalized >= 67.5 && normalized < 112.5) return "North";
    if (normalized >= 112.5 && normalized < 157.5) return "North-West";
    if (normalized >= 157.5 && normalized < 202.5) return "West";
    if (normalized >= 202.5 && normalized < 247.5) return "South-West";
    if (normalized >= 247.5 && normalized < 292.5) return "South";
    if (normalized >= 292.5 && normalized < 337.5) return "South-East";

    return "?";
}


// initial render
drawGrid();

// Example coordinates in block units
const coordA = { x: 10, y: 5 };
const coordB = { x: 50, y: 30 };

// Call after grid is drawn so it appears on top
drawLineBetweenPoints(ctx, coordA, coordB, blockSizeInPixels);
// drawgrid