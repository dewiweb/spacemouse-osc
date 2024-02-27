const { ipcRenderer } = require('electron');
const preferences = ipcRenderer.sendSync('getPreferences');
const log = require('electron-log');
const _ = require('lodash');
const modeFunctions = {
  aed: customMode,
  ad: customMode,
  xyz: customMode,
  xy: customMode,
  custom1: customMode,
  custom2: customMode,
  custom3: customMode
};

function initInputs() {
  document.addEventListener('wheel', (event) => {
    const inputElement = event.target;
    if (inputElement.type === 'number') {
      event.preventDefault();
      
      const step = parseFloat(inputElement.step) || 1;
      const delta = event.deltaY > 0 ? step : -step;
      let newValue = parseFloat(inputElement.value || 0) + delta;

      if (inputElement.min !== '' && newValue < parseFloat(inputElement.min)) {
        newValue = parseFloat(inputElement.min);
      }

      const decimals = Math.max(0, String(step).split('.')[1]?.length || 0);
      inputElement.value = parseFloat(newValue.toFixed(decimals));
    }
  }, { passive: false });
}

//function initSelects() {
//  document.addEventListener('wheel', function(event) {
//    event.preventDefault(); // Prevent the default behavior of the mouse wheel
//    const selectElements = document.querySelectorAll('select'); // Get all select elements
//    selectElements.forEach(selectElement => {
//      if(selectElement === document.activeElement) {
//        if (event.deltaY < 0) {
//          // Scroll up, select the previous option
//          selectElement.selectedIndex = Math.max(selectElement.selectedIndex - 1, 0);
//        } else {
//          // Scroll down, select the next option
//          selectElement.selectedIndex = Math.min(selectElement.selectedIndex + 1, selectElement.options.length - 1);
//        }
//      }
//    });
//  }, { passive: false });
//  
//}
  function resetInputValuesOnDoubleClick() {
    // Get all input elements
    const inputElements = document.querySelectorAll('input');
  
    // Add event listener to each input element
    inputElements.forEach(input => {
      input.addEventListener('dblclick', function() {
        this.value = this.defaultValue; // Reset the value to its default value
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    initInputs(); // Call the initInputs function to initialize input behavior
    //initSelects(); // Call the initSelects function to initialize select behavior
    resetInputValuesOnDoubleClick(); // Call the resetInputValuesOnDoubleClick function to enable double-click reset
  });

function logDefinition() {
  console.log = log.log;
  Object.assign(console, log.functions);
  log.transports.console.format = '{h}:{i}:{s} / {text}';
}
logDefinition();

log.transports.div = log.transports.console

ipcRenderer.on("logInfo", (e, msg) => {
  logger(msg);
}
);
  function logger(msg){
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
};
function scrollToBottom() {
  document.getElementById("logging").scrollTop =
    document.getElementById("logging").scrollHeight;
}


ipcRenderer.on('appVersion', function (event, appVersion) {
  document.getElementById("appVersion").innerHTML = document.getElementById("appVersion").innerHTML + appVersion;


})

ipcRenderer.on('preferencesUpdated', (e, preferences) => {
  ip_portRegex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9]?[0-9]):(6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]\d{4}|[1-9]\d{0,3})$/;
  ip_port = preferences.network_settings.osc_server;
  //logger('ip_port : ' +preferences.network_settings.osc_server +' in regex : ' +ip_portRegex.test(ip_port))
  if(ip_portRegex.test(ip_port)=== true){
    //logger("matching ip:port")
    ipcRenderer.send('matchingIpPort');
  }else{
    //logger("not matching ip:port")
    ipcRenderer.send('notMatchingIpPort');
  }
  //logger(preferences.network_settings.osc_server);
//
  
});

ipcRenderer.on('resolveError', (e) => {
  ipcRenderer.send('showPreferences');
})

ipcRenderer.on('incoming_index', (e, inc_index) => {
  //console.log('inc_index', inc_index)
  document.getElementById('index').value = inc_index;
})


