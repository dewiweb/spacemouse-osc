const { dialog } = require('electron');
const fs = require('fs');

module.exports = {
  //copied from https://github.com/jean-emmanuel/open-stage-control/blob/master/src/client/widgets/utils.js

  clip: function (value, range) {

    value = parseFloat(value)

    if (isNaN(value)) value = range[0]

    return Math.max(Math.min(range[0], range[1]), Math.min(value, Math.max(range[0], range[1])))
  },
  // map a value from a scale to another
  //     value: number
  //     rangeIn: [number, number]
  //     rangeOut: [number, number]
  //     decimals: number (-1 to bypass)
  //     log: true, or manual log scale (max log value)
  //     revertLog: boolean

  mapToScale: function (value, rangeIn, rangeOut, decimals, log, revertlog) {

    // clip in
    value = module.exports.clip(value, [rangeIn[0], rangeIn[1]])


    // normalize
    value = (value - rangeIn[0]) / (rangeIn[1] - rangeIn[0])

    // log scale
    if (log) {

      var logScale = revertlog ? Math.abs(rangeIn[1] - rangeIn[0]) :
        Math.abs(rangeOut[1] - rangeOut[0])

      if (log !== true && log !== -1) logScale = Math.abs(log)
      else if (logScale >= 100) logScale /= 10
      else logScale = Math.max(logScale, 10)

      if (log < 0) revertlog = !revertlog

      value = revertlog ?
        Math.log(value * (logScale - 1) + 1) / Math.log(logScale) :
        Math.pow(logScale, value) / (logScale - 1) - 1 / (logScale - 1)

    }

    // scale out
    value = value * (rangeOut[1] - rangeOut[0]) + rangeOut[0]

    // clip out
    value = module.exports.clip(value, [rangeOut[0], rangeOut[1]])

    // decimals
    if (decimals !== -1) value = parseFloat(value.toFixed(decimals))

    return value

  },

  oscToEmber: function (oscBundle) {
    let oscArgs = JSON.stringify(oscBundle.args);
    oscArgs = oscArgs.replace(/\s|\[|\]/g, "");
    oscArgs = JSON.parse(oscArgs);
    oscArgs = oscArgs.value;
    oscArgs = Number(oscArgs);
    console.log("oscArgs", oscArgs);
    return oscArgs
  },
  embChPath: function (chNumb) {
    let eChPath = 'Channels.Inputs.INP   ';
    eChPath = eChPath.concat(chNumb.toString());
    return eChPath
  },
  embFadLevPath: function (eChPath) {
    let eFadLevPath = eChPath.concat('.Fader.Fader Level');
    return eFadLevPath
  },
  pathToAddress: function (path) {
    let oscAddress = path.replace(/\./g, '/');
    slash = "/";
    oscAddress = slash.concat(oscAddress);
    return oscAddress
  },
  addressToPath: function (address) {
    let path = address.replace(/\//g, '.');
    path = path.slice(1);
    return path
  },

  fromAbsoluteToRelative : function (data, commonRangeXYZ, commonRangeRPY, origins) {
    const [x, y, z, roll, pitch, yaw] = data.split(',');
    
    const [minCommonXYZ, maxCommonXYZ] = commonRangeXYZ;
    const [minCommonRPY, maxCommonRPY] = commonRangeRPY;
    const { prevX, prevY, prevZ, prevRoll, prevPitch, prevYaw } = origins;
  
    // Calculate individual ranges
    const rangeX = [prevX - minCommonXYZ, prevX + maxCommonXYZ];
    const rangeY = [prevY - minCommonXYZ, prevY + maxCommonXYZ];
    const rangeZ = [prevZ - minCommonXYZ, prevZ + maxCommonXYZ];
    const rangeRoll = [prevRoll - minCommonRPY, prevRoll + maxCommonRPY];
    const rangePitch = [prevPitch - minCommonRPY, prevPitch + maxCommonRPY];
    const rangeYaw = [prevYaw - minCommonRPY, prevYaw + maxCommonRPY];
  
    let relativeX = parseFloat(x) + prevX;
    let relativeY = parseFloat(y) + prevY;
    let relativeZ = parseFloat(z) + prevZ;
    let relativeRoll = parseFloat(roll) + prevRoll;
    let relativePitch = parseFloat(pitch) + prevPitch;
    let relativeYaw = parseFloat(yaw) + prevYaw;
  
    if (relativeX < rangeX[0] || relativeX > rangeX[1]) {
      relativeX = prevX;
    }
    if (relativeY < rangeY[0] || relativeY > rangeY[1]) {
      relativeY = prevY;
    }
    if (relativeZ < rangeZ[0] || relativeZ > rangeZ[1]) {
      relativeZ = prevZ;
    }
    if (relativeRoll < rangeRoll[0] || relativeRoll > rangeRoll[1]) {
      relativeRoll = prevRoll;
    }
    if (relativePitch < rangePitch[0] || relativePitch > rangePitch[1]) {
      relativePitch = prevPitch;
    }
    if (relativeYaw < rangeYaw[0] || relativeYaw > rangeYaw[1]) {
      relativeYaw = prevYaw;
    }
  
    origins.prevX = relativeX;
    origins.prevY = relativeY;
    origins.prevZ = relativeZ;
    origins.prevRoll = relativeRoll;
    origins.prevPitch = relativePitch;
    origins.prevYaw = relativeYaw;
  
    return { relativeX, relativeY, relativeZ, relativeRoll, relativePitch, relativeYaw, origins };
  }

}