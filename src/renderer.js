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
   var prefix = document.getElementById("prefix").value
   var index = document.getElementById("index").value
   var tr_x = document.getElementById("tr_x").value
   var tr_y = document.getElementById("tr_y").value
   var tr_z = document.getElementById("tr_z").value
   var rt_x = document.getElementById("rt_x").value
   var rt_y = document.getElementById("rt_y").value
   var rt_z = document.getElementById("rt_z").value
   var at_tr_x = document.getElementById("at_tr_x").value
   var at_tr_y = document.getElementById("at_tr_y").value
   var at_tr_z = document.getElementById("at_tr_z").value
   var at_rt_x = document.getElementById("at_rt_x").value
   var at_rt_y = document.getElementById("at_rt_y").value
   var at_rt_z = document.getElementById("at_rt_z").value
   var at_tr_x_box = document.getElementById("at_tr_x")
   var at_tr_y_box = document.getElementById("at_tr_y")
   var at_tr_z_box = document.getElementById("at_tr_z")
   var at_rt_x_box = document.getElementById("at_rt_x")
   var at_rt_y_box = document.getElementById("at_rt_y")
   var at_rt_z_box = document.getElementById("at_rt_z")
   var table = document.getElementById("tableOfConnection")
   for(i = 0; i< table.rows[5].length; i++){
    var visibility = table.rows[5].cells[i].firstChild.style.visibility
    if(visibility !== "hidden"){
      var attr = table.rows[5].cells[i].firstChild.value
      var value = table.rows[6].cells[i].firstChild.value
      ipcRenderer.send("ok_to_send",prefix,index,attr,value)

    }
   }

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

  fst_byp = document.getElementsByClassName("byp")
  for (let i = 0; i < 3; i++) {
  fst_byp.item(i).className = "button byp"
  }
  lst_byp = document.getElementsByClassName("byp")
  for (let i = 3; i < 6; i++) {
    fst_byp.item(i).className = "button_up byp"
    }
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

  fst_byp = document.getElementsByClassName("byp")
  for (let i = 0; i < 3; i++) {
  fst_byp.item(i).className = "button_up byp"
  }
  lst_byp = document.getElementsByClassName("byp")
  for (let i = 3; i < 6; i++) {
    fst_byp.item(i).className = "button byp"
    }
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
  byp = document.getElementsByClassName("byp")
  for (let i = 0; i < byp.length; i++) {
  byp.item(i).className = "button_up byp"
  }
}

function byp_1(event){
  if(document.getElementById("byp1").className == "button_up byp"){
    document.getElementById("byp1").className = "button byp"
    document.getElementById("tr_x").style.visibility = "hidden"
    document.getElementById("at_tr_x").style.visibility = "hidden"
  }
  else{
    document.getElementById("byp1").className = "button_up byp"
    document.getElementById("tr_x").style.visibility = "visible"
    document.getElementById("at_tr_x").style.visibility = "visible"
  }
}
function byp_2(event){
  if(document.getElementById("byp2").className == "button_up byp"){
    document.getElementById("byp2").className = "button byp"
    document.getElementById("tr_y").style.visibility = "hidden"
    document.getElementById("at_tr_y").style.visibility = "hidden"
  }
  else{
    document.getElementById("byp2").className = "button_up byp"
    document.getElementById("tr_y").style.visibility = "visible"
    document.getElementById("at_tr_y").style.visibility = "visible"
  }
}
function byp_3(event){
  if(document.getElementById("byp3").className == "button_up byp"){
    document.getElementById("byp3").className = "button byp"
    document.getElementById("tr_z").style.visibility = "hidden"
    document.getElementById("at_tr_z").style.visibility = "hidden"
  }
  else{
    document.getElementById("byp3").className = "button_up byp"
    document.getElementById("tr_z").style.visibility = "visible"
    document.getElementById("at_tr_z").style.visibility = "visible"
  }
}
function byp_4(event){
  if(document.getElementById("byp4").className == "button_up byp"){
    document.getElementById("byp4").className = "button byp"
    document.getElementById("rt_x").style.visibility = "hidden"
    document.getElementById("at_rt_x").style.visibility = "hidden"
  }
  else{
    document.getElementById("byp4").className = "button_up byp"
    document.getElementById("rt_x").style.visibility = "visible"
    document.getElementById("at_rt_x").style.visibility = "visible"
  }
}
function byp_5(event){
  if(document.getElementById("byp5").className == "button_up byp"){
    document.getElementById("byp5").className = "button byp"
    document.getElementById("rt_y").style.visibility = "hidden"
    document.getElementById("at_rt_y").style.visibility = "hidden"
  }
  else{
    document.getElementById("byp5").className = "button_up byp"
    document.getElementById("rt_y").style.visibility = "visible"
    document.getElementById("at_rt_y").style.visibility = "visible"
  }
}
function byp_6(event){
  if(document.getElementById("byp6").className == "button_up byp"){
    document.getElementById("byp6").className = "button byp"
    document.getElementById("rt_z").style.visibility = "hidden"
    document.getElementById("at_rt_z").style.visibility = "hidden"
  }
  else{
    document.getElementById("byp6").className = "button_up byp"
    document.getElementById("rt_z").style.visibility = "visible"
    document.getElementById("at_rt_z").style.visibility = "visible"
  }
}