ipcRenderer.on('incoming_data', (event, translateX, translateY, translateZ, rotateX, rotateY, rotateZ) => {
  //console.log(translateX, translateY, translateZ, rotateX, rotateY, rotateZ)
 
  var precision = document.getElementById("precision").value
  var factor = document.getElementById("factor").value
  if (precision !== "clear"){
    document.getElementById("tr_x").value = Math.round((Math.pow(translateX * (1), 3) * 5 * factor)*precision)/precision
    document.getElementById("tr_y").value = Math.round((Math.pow(translateY * (1), 3) * -5 * factor)*precision)/precision
    document.getElementById("tr_z").value = Math.round((Math.pow(translateZ * (1), 3) * -5 * factor)*precision)/precision
    document.getElementById("rt_x").value = Math.round((Math.pow(rotateX * (1), 3) * 5 * factor)*precision)/precision
    document.getElementById("rt_y").value = Math.round((Math.pow(rotateY * (1), 3) * -5 * factor)*precision)/precision
    document.getElementById("rt_z").value = Math.round((Math.pow(rotateZ * (1), 3) * 5 * factor)*precision)/precision
  }else{
    document.getElementById("tr_x").value = Math.pow(translateX * (1), 3) * 5 * factor
    document.getElementById("tr_y").value = Math.pow(translateY * (1), 3) * -5 * factor
    document.getElementById("tr_z").value = Math.pow(translateZ * (1), 3) * -5 * factor
    document.getElementById("rt_x").value = Math.pow(rotateX * (1), 3) * 5 * factor
    document.getElementById("rt_y").value = Math.pow(rotateY * (1), 3) * -5 * factor
    document.getElementById("rt_z").value = Math.pow(rotateZ * (1), 3) * 5 * factor
  }
  var index_or_not = document.getElementById("index").parentElement.style.visibility
  //console.log("visibility of index value : ", index_or_not)
  var prefix = document.getElementById("prefix").value;
  var index = document.getElementById("index").value;
  //console.log("prefix", prefix, "index", index, "index_or_not", index_or_not);
  var table = document.getElementById("tableOfConnection")
  //console.log("table.rows[3].cells.length", table.rows[3].cells.length)
  for (i = 0; i < table.rows[3].cells.length; i++) {
    //console.log("table_row_5, cell " + i + ":", table.rows[5].cells[i])
    var visible = table.rows[3].cells[i].style.visibility;
    var attrib = table.rows[3].cells[i].firstElementChild.value;
    //console.log("visibility",i, visible)
    //console.log("attrib",i, attrib)
    if (visible !== "hidden") {
      let now = Date();
      var inc_value = table.rows[4].cells[i].firstElementChild.value
      console.log("inc_value", inc_value)
        if (inc_value !== "0"){
          ipcRenderer.send("ok_to_send", prefix, index, index_or_not, attrib, inc_value)
        }
    }
  }

})

const processButtons = _.debounce((buttons) => {
  if (buttons[0] === true) {
    document.getElementById("index").stepDown();
  }
  if (buttons[1] === true) {
    document.getElementById("index").stepUp();
  }
}, 20); // 200 milliseconds debounce rate

ipcRenderer.on("buttons", (event, buttons) => {
  processButtons(buttons);
});

function displayForm3(event) {
  const add3 = document.getElementById('add3');
  var ip11 = document.getElementById("ip11").value;
  var ip21 = document.getElementById("ip21").value;
  var ip31 = document.getElementById("ip31").value;
  var ip41 = document.getElementById("ip41").value;
  var port2 = document.getElementById("port2").value;
  var data1 = ip11 + "." + ip21 + "." + ip31 + "." + ip41;
  oscServerIp = data1;
  oscServerPort = port2;
  add3.textContent = "OK!  Address : " + data1 + "   /   Port : " + port2;
  ipcRenderer.send('sendOscServerIp', data1);
  ipcRenderer.send('sendOscServerPort', Number(port2));
  event.preventDefault();
}


