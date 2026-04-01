import * as cc from "cc";
cc.Vec3.copy = function (out, a) {
    out.x = a.x || 0;
    out.y = a.y || 0;
    out.z = a.z || 0;
    return out;
}
cc.Vec3.set = function (out, x, y, z) {
    out.x = x || 0;
    out.y = y || 0;
    out.z = z || 0;
    return out;
}