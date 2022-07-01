const { ipcRenderer } = require('electron')


ipcRenderer.on('appVersion', function (event, appVersion) {
    document.getElementById("appVersion").innerHTML = document.getElementById("appVersion").innerHTML + appVersion;
    //document.getElementById("filepath").innerHTML = "none";
    console.log("appVersion:", appVersion);
    
  })

  ipcRenderer.on('udpportOK', (event) => {
    var dot2 = document.getElementById("dot2");
    dot2.style.color = "green";
  })

  ipcRenderer.on('oServerOK', (event) => {
    var dot3 = document.getElementById("dot3");
    dot3.style.color = "green";
  })

  ipcRenderer.on('incoming_datas',(event,translateX,translateY,translateZ,rotateX,rotateY,rotateZ)=>{
    console.log(translateX,translateY,translateZ,rotateX,rotateY,rotateZ)
    
    var factor = document.getElementById("factor").value
   document.getElementById("tr_x").value = Math.pow(translateX*(1), 3)*5*factor
   document.getElementById("tr_y").value = Math.pow(translateY*(1), 3)*5*factor
   document.getElementById("tr_z").value = Math.pow(translateZ*(1), 3)*5*factor
   document.getElementById("rt_x").value = Math.pow(rotateX*(1), 3)*5*factor
   document.getElementById("rt_y").value = Math.pow(rotateY*(1), 3)*5*factor
   document.getElementById("rt_z").value =Math.pow(rotateZ*(1), 3)*5*factor
  })

  ipcRenderer.on("buttons", (event,buttons)=>{
    if (buttons[0] === true){
      document.getElementById("index").stepDown()
    }
    if (buttons[1] === true){
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
  OSCserverIP = data1;
  OSCserverPort = port2;
  add3.textContent = "OK!  Address : " + data1 + "   /   Port : " + port2;
  ipcRenderer.send('sendOSCserverIP', data1);
  ipcRenderer.send('sendOSCserverPort', Number(port2));
  event.preventDefault();
}

function aedMode(event){  
  document.getElementById("btn1").className = "button"
  document.getElementById("btn2").className = "button_up"
  document.getElementById("btn3").className = "button_up"
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
}

function xyzMode(event){
  document.getElementById("btn1").className = "button_up"
  document.getElementById("btn2").className = "button"
  document.getElementById("btn3").className = "button_up"
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
}

function customMode(event){
  document.getElementById("btn1").className = "button_up"
  document.getElementById("btn2").className = "button_up"
  document.getElementById("btn3").className = "button"
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
}