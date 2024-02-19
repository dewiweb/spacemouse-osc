const { ipcRenderer } = require('electron');
const preferences = ipcRenderer.sendSync('getPreferences');
const log = require('electron-log');

function logDefinition() {
  console.log = log.log;
  Object.assign(console, log.functions);
  log.transports.console.format = '{h}:{i}:{s} / {text}';
}
logDefinition();

log.transports.div = log.transports.console


ipcRenderer.on('appVersion', function (event, appVersion) {
  document.getElementById("appVersion").innerHTML = document.getElementById("appVersion").innerHTML + appVersion;
  //document.getElementById("filepath").innerHTML = "none";
  //console.log("appVersion:", appVersion);

})

ipcRenderer.on('preferencesUpdated', (e, preferences) => {
  //console.log('Preferences were updated', preferences);
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
 
  var precision =document.getElementById("precision").value
  var factor = document.getElementById("factor").value
    document.getElementById("tr_x").value = Math.round((Math.pow(translateX * (1), 3) * 5 * factor)*precision)/precision
    document.getElementById("tr_y").value = Math.round((Math.pow(translateY * (1), 3) * -5 * factor)*precision)/precision
    document.getElementById("tr_z").value = Math.round((Math.pow(translateZ * (1), 3) * -5 * factor)*precision)/precision
    document.getElementById("rt_x").value = Math.round((Math.pow(rotateX * (1), 3) * 5 * factor)*precision)/precision
    document.getElementById("rt_y").value = Math.round((Math.pow(rotateY * (1), 3) * -5 * factor)*precision)/precision
    document.getElementById("rt_z").value = Math.round((Math.pow(rotateZ * (1), 3) * 5 * factor)*precision)/precision

  var index_or_not = document.getElementById("index").style.visibility
  //console.log("visibility of index value : ", index_or_not)
  var prefix = document.getElementById("prefix").value
  var index = document.getElementById("index").value
  var table = document.getElementById("tableOfConnection")
  ////console.log("table",table.rows[5])
  for (i = 0; i < table.rows[5].cells.length; i++) {
    //console.log("table_row_5, cell " + i + ":", table.rows[5].cells[i])
    var visibility = table.rows[5].cells[i].firstChild.style.visibility
    if (visibility !== "hidden") {
      let now = Date();
      var attr = table.rows[5].cells[i].firstChild.value

      var inc_value = table.rows[6].cells[i].firstChild.value
        
        ipcRenderer.send("ok_to_send", prefix, index, index_or_not, attr, inc_value)
    }
  }

})

ipcRenderer.on("buttons", (event, buttons) => {
  if (buttons[0] === true) {
    document.getElementById("index").stepDown()
  }
  if (buttons[1] === true) {
    document.getElementById("index").stepUp()
  }
})

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

function aedMode(event) {
  document.getElementById("btn1").className = "button_up"
  document.getElementById("btn2").className = "button"
  document.getElementById("btn3").className = "button"
  document.getElementById("tr_x").style.visibility = "hidden"
  document.getElementById("tr_y").style.visibility = "hidden"
  document.getElementById("tr_z").style.visibility = "hidden"
  document.getElementById("rt_x").style.visibility = "visible"
  document.getElementById("rt_y").style.visibility = "visible"
  document.getElementById("rt_z").style.visibility = "visible"
  document.getElementById("at_tr_x").style.visibility = "hidden"
  document.getElementById("at_tr_y").style.visibility = "hidden"
  document.getElementById("at_tr_z").style.visibility = "hidden"
  document.getElementById("at_rt_x").style.visibility = "visible"
  document.getElementById("at_rt_y").style.visibility = "visible"
  document.getElementById("at_rt_z").style.visibility = "visible"

  fst_byp = document.getElementsByClassName("byp")
  for (let i = 0; i < 3; i++) {
    fst_byp.item(i).className = "button byp"
  }
  lst_byp = document.getElementsByClassName("byp")
  for (let i = 3; i < 6; i++) {
    fst_byp.item(i).className = "button_up byp"
  }
}

function xyzMode(event) {
  document.getElementById("btn1").className = "button"
  document.getElementById("btn2").className = "button_up"
  document.getElementById("btn3").className = "button"
  document.getElementById("rt_x").style.visibility = "hidden"
  document.getElementById("rt_y").style.visibility = "hidden"
  document.getElementById("rt_z").style.visibility = "hidden"
  document.getElementById("tr_x").style.visibility = "visible"
  document.getElementById("tr_y").style.visibility = "visible"
  document.getElementById("tr_z").style.visibility = "visible"
  document.getElementById("at_rt_x").style.visibility = "hidden"
  document.getElementById("at_rt_y").style.visibility = "hidden"
  document.getElementById("at_rt_z").style.visibility = "hidden"
  document.getElementById("at_tr_x").style.visibility = "visible"
  document.getElementById("at_tr_y").style.visibility = "visible"
  document.getElementById("at_tr_z").style.visibility = "visible"

  fst_byp = document.getElementsByClassName("byp")
  for (let i = 0; i < 3; i++) {
    fst_byp.item(i).className = "button_up byp"
  }
  lst_byp = document.getElementsByClassName("byp")
  for (let i = 3; i < 6; i++) {
    fst_byp.item(i).className = "button byp"
  }
}

function customMode(event) {
  document.getElementById("btn1").className = "button"
  document.getElementById("btn2").className = "button"
  document.getElementById("btn3").className = "button_up"
  document.getElementById("rt_x").style.visibility = "visible"
  document.getElementById("rt_y").style.visibility = "visible"
  document.getElementById("rt_z").style.visibility = "visible"
  document.getElementById("tr_x").style.visibility = "visible"
  document.getElementById("tr_y").style.visibility = "visible"
  document.getElementById("tr_z").style.visibility = "visible"
  document.getElementById("at_rt_x").style.visibility = "visible"
  document.getElementById("at_rt_y").style.visibility = "visible"
  document.getElementById("at_rt_z").style.visibility = "visible"
  document.getElementById("at_tr_x").style.visibility = "visible"
  document.getElementById("at_tr_y").style.visibility = "visible"
  document.getElementById("at_tr_z").style.visibility = "visible"
  byp = document.getElementsByClassName("byp")
  for (let i = 0; i < byp.length; i++) {
    byp.item(i).className = "button_up byp"
  }
}
function byp_0(event) {
  if (document.getElementById("byp0").className == "button_up byp") {
    document.getElementById("byp0").className = "button byp"
    document.getElementById("byp0").innerHTML = "enable"

    document.getElementById("index").style.visibility = "hidden"
  }
  else {
    document.getElementById("byp0").className = "button_up byp"
    document.getElementById("byp0").innerHTML = "bypass"

    document.getElementById("index").style.visibility = "visible"
  }
}

function byp_1(event) {
  if (document.getElementById("byp1").className == "button_up byp") {
    document.getElementById("byp1").className = "button byp"
    document.getElementById("byp1").innerHTML = "enable"

    document.getElementById("tr_x").style.visibility = "hidden"
    document.getElementById("at_tr_x").style.visibility = "hidden"
  }
  else {
    document.getElementById("byp1").className = "button_up byp"
    document.getElementById("byp1").innerHTML = "bypass"

    document.getElementById("tr_x").style.visibility = "visible"
    document.getElementById("at_tr_x").style.visibility = "visible"
  }
}
function byp_2(event) {
  if (document.getElementById("byp2").className == "button_up byp") {
    document.getElementById("byp2").className = "button byp"
    document.getElementById("byp2").innerHTML = "enable"

    document.getElementById("tr_y").style.visibility = "hidden"
    document.getElementById("at_tr_y").style.visibility = "hidden"
  }
  else {
    document.getElementById("byp2").className = "button_up byp"
    document.getElementById("byp2").innerHTML = "bypass"

    document.getElementById("tr_y").style.visibility = "visible"
    document.getElementById("at_tr_y").style.visibility = "visible"
  }
}
function byp_3(event) {
  if (document.getElementById("byp3").className == "button_up byp") {
    document.getElementById("byp3").className = "button byp"
    document.getElementById("byp3").innerHTML = "enable"

    document.getElementById("tr_z").style.visibility = "hidden"
    document.getElementById("at_tr_z").style.visibility = "hidden"
  }
  else {
    document.getElementById("byp3").className = "button_up byp"
    document.getElementById("byp3").innerHTML = "bypass"

    document.getElementById("tr_z").style.visibility = "visible"
    document.getElementById("at_tr_z").style.visibility = "visible"
  }
}
function byp_4(event) {
  if (document.getElementById("byp4").className == "button_up byp") {
    document.getElementById("byp4").className = "button byp"
    document.getElementById("byp4").innerHTML = "enable"

    document.getElementById("rt_x").style.visibility = "hidden"
    document.getElementById("at_rt_x").style.visibility = "hidden"
  }
  else {
    document.getElementById("byp4").className = "button_up byp"
    document.getElementById("byp4").innerHTML = "bypass"

    document.getElementById("rt_x").style.visibility = "visible"
    document.getElementById("at_rt_x").style.visibility = "visible"
  }
}
function byp_5(event) {
  if (document.getElementById("byp5").className == "button_up byp") {
    document.getElementById("byp5").className = "button byp"
    document.getElementById("byp5").innerHTML = "enable"

    document.getElementById("rt_y").style.visibility = "hidden"
    document.getElementById("at_rt_y").style.visibility = "hidden"
  }
  else {
    document.getElementById("byp5").className = "button_up byp"
    document.getElementById("byp5").innerHTML = "bypass"

    document.getElementById("rt_y").style.visibility = "visible"
    document.getElementById("at_rt_y").style.visibility = "visible"
  }
}
function byp_6(event) {
  if (document.getElementById("byp6").className == "button_up byp") {
    document.getElementById("byp6").className = "button byp"
    document.getElementById("byp6").innerHTML = "enable"

    document.getElementById("rt_z").style.visibility = "hidden"
    document.getElementById("at_rt_z").style.visibility = "hidden"
  }
  else {
    document.getElementById("byp6").className = "button_up byp"
    document.getElementById("byp6").innerHTML = "bypass"

    document.getElementById("rt_z").style.visibility = "visible"
    document.getElementById("at_rt_z").style.visibility = "visible"
  }
}

function showPreferences(preferencesBtn) {
  ipcRenderer.send('showPreferences');
}

function sendRateChange(event) {
  ipcRenderer.send('sendRateChange', document.getElementById("sendRate").value);
}