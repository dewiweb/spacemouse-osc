/*
var Hidstream = require('node-hid-stream').Hidstream;
var hidstream = new Hidstream({ vendorId: 9583, productId: 50741 });
 
hidstream.on("data", function(data) {
  console.log(data); // Raw buffer from HDI device.
});
*/
const osc = require('osc')
oscCli = new osc.UDPPort({
  localAddress: "0.0.0.0",
  localPort: 7707,
  metadata: true
});
oscCli.open()
sm = require("./lib.js");
iteration = 1
//console.log ("operationnal1");
sm.spaceMice.onData = mouse => {
    console.clear();
//    console.log ("operationnal2");
datas = JSON.stringify(mouse.mice[0], null, 2);
translateX = mouse.mice[0].translate.x;
translateY = mouse.mice[0].translate.y;
translateZ = mouse.mice[0].translate.z;
rotateX = mouse.mice[0].rotate.x;
rotateY = mouse.mice[0].rotate.y;
rotateZ = mouse.mice[0].rotate.z;
sendFrequency = 3

 if (iteration<sendFrequency){
     iteration = iteration+1
 }
 else{


    console.log(datas);
    oscCli.send({
        timeTag: osc.timeTag(0), // Schedules this bundle 60 seconds from now.
        packets: [
//        {
 //       address: "/track/3/z++",
//        args: [
//            {
//                type: "f",
//                value: Math.pow(translateZ*(1), 3)
//            }
//        ]
//    },
    {
        address: "/track/3/azim++",
        args: [
            {
                type: "f",
                value: Math.pow(rotateY*(1), 3)*5
            }
        ]
    },{
        address: "/track/3/dist++",
        args: [
            {
                type: "f",
                value: Math.pow(rotateZ*(1), 3)*5
            }
        ]
    }
]}, "192.168.100.12", 4003)

    iteration=0
}
};