function modeChange(event) {
  selection = event.target.value;
  console.log("modeChange_selection: ",selection)
  document.getElementById("mode").value = selection;
  console.log("preferencesOnRendererSide",preferences)
  set = preferences.paths_sets[selection];
  console.log("set: ",set)
  if (modeFunctions[selection]) {
    modeFunctions[selection](selection,set);
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

//function aedMode() {
//  setVisibility(["tr_x", "tr_y", "tr_z","at_tr_x", "at_tr_y", "at_tr_z"], "hidden");
//  setVisibility(["rt_x", "rt_y", "rt_z","at_rt_x", "at_rt_y", "at_rt_z"], "visible");
//
//  const bypButtons = document.querySelectorAll(".byp");
//  updateButtons(bypButtons, 1, 4, "button byp", "Enable");
//  updateButtons(bypButtons, 4, 7, "button_up byp", "Bypass");
//}
//
//function adMode() {
//  setVisibility(["tr_x", "tr_y", "tr_z", "rt_x", "at_tr_x", "at_tr_y", "at_tr_z","at_rt_x"], "hidden");
//  setVisibility(["rt_y", "rt_z", "at_rt_y", "at_rt_z"], "visible");
//
//  const bypButtons = document.querySelectorAll(".byp");
//  updateButtons(bypButtons, 1, 5, "button byp", "Enable");
//  updateButtons(bypButtons, 5, 7, "button_up byp", "Bypass");
//}
//
//function xyzMode() {
//  setVisibility(["rt_x", "rt_y", "rt_z","at_rt_x", "at_rt_y", "at_rt_z"], "hidden");
//  setVisibility(["tr_x", "tr_y", "tr_z","at_tr_x", "at_tr_y", "at_tr_z"], "visible");
//
//  const bypButtons = document.querySelectorAll(".byp");
//  updateButtons(bypButtons, 1, 4, "button_up byp", "Bypass");
//  updateButtons(bypButtons, 4, 7, "button byp", "Enable");
//}
//
//function xyMode() {
//  setVisibility(["rt_x", "rt_y","rt_z" ,"tr_z", "at_rt_x", "at_rt_y", "at_rt_z", "at_tr_z"], "hidden");
//  setVisibility(["tr_x", "tr_y", "at_tr_x", "at_tr_y"], "visible");
//
//  const bypButtons = document.querySelectorAll(".byp");
//  updateButtons(bypButtons, 1, 4, "button_up byp", "Bypass");
//  updateButtons(bypButtons, 4, 7, "button byp", "Enable");
//  bypButtons[3].className = "button byp";
//  bypButtons[3].innerHTML = "Enable";
//}

function setAtVisibility(elementIds, visibility) {
  elementIds.forEach((id) => {
    document.getElementById(id).style.visibility = visibility;
  });
}

function customMode(mode,set) {
  console.log("set: ",set)
  modeArray = JSON.parse(set);
  atArray = document.querySelectorAll(".at");
  valueArray = document.querySelectorAll(".value");
  bypArray = document.querySelectorAll(".byp");
  quadrupletArray = (modeArray.map((element,index)=>[element,atArray[index],valueArray[index],bypArray[index+1]]));
  for (i=0;i<quadrupletArray.length;i++){
    if (!quadrupletArray[i][0]){
      bypArray[i+1].className = "button byp";
      bypArray[i+1].innerHTML = "Enable";
      atArray[i].style.visibility = 'hidden';
      valueArray[i].style.visibility = 'hidden';
    }else{
      bypArray[i+1].className = "button_up byp";
      bypArray[i+1].innerHTML = "Bypass";
      atArray[i].style.visibility = 'visible';
      atArray[i].firstElementChild.value = "/"+quadrupletArray[i][0];
      valueArray[i].style.visibility = 'visible';
    }
  }
  
}


ipcRenderer.on("modeChanged", (event, mode,set) => {
  if (modeFunctions[mode]) {
    //modeSet = preferences.value('paths_sets.' + modeValue)
    document.getElementById("mode").value = mode;
    modeFunctions[mode](mode,set);
  } else {
    // Handle the case where the mode is not found
    logger("Unknown mode:", mode);
  }
});

ipcRenderer.on("prefixChanged", (event, prefix) => {
  document.getElementById("prefix").value = prefix;
})

ipcRenderer.on("indexChanged", (event, index) => {
  idButton = document.getElementById("byp0");
  const indexCell = idButton.parentElement.previousElementSibling;
  indexCell.children[1].style.visibility = 'visible';
  if (index === "on" ){
    if (indexCell.style.visibility === 'hidden'){
      indexCell.style.visibility = 'visible';
      idButton.innerHTML = "Bypass";
      idButton.className = "button_up byp";
    };
    }else if (index === "off"){
      if (indexCell.style.visibility === 'visible'){
        indexCell.style.visibility = 'hidden';
        idButton.innerHTML = "Enable";
        idButton.className = "button byp";
      }
    }else if (index === "reset"){
      document.getElementById("index").value = 1;
    }
    else{
      document.getElementById("index").value = index;
  }
})

ipcRenderer.on("factorChanged", (event, factor) => {
  document.getElementById("factor").value = factor;
})

ipcRenderer.on("precisionChanged", (event, precision) => {
  document.getElementById("precision").value = precision;
})

ipcRenderer.on("sendRateChanged", (event, sendRate) => {
  document.getElementById("sendRate").value = sendRate;
})









//
function byp_0(event) {
  const buttonId = event.target.id;
  const button = document.getElementById(buttonId);
  const indexCell = button.parentElement.previousElementSibling;
  indexCell.style.visibility = (indexCell.style.visibility === 'hidden') ? 'visible' : 'hidden';
  indexCell.children[1].style.visibility = 'visible';

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
  ipcRenderer.send('showPreferences');
}

/**
 * Sends the rate change event using IPC
 * @param {Event} event - The event triggering the rate change
 */
function sendRateChange(event) {
  // Send the rate change event using IPC
  ipcRenderer.send('sendRateChange', document.getElementById("sendRate").value);
}

/**
 * Toggle the text of a button between "enable" and "bypass" when it is clicked.
 * @param {string} buttonId - The ID of the button to be toggled
 */
function toggleText(buttonId) {
  const button = document.getElementBy
  Id(buttonId);
  if (button.innerHTML === "enable") {
    button.innerHTML = "bypass";
  } else {
    button.innerHTML = "enable";
  }
}


/**
 * Toggles the visibility of the cells in the two rows above and in the same column as the cells containing buttons when their buttons with ids "byp1", "byp2", "byp3", "byp4", "byp5", "byp6" are clicked.
 * @param {Event} event - The event object triggered by the button click
 */
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
  console.log(cellIndex)

  // Check if the button is inside a table cell
  if (cellIndex !== -1) {
    // Get the table containing the cell
    const table = cell.closest('table');

    // Get the cells in the two rows above and in the same column as the clicked button
    const twoRowsAbove = cell.parentElement.previousElementSibling.previousElementSibling;
    const cellTwoRowsAbove = twoRowsAbove.querySelector('td:nth-child(' + (cellIndex + 1) + ')');

    const rowAbove = cell.parentElement.previousElementSibling;
    const cellOneRowAbove = rowAbove.querySelector('td:nth-child(' + (cellIndex + 1) + ')');

    // Toggle the visibility of the cells in the two rows above
    if (cellTwoRowsAbove && cellOneRowAbove) {
      toggleCellVisibility(cellTwoRowsAbove);
      toggleCellVisibility(cellOneRowAbove);
    } else {
      console.error('Cells not found in the two rows above');
    }
  } else {
    console.error('Button not found inside a table cell');
  }
}

/**
 * Toggles the visibility of the given cell between hidden and visible.
 * @param {Element} cell - The cell element to toggle visibility for
 */
function toggleCellVisibility(cell) {
  if (cell.style.visibility === 'hidden') {
    cell.style.visibility = 'visible';
  } else {
    cell.style.visibility = 'hidden';
  }
}

function viewlogs() {
  let logs = document.getElementById("logging");
  if (logs.style.visibility === "hidden") {
    logs.style.visibility = "visible";
    logs.style.maxHeight = "150px";
  } else {
    logs.style.visibility = "hidden";
    logs.style.maxHeight = "1px";
  }
  let clearlogs = document.getElementById("clearlogs");
  if (clearlogs.style.visibility === "hidden") {
    clearlogs.style.visibility = "visible";
    clearlogs.style.height = "20px";
  } else {
    clearlogs.style.visibility = "hidden";
    clearlogs.style.height = "1px";
  }
  let deploy = document.getElementById("viewlogs");
  if (deploy.innerHTML == "►") {
    deploy.innerHTML = "▼";
  } else {
    deploy.innerHTML = "►";
  }
}

function clearLog() {
  document.getElementById("logging").innerHTML = '<div id="anchor"></div>';
}