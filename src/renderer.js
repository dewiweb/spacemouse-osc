/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */
import './index.css';

console.log('👋 This message is being logged by "renderer.js", included via webpack');

function advancedMode(e) {
    e.preventDefault();
    var switcher = document.getElementById("switcher");
    //var hideOnAdvanced = document.getElementsByClassName("hideOnAdvanced");
    //var stayOnAdvanced = document.getElementsByClassName("stayOnAdvanced");
    //var slct0 = document.getElementById("slct0");
    //var slct1 = document.getElementById("slct1");
    //var eChanNumb = document.getElementById("eChanNumb");
    //var eChanNumbPrefix = document.getElementById("eChanNumbPrefix");
    //var eUserLabel = document.getElementById("eUserLabel");
    //var iCNPLabel = document.getElementById("iCNPLabel");
    if (switcher.className == "toggle") {
      switcher.className = "toggle toggle-on";
      
      //iCNPLabel.style.visibility = "hidden";
      //stayOnAdvanced[0].style.display = "block";
      //stayOnAdvanced[0].style.visibility = "visible";
      //stayOnAdvanced[0].setAttribute('size', "75%");
      //for (var i = 0; i < hideOnAdvanced.length; i++) {
      //  hideOnAdvanced[i].style.display = "none";
      //};
      //slct0.required = false;
      //slct1.required = false;
      //eUserLabel.required = false;
      //eChanNumb.required = false;
      //eChanNumbPrefix.value = ""
      //iCNPLabel.style.display = "inline-block";
      //hideOnAdvanced[0].style.display = "inline-block";
      //hideOnAdvanced[0].style.visibility = "hidden";
    } else {
      switcher.className = "toggle";
      //stayOnAdvanced[0].setAttribute('size', "3");
      //for (var i = 0; i < hideOnAdvanced.length; i++) {
      //  hideOnAdvanced[i].style.display = "inline-block";
      //};
      //slct0.required = true;
      //slct1.required = true;
      //eUserLabel.required = true;
      //eChanNumb.required = true;
      //iCNPLabel.style.visibility = "visible";
      //hideOnAdvanced[0].style.visibility = "visible";
    };
}
