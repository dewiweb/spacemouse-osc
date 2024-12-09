const { ipcRenderer } = require('electron');
const log = require("electron-log");
const _ = require("lodash");
const { SpaceMouseVisualizer, OSCIndicator } = require('./visualization');
const Store = require('electron-store');
const store = new Store();

let preferences;
try {
  preferences = ipcRenderer.sendSync("getPreferences");
} catch (error) {
  console.error('Error getting preferences:', error);
}

const modeFunctions = {
  aed: customMode,
  ad: customMode,
  xyz: customMode,
  xy: customMode,
  custom1: customMode,
  custom2: customMode,
  custom3: customMode,
};

let xyVisualizer;
let yzVisualizer;
let oscIndicator;

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  try {
    initInputs();
    resetInputValuesOnDoubleClick();
    
    // Initialize visualizations
    xyVisualizer = new SpaceMouseVisualizer('threejs-container-xy', 'xy');
    yzVisualizer = new SpaceMouseVisualizer('threejs-container-yz', 'yz');
    oscIndicator = new OSCIndicator('osc-indicator');
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize window height when the page loads
    updateWindowHeight();
    
    // Theme handling
    ipcRenderer.on('update-theme', (event, theme) => {
      console.log('Applying theme:', theme);
      document.documentElement.className = `theme-${theme}`;
      document.body.className = `theme-${theme}`;
      
      // Update visualizer grid theme
      const visualizers = document.querySelectorAll('.visualizer');
      visualizers.forEach(v => {
        v.className = v.className.replace(/theme-\w+/, '');
        v.className += ` theme-${theme}`;
      });

      // Store theme in localStorage for persistence
      localStorage.setItem('theme', theme);
    });

    // Apply theme on load
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.className = `theme-${savedTheme}`;
    document.body.className = `theme-${savedTheme}`;
    
    // Update visualizer grid theme
    const visualizers = document.querySelectorAll('.visualizer');
    visualizers.forEach(v => {
      v.className = v.className.replace(/theme-\w+/, '');
      v.className += ` theme-${savedTheme}`;
    });

    // Theme toggle functionality
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    // Get initial theme from preferences
    const prefs = ipcRenderer.sendSync('getPreferences');
    const initialTheme = prefs?.app_settings?.theme || 'dark';
    document.documentElement.setAttribute('data-theme', initialTheme);
    updateThemeIcon(initialTheme);

    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      updateThemeIcon(newTheme);

      // Update visualizers with new theme
      if (xyVisualizer) xyVisualizer.updateVisualizerTheme();
      if (yzVisualizer) yzVisualizer.updateVisualizerTheme();

      // Update preferences
      const currentPrefs = ipcRenderer.sendSync('getPreferences');
      currentPrefs.app_settings.theme = newTheme;
      ipcRenderer.send('savePreferences', currentPrefs);
    });

    // Listen for theme updates from preferences window
    ipcRenderer.on('update-theme', (event, theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      updateThemeIcon(theme);
      
      // Update visualizers with new theme
      if (xyVisualizer) xyVisualizer.updateVisualizerTheme();
      if (yzVisualizer) yzVisualizer.updateVisualizerTheme();
    });

    function updateThemeIcon(theme) {
      const moonPath = themeIcon.querySelector('.moon');
      const sunPath = themeIcon.querySelector('.sun');
      
      if (theme === 'light') {
        moonPath.style.display = 'none';
        sunPath.style.display = 'block';
      } else {
        moonPath.style.display = 'block';
        sunPath.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Error initializing application:', error);
  }
});

