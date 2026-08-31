// This is the overlay logic previously in overlay.html
const { ipcRenderer, log } = window.electron;
const canvas = document.getElementById('canvas');
let ctx = null;
try {
  ctx = canvas.getContext('2d');
} catch (e) {
  document.getElementById('info').innerText = 'ERROR: Cannot get 2D context!';
}
let overlayData = {
  xMin: -960, xMax: 960, yMin: -540, yMax: 540, centerX: 0, centerY: 0,
  mouseX: 0, mouseY: 0, oscX: 0, oscY: 0, screenWidth: 1920, screenHeight: 1080
};
window.addEventListener('resize', resize);
resize();
let drawCount = 0;
function draw() {
  drawCount++;
  let debugText = '';
  debugText += `draw() called: ${drawCount}\n`;
  debugText += `canvas: ${canvas.width}x${canvas.height}\n`;
  debugText += `ctx: ${!!ctx}\n`;
  debugText += `overlayData: ${JSON.stringify(overlayData, null, 1)}\n`;
  if (!ctx) {
    document.getElementById('info').innerText = 'ERROR: No 2D context!\n' + debugText;
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.fillStyle = 'rgba(0,255,0,0.3)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 8;
  ctx.beginPath();
  // Draw cross at (centerX, centerY) in screen coordinates
  const crossX = overlayData.centerX + overlayData.screenWidth/2;
  const crossY = overlayData.centerY + overlayData.screenHeight/2;
  ctx.moveTo(crossX - 80, crossY);
  ctx.lineTo(crossX + 80, crossY);
  ctx.moveTo(crossX, crossY - 80);
  ctx.lineTo(crossX, crossY + 80);
  ctx.stroke();
  // Draw OSC offset label
  ctx.save();
  ctx.font = 'bold 20px Fira Code, monospace';
  ctx.fillStyle = '#ff0000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`OSC offset: (${overlayData.centerX}, ${overlayData.centerY})`, crossX + 12, crossY + 12);
  ctx.restore();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = '#00ffcc';
  ctx.lineWidth = 2;
  const minX = (overlayData.xMin + overlayData.screenWidth/2);
  const maxX = (overlayData.xMax + overlayData.screenWidth/2);
  const minY = (overlayData.yMin + overlayData.screenHeight/2);
  const maxY = (overlayData.yMax + overlayData.screenHeight/2);
  ctx.strokeRect(minX, minY, maxX-minX, maxY-minY);
  ctx.beginPath();
  ctx.arc(overlayData.screenWidth/2, overlayData.screenHeight/2, 8, 0, 2*Math.PI);
  ctx.fillStyle = '#ff4081';
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(overlayData.mouseX, overlayData.mouseY, 6, 0, 2*Math.PI);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
  document.getElementById('info').innerText = debugText;
}
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
setInterval(draw, 250);
window.addEventListener('DOMContentLoaded', draw);
window.onerror = function(msg, url, line, col, error) {
  document.getElementById('info').innerText = 'JS ERROR: ' + msg + '\n' + url + ':' + line + ':' + col;
  return false;
};
let overlayDataReceived = false;
if (ipcRenderer) {
  ipcRenderer.on('overlay-data', (data) => {
    overlayDataReceived = true;
    overlayData = { ...overlayData, ...data };
    draw();
  });
  setTimeout(() => {
    if (!overlayDataReceived) {
      document.getElementById('info').innerText = 'Overlay active\n(No overlay-data received!)';
    }
  }, 2000);
} else {
  setInterval(() => {
    overlayData.mouseX = Math.random() * overlayData.screenWidth;
    overlayData.mouseY = Math.random() * overlayData.screenHeight;
    overlayData.oscX = overlayData.mouseX - overlayData.screenWidth/2;
    overlayData.oscY = overlayData.mouseY - overlayData.screenHeight/2;
    draw();
  }, 100);
}
