// Math and mapping utilities
function clip(value, range) {
    value = parseFloat(value);
    if (isNaN(value)) value = range[0];
    return Math.max(Math.min(range[0], range[1]), Math.min(value, Math.max(range[0], range[1])));
}

function mapToScale(value, rangeIn, rangeOut, decimals, log, revertlog) {
    value = clip(value, [rangeIn[0], rangeIn[1]]);
    value = (value - rangeIn[0]) / (rangeIn[1] - rangeIn[0]);

    if (log) {
        var logScale = revertlog ? Math.abs(rangeIn[1] - rangeIn[0]) :
            Math.abs(rangeOut[1] - rangeOut[0]);

        if (log !== true && log !== -1) logScale = Math.abs(log);
        else if (logScale >= 100) logScale /= 10;
        else logScale = Math.max(logScale, 10);

        if (log < 0) revertlog = !revertlog;

        value = revertlog ?
            Math.log(value * (logScale - 1) + 1) / Math.log(logScale) :
            Math.pow(logScale, value) / (logScale - 1) - 1 / (logScale - 1);
    }

    value = value * (rangeOut[1] - rangeOut[0]) + rangeOut[0];
    value = clip(value, [rangeOut[0], rangeOut[1]]);
    if (decimals !== -1) value = parseFloat(value.toFixed(decimals));
    return value;
}

// OSC utilities
function oscToEmber(oscBundle) {
    let oscArgs = JSON.stringify(oscBundle.args);
    oscArgs = oscArgs.replace(/\s|\[|\]/g, "");
    oscArgs = JSON.parse(oscArgs);
    oscArgs = oscArgs.value;
    oscArgs = Number(oscArgs);
    return oscArgs;
}

function embChPath(chNumb) {
    let eChPath = 'Channels.Inputs.INP   ';
    eChPath = eChPath.concat(chNumb.toString());
    return eChPath;
}

function pathToAddress(path) {
    return path.replace(/\./g, "/");
}

function addressToPath(address) {
    return address.replace(/\//g, ".");
}

function fromAbsoluteToRelative(data, commonRangeXYZ, commonRangeRPY, origins) {
    let relativeData = {};

    // Translation
    if (data.x !== undefined) relativeData.x = data.x - origins.x;
    if (data.y !== undefined) relativeData.y = data.y - origins.y;
    if (data.z !== undefined) relativeData.z = data.z - origins.z;

    // Rotation
    if (data.roll !== undefined) relativeData.roll = data.roll - origins.roll;
    if (data.pitch !== undefined) relativeData.pitch = data.pitch - origins.pitch;
    if (data.yaw !== undefined) relativeData.yaw = data.yaw - origins.yaw;

    // Map to common range
    if (relativeData.x !== undefined) relativeData.x = mapToScale(relativeData.x, [-1, 1], commonRangeXYZ, 3);
    if (relativeData.y !== undefined) relativeData.y = mapToScale(relativeData.y, [-1, 1], commonRangeXYZ, 3);
    if (relativeData.z !== undefined) relativeData.z = mapToScale(relativeData.z, [-1, 1], commonRangeXYZ, 3);
    if (relativeData.roll !== undefined) relativeData.roll = mapToScale(relativeData.roll, [-1, 1], commonRangeRPY, 3);
    if (relativeData.pitch !== undefined) relativeData.pitch = mapToScale(relativeData.pitch, [-1, 1], commonRangeRPY, 3);
    if (relativeData.yaw !== undefined) relativeData.yaw = mapToScale(relativeData.yaw, [-1, 1], commonRangeRPY, 3);

    return relativeData;
}

module.exports = {
    clip,
    mapToScale,
    oscToEmber,
    embChPath,
    pathToAddress,
    addressToPath,
    fromAbsoluteToRelative
};