function setupEventListeners() {
  // Set up IPC listeners
  ipcRenderer.on("logInfo", (e, msg) => {
    logger(msg);
    scrollToBottom();
  });

  ipcRenderer.on("appVersion", (event, appVersion) => {
    const versionElement = document.getElementById("appVersion");
    if (versionElement) {
      versionElement.innerHTML = versionElement.innerHTML + appVersion;
    }
  });

  ipcRenderer.on("preferencesUpdated", (e, preferences) => {
    ip_portRegex =
      /^((25[0-5]|2[0-4][0-9]|[01]?[0-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9]?[0-9]):(6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]\d{4}|[1-9]\d{0,3})$/;
    ip_port = preferences.network_settings.osc_server;
    //logger('ip_port : ' +preferences.network_settings.osc_server +' in regex : ' +ip_portRegex.test(ip_port))
    if (ip_portRegex.test(ip_port) === true) {
      //logger("matching ip:port")
      ipcRenderer.send("matchingIpPort");
    } else {
      //logger("not matching ip:port")
      ipcRenderer.send("notMatchingIpPort");
    }
    //logger(preferences.network_settings.osc_server);
    //
  });

  ipcRenderer.on("resolveError", (e) => {
    ipcRenderer.send("showPreferences");
  });

  ipcRenderer.on("incoming_index", (e, inc_index) => {
    //console.log('inc_index', inc_index)
    document.getElementById("index").value = inc_index;
  });

  ipcRenderer.on(
    "incoming_data",
    (event, tx, ty, tz, rx, ry, rz) => {
      // Convert values to appropriate ranges
      const x = tx * 0.0005;
      const y = ty * 0.0005;
      const z = tz * 0.0005;
      const rotX = rx * 0.001;
      const rotY = ry * 0.001;
      const rotZ = rz * 0.001;

      // Update visualizers
      if (window.updateVisualizers) {
          window.updateVisualizers(x, y, z, rotX, rotY, rotZ);
      }

      // Update OSC indicators
      const indicators = document.querySelectorAll('.osc-indicator');
      indicators.forEach(indicator => {
          indicator.style.backgroundColor = '#4CAF50';
          indicator.style.opacity = '1';
          setTimeout(() => {
              indicator.style.backgroundColor = '#333';
              indicator.style.opacity = '0.5';
          }, 100);
      });

      var precision = document.getElementById("precision").value;
      var factor = document.getElementById("factor").value;
      if (precision !== "clear") {
        document.getElementById("tr_x").value =
          Math.round(Math.pow(tx * 1, 3) * 5 * factor * precision) /
          precision;
        document.getElementById("tr_y").value =
          Math.round(Math.pow(ty * 1, 3) * -5 * factor * precision) /
          precision;
        document.getElementById("tr_z").value =
          Math.round(Math.pow(tz * 1, 3) * -5 * factor * precision) /
          precision;
        document.getElementById("rt_x").value =
          Math.round(Math.pow(rx * 1, 3) * 5 * factor * precision) /
          precision;
        document.getElementById("rt_y").value =
          Math.round(Math.pow(ry * 1, 3) * -5 * factor * precision) /
          precision;
        document.getElementById("rt_z").value =
          Math.round(Math.pow(rz * 1, 3) * 5 * factor * precision) /
          precision;
      } else {
        document.getElementById("tr_x").value =
          Math.pow(tx * 1, 3) * 5 * factor;
        document.getElementById("tr_y").value =
          Math.pow(ty * 1, 3) * -5 * factor;
        document.getElementById("tr_z").value =
          Math.pow(tz * 1, 3) * -5 * factor;
        document.getElementById("rt_x").value =
          Math.pow(rx * 1, 3) * 5 * factor;
        document.getElementById("rt_y").value =
          Math.pow(ry * 1, 3) * -5 * factor;
        document.getElementById("rt_z").value =
          Math.pow(rz * 1, 3) * 5 * factor;
      }
      var index_or_not =
        document.getElementById("index").parentElement.style.visibility;
      //console.log("visibility of index value : ", index_or_not)
      var prefix = document.getElementById("prefix").value;
      var index = document.getElementById("index").value;
      //console.log("prefix", prefix, "index", index, "index_or_not", index_or_not);
      var table = document.getElementById("tableOfConnection");
      //console.log("table.rows[3].cells.length", table.rows[3].cells.length)
      for (i = 0; i < table.rows[3].cells.length; i++) {
        //console.log("table_row_5, cell " + i + ":", table.rows[5].cells[i])
        var visible = table.rows[3].cells[i].style.visibility;
        var attrib = table.rows[3].cells[i].firstElementChild.value;
        //console.log("visibility",i, visible)
        //console.log("attrib",i, attrib)
        if (visible !== "hidden") {
          let now = Date();
          var inc_value = table.rows[4].cells[i].firstElementChild.value;
          console.log("inc_value", inc_value);
          if (inc_value !== "0") {
            ipcRenderer.send(
              "ok_to_send",
              prefix,
              index,
              index_or_not,
              attrib,
              inc_value
            );
          }
        }
      }
    }
  );

  ipcRenderer.on("buttons", (event, buttons) => {
    const processButtons = _.debounce((buttons) => {
      if (buttons[0] === true) {
        document.getElementById("index").stepDown();
      }
      if (buttons[1] === true) {
        document.getElementById("index").stepUp();
      }
    }, 20); // 200 milliseconds debounce rate
    processButtons(buttons);
  });

  ipcRenderer.on("modeChanged", (event, mode) => {
    if (modeFunctions[mode]) {
      //modeSet = preferences.value('paths_sets.' + modeValue)
      document.getElementById("mode").value = mode;
      set = preferences.paths_sets[mode];
      console.log("line 313-set: ", set);
      modeFunctions[mode](set);
    } else {
      // Handle the case where the mode is not found
      logger("Unknown mode:", mode);
    }
  });

  ipcRenderer.on("prefixChanged", (event, prefix) => {
    document.getElementById("prefix").value = prefix;
  });

  ipcRenderer.on("indexChanged", (event, index) => {
    idButton = document.getElementById("byp0");
    const indexCell = idButton.parentElement.previousElementSibling;
    indexCell.children[1].style.visibility = "visible";
    if (index === "on") {
      if (indexCell.style.visibility === "hidden") {
        indexCell.style.visibility = "visible";
        idButton.innerHTML = "Bypass";
        idButton.className = "button_up byp";
      }
    } else if (index === "off") {
      if (indexCell.style.visibility === "visible") {
        indexCell.style.visibility = "hidden";
        idButton.innerHTML = "Enable";
        idButton.className = "button byp";
      }
    } else if (index === "reset") {
      document.getElementById("index").value = 1;
    } else {
      document.getElementById("index").value = index;
    }
  });

  ipcRenderer.on("factorChanged", (event, factor) => {
    document.getElementById("factor").value = factor;
  });

  ipcRenderer.on("precisionChanged", (event, precision) => {
    document.getElementById("precision").value = precision;
  });

  ipcRenderer.on("sendRateChanged", (event, sendRate) => {
    document.getElementById("sendRate").value = sendRate;
  });

  ipcRenderer.on("spacemouse-data", (event, data) => {
    // Update visualizations
    if (xyVisualizer) {
      xyVisualizer.updatePosition(data.x || 0, data.y || 0, data.z || 0);
      xyVisualizer.updateRotation(data.rx || 0, data.ry || 0, data.rz || 0);
    }
    if (yzVisualizer) {
      yzVisualizer.updatePosition(data.x || 0, data.y || 0, data.z || 0);
      yzVisualizer.updateRotation(data.rx || 0, data.ry || 0, data.rz || 0);
    }
    if (oscIndicator) {
      oscIndicator.pulse();
    }
  });

  ipcRenderer.on("osc-sent", () => {
    if (oscIndicator) {
      oscIndicator.pulse();
    }
  });

  ipcRenderer.on('hidData', (event, data) => {
    const { translateX, translateY, translateZ, rotateX, rotateY, rotateZ } = data;
    
    // Update UI with new values
    document.getElementById('translateX').textContent = translateX;
    document.getElementById('translateY').textContent = translateY;
    document.getElementById('translateZ').textContent = translateZ;
    document.getElementById('rotateX').textContent = rotateX;
    document.getElementById('rotateY').textContent = rotateY;
    document.getElementById('rotateZ').textContent = rotateZ;
  });
}

