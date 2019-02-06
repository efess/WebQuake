import * as cl from './cl'
import * as sv from './sv'
import * as r from './r'
import * as vec from './vec'
import * as cvar from './cvar'

export const cvr = {

} as any

export const init = function()
{
  cvr.back = cvar.registerVariable('chase_back', '100');
  cvr.up = cvar.registerVariable('chase_up', '16');
  cvr.right = cvar.registerVariable('chase_right', '0');
  cvr.active = cvar.registerVariable('chase_active', '0');
};

export const update = function()
{
  var forward = [], right = [];
  vec.angleVectors(cl.clState.viewangles, forward, right);
  var trace = {plane: {}} as any, org = r.state.refdef.vieworg;
  sv.recursiveHullCheck(cl.clState.worldmodel.hulls[0], 0, 0.0, 1.0, org, [
    org[0] + 4096.0 * forward[0],
    org[1] + 4096.0 * forward[1],
    org[2] + 4096.0 * forward[2]], trace);
  var stop = trace.endpos;
  stop[2] -= org[2];
  var dist = (stop[0] - org[0]) * forward[0] + (stop[1] - org[1]) * forward[1] + stop[2] * forward[2];
  if (dist < 1.0)
    dist = 1.0;
  r.state.refdef.viewangles[0] = Math.atan(stop[2] / dist) / Math.PI * -180.0;
  org[0] -= forward[0] * cvr.back.value + right[0] * cvr.right.value;
  org[1] -= forward[1] * cvr.back.value + right[1] * cvr.right.value;
  org[2] += cvr.up.value;
};