function initInputs() {
  document.addEventListener(
    "wheel",
    (event) => {
      const inputElement = event.target;
      if (inputElement.type === "number") {
        event.preventDefault();

        const step = parseFloat(inputElement.step) || 1;
        const delta = event.deltaY > 0 ? step : -step;
        let newValue = parseFloat(inputElement.value || 0) + delta;

        if (
          inputElement.min !== "" &&
          newValue < parseFloat(inputElement.min)
        ) {
          newValue = parseFloat(inputElement.min);
        }

        const decimals = Math.max(0, String(step).split(".")[1]?.length || 0);
        inputElement.value = parseFloat(newValue.toFixed(decimals));
      }
    },
    { passive: false }
  );
}

function resetInputValuesOnDoubleClick() {
  // Get all input elements
  const inputElements = document.querySelectorAll("input");

  // Add event listener to each input element
  inputElements.forEach((input) => {
    input.addEventListener("dblclick", function () {
      this.value = this.defaultValue; // Reset the value to its default value
    });
  });
}

function logDefinition() {
  console.log = log.log;
  Object.assign(console, log.functions);
  log.transports.console.format = "{h}:{i}:{s} / {text}";
}
logDefinition();

log.transports.div = log.transports.console;

function logger(msg) {
  let date = new Date();
  date =
    date.getHours() +
    ":" +
    (date.getMinutes() < 10 ? "0" : "") +
    date.getMinutes() +
    ":" +
    (date.getSeconds() < 10 ? "0" : "") +
    date.getSeconds() +
    "-->";
  if (document.getElementById("logging")) {
    document
      .getElementById("logging")
      .insertAdjacentHTML("beforeend", date + JSON.stringify(msg) + "<br>");
    scrollToBottom();
  }
}
function scrollToBottom() {
  document.getElementById("logging").scrollTop =
    document.getElementById("logging").scrollHeight;
}

function displayForm3(event) {
  const add3 = document.getElementById("add3");
  var ip11 = document.getElementById("ip11").value;
  var ip21 = document.getElementById("ip21").value;
  var ip31 = document.getElementById("ip31").value;
  var ip41 = document.getElementById("ip41").value;
  var port2 = document.getElementById("port2").value;
  var data1 = ip11 + "." + ip21 + "." + ip31 + "." + ip41;
  oscServerIp = data1;
  oscServerPort = port2;
  add3.textContent = "OK!  Address : " + data1 + "   /   Port : " + port2;
  ipcRenderer.send("sendOscServerIp", data1);
  ipcRenderer.send("sendOscServerPort", Number(port2));
  event.preventDefault();
}

function modeChange(event) {
  mode = event.target.value;
  if (modeFunctions[mode]) {
    //modeSet = preferences.value('paths_sets.' + modeValue)
    document.getElementById("mode").value = mode;
    set = preferences.paths_sets[mode];
    modeFunctions[mode](set);
  } else {
    // Handle the case where the mode is not found
    logger("Unknown mode:", mode);
  }

}

function setVisibility(elementIds, visibility) {
  elementIds.forEach((id) => {
    document.getElementById(id).parentElement.style.visibility = visibility;
  });
}

function updateButtons(bypButtons, start, end, className, text) {
  for (let i = start; i < end; i++) {
    bypButtons[i].className = className;
    bypButtons[i].innerHTML = text;
  }
}

function setAtVisibility(elementIds, visibility) {
  elementIds.forEach((id) => {
    document.getElementById(id).style.visibility = visibility;
  });
}

function customMode(set) {
  console.log("line 280 - entering function customMode with set: ", set);
  modeArray = JSON.parse(set);
  atArray = document.querySelectorAll(".at");
  valueArray = document.querySelectorAll(".value");
  bypArray = document.querySelectorAll(".byp");
  quadrupletArray = modeArray.map((element, index) => [
    element,
    atArray[index],
    valueArray[index],
    bypArray[index + 1],
  ]);
  //console.log("quadruplet_array : ", quadrupletArray);
  for (i = 0; i < quadrupletArray.length; i++) {
    if (!quadrupletArray[i][0]) {
      bypArray[i + 1].className = "button byp";
      bypArray[i + 1].innerHTML = "Enable";
      atArray[i].style.visibility = "hidden";
      valueArray[i].style.visibility = "hidden";
    } else {
      bypArray[i + 1].className = "button_up byp";
      bypArray[i + 1].innerHTML = "Bypass";
      atArray[i].style.visibility = "visible";
      atArray[i].firstElementChild.value = "/" + quadrupletArray[i][0];
      valueArray[i].style.visibility = "visible";
    }
  }
}

function byp_0(event) {
  const buttonId = event.target.id;
  const button = document.getElementById(buttonId);
  const indexCell = button.parentElement.previousElementSibling;
  indexCell.style.visibility =
    indexCell.style.visibility === "hidden" ? "visible" : "hidden";
  indexCell.children[1].style.visibility = "visible";

  // Toggle the innerHTML of the button between "bypass" and "enable"
  if (button.innerHTML === "Bypass") {
    button.innerHTML = "Enable";
  } else {
    button.innerHTML = "Bypass";
  }
  if (button.className === "button_up byp") {
    button.className = "button byp";
  } else {
    button.className = "button_up byp";
  }
}

function showPreferences(preferencesBtn) {
  ipcRenderer.send("showPreferences");
}

function sendRateChange(event) {
  // Send the rate change event using IPC
  ipcRenderer.send("sendRateChange", document.getElementById("sendRate").value);
}

function toggleText(buttonId) {
  const button = document.getElementById(buttonId);
  if (button.innerHTML === "enable") {
    button.innerHTML = "bypass";
  } else {
    button.innerHTML = "enable";
  }
}

function toggleVisibility(event) {
  // Get the id of the clicked button and the button element
  const buttonId = event.target.id;
  const button = document.getElementById(buttonId);

  // Toggle the innerHTML of the button between "bypass" and "enable"
  if (button.innerHTML === "Bypass") {
    button.innerHTML = "Enable";
  } else {
    button.innerHTML = "Bypass";
  }
  if (button.className === "button_up byp") {
    button.className = "button byp";
  } else {
    button.className = "button_up byp";
  }

  // Get the table cell containing the button
  const cell = button.parentElement;
  const cellIndex = cell.cellIndex; // Assuming the buttons are inside table cells
  console.log(cellIndex);

  // Check if the button is inside a table cell
  if (cellIndex !== -1) {
    // Get the table containing the cell
    const table = cell.closest("table");

    // Get the cells in the two rows above and in the same column as the clicked button
    const twoRowsAbove =
      cell.parentElement.previousElementSibling.previousElementSibling;
    const cellTwoRowsAbove = twoRowsAbove.querySelector(
      "td:nth-child(" + (cellIndex + 1) + ")"
    );

    const rowAbove = cell.parentElement.previousElementSibling;
    const cellOneRowAbove = rowAbove.querySelector(
      "td:nth-child(" + (cellIndex + 1) + ")"
    );

    // Toggle the visibility of the cells in the two rows above
    if (cellTwoRowsAbove && cellOneRowAbove) {
      toggleCellVisibility(cellTwoRowsAbove);
      toggleCellVisibility(cellOneRowAbove);
    } else {
      console.error("Cells not found in the two rows above");
    }
  } else {
    console.error("Button not found inside a table cell");
  }
}

function toggleCellVisibility(cell) {
  if (cell.style.visibility === "hidden") {
    cell.style.visibility = "visible";
  } else {
    cell.style.visibility = "hidden";
  }
}

function viewlogs() {
  let logs = document.getElementById("logging");
  let clearlogs = document.getElementById("clearlogs");
  let deploy = document.getElementById("viewlogs");

  if (logs.style.visibility === "hidden") {
    logs.style.visibility = "visible";
    logs.style.minHeight = "150px";
    logs.style.maxHeight = "150px";
    clearlogs.style.visibility = "visible";
    clearlogs.style.height = "20px";
    deploy.textContent = "▼";
  } else {
    logs.style.visibility = "hidden";
    logs.style.minHeight = "1px";
    logs.style.maxHeight = "1px";
    clearlogs.style.visibility = "hidden";
    clearlogs.style.height = "1px";
    deploy.textContent = "►";
  }
  
  // Update window height after toggle
  updateWindowHeight();
}

function toggleVisualization() {
  let content = document.getElementById("visualization-content");
  let button = document.getElementById("viewvis");
  
  if (content.style.visibility === "hidden") {
    content.style.visibility = "visible";
    content.style.maxHeight = "400px";
    button.textContent = "▼";
  } else {
    content.style.visibility = "hidden";
    content.style.maxHeight = "1px";
    button.textContent = "►";
  }
  
  // Update window height after toggle
  updateWindowHeight();
}

function updateWindowHeight() {
  // Base height calculation
  let height = 0;
  
  // Menu height (including margins)
  height += 40;  // Menu button + margins
  
  // Table section
  height += 320; // Table rows + padding
  
  // Visualization section
  const visContent = document.getElementById("visualization-content");
  if (visContent && visContent.style.visibility === "visible") {
    height += 20;  // Header
    height += 120; // Visualizer height
    height += 40;  // Padding and margins
  }
  
  // Logs section
  const logs = document.getElementById("logging");
  if (logs && logs.style.visibility === "visible") {
    height += 20;   // Header
    height += 150;  // Logs content
    height += 20;   // Clear logs button
    height += 40;   // Padding and margins
  }
  
  // Additional padding for window
  height += 40;
  
  // Update window height through IPC
  ipcRenderer.send("resize-window", { height });
}

function clearLog() {
  document.getElementById("logging").innerHTML = '<div id="anchor"></div>';
}
