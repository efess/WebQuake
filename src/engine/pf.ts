import * as sv from './sv'
import * as pr from './pr'
import * as con from './console'
import * as ed from './ed'
import * as vec from './vec'
import * as host from './host'
import * as mod from './mod'
import * as cmd from './cmd'
import * as msg from './msg'
import * as cvar from './cvar'
import * as protocol from './protocol'


let checkpvs = null

export const varString = function(first)
{
	var i, out = '';
	for (i = first; i < pr.state.argc; ++i)
		out += pr.getString(pr.state.globals_int[4 + i * 3]);
	return out;
};

export const error = async function()
{
	con.print('======SERVER ERROR in ' + pr.getString(pr.state.xfunction.name) + '\n' + varString(0) + '\n');
	ed.print(sv.state.server.edicts[pr.state.globals_int[pr.globalvars.self]]);
	await host.error('Program error');
};

export const objerror = async function()
{
	con.print('======OBJECT ERROR in ' + pr.getString(pr.state.xfunction.name) + '\n' + varString(0) + '\n');
	ed.print(sv.state.server.edicts[pr.state.globals_int[pr.globalvars.self]]);
	await host.error('Program error');
};

export const makevectors = function()
{
	var forward = [], right = [], up = [];
	vec.angleVectors([pr.state.globals_float[4], pr.state.globals_float[5], pr.state.globals_float[6]], forward, right, up);
	var i;
	for (i = 0; i <= 2; ++i)
	{
		pr.state.globals_float[pr.globalvars.v_forward + i] = forward[i];
		pr.state.globals_float[pr.globalvars.v_right + i] = right[i];
		pr.state.globals_float[pr.globalvars.v_up + i] = up[i];
	}
};

export const setorigin = async function()
{
	var e = sv.state.server.edicts[pr.state.globals_int[4]];
	e.v_float[pr.entvars.origin] = pr.state.globals_float[7];
	e.v_float[pr.entvars.origin1] = pr.state.globals_float[8];
	e.v_float[pr.entvars.origin2] = pr.state.globals_float[9];
	await sv.linkEdict(e);
};

export const setMinMaxSize = async function(e, min, max)
{
	if ((min[0] > max[0]) || (min[1] > max[1]) || (min[2] > max[2]))
		await pr.runError('backwards mins/maxs');
	ed.setVector(e, pr.entvars.mins, min);
	ed.setVector(e, pr.entvars.maxs, max);
	e.v_float[pr.entvars.size] = max[0] - min[0];
	e.v_float[pr.entvars.size1] = max[1] - min[1];
	e.v_float[pr.entvars.size2] = max[2] - min[2];
	await sv.linkEdict(e);
};

export const setsize = function()
{
	setMinMaxSize(sv.state.server.edicts[pr.state.globals_int[4]],
		[pr.state.globals_float[7], pr.state.globals_float[8], pr.state.globals_float[9]],
		[pr.state.globals_float[10], pr.state.globals_float[11], pr.state.globals_float[12]]);
};

export const setmodel = async function()
{
	var e = sv.state.server.edicts[pr.state.globals_int[4]];
	var m = pr.getString(pr.state.globals_int[7]);
	var i;
	for (i = 0; i < sv.state.server.model_precache.length; ++i)
	{
		if (sv.state.server.model_precache[i] === m)
			break;
	}
	if (i === sv.state.server.model_precache.length)
		await pr.runError('no precache: ' + m + '\n');

	e.v_int[pr.entvars.model] = pr.state.globals_int[7];
	e.v_float[pr.entvars.modelindex] = i;
	var mod = sv.state.server.models[i];
	if (mod != null)
		await setMinMaxSize(e, mod.mins, mod.maxs);
	else
		await setMinMaxSize(e, vec.origin, vec.origin);
};

export const bprint = function()
{
	host.broadcastPrint(varString(0));
};

export const sprint = function()
{
	var entnum = pr.state.globals_int[4];
	if ((entnum <= 0) || (entnum > sv.state.svs.maxclients))
	{
		con.print('tried to sprint to a non-client\n');
		return;
	}
	var client = sv.state.svs.clients[entnum - 1];
	msg.writeByte(client.message, protocol.SVC.print);
	msg.writeString(client.message, varString(1));
};

export const centerprint = function()
{
	var entnum = pr.state.globals_int[4];
	if ((entnum <= 0) || (entnum > sv.state.svs.maxclients))
	{
		con.print('tried to sprint to a non-client\n');
		return;
	}
	var client = sv.state.svs.clients[entnum - 1];
	msg.writeByte(client.message, protocol.SVC.centerprint);
	msg.writeString(client.message, varString(1));
};

export const normalize = function()
{
	var newvalue = [pr.state.globals_float[4], pr.state.globals_float[5], pr.state.globals_float[6]];
	vec.normalize(newvalue);
	pr.state.globals_float[1] = newvalue[0];
	pr.state.globals_float[2] = newvalue[1];
	pr.state.globals_float[3] = newvalue[2];
};

export const vlen = function()
{
	pr.state.globals_float[1] = Math.sqrt(pr.state.globals_float[4] * pr.state.globals_float[4] + pr.state.globals_float[5] * pr.state.globals_float[5] + pr.state.globals_float[6] * pr.state.globals_float[6]);
};

export const vectoyaw = function()
{
	var value1 = pr.state.globals_float[4], value2 = pr.state.globals_float[5];
	if ((value1 === 0.0) && (value2 === 0.0))
	{
		pr.state.globals_float[1] = 0.0;
		return;
	}
	var yaw = (Math.atan2(value2, value1) * 180.0 / Math.PI) >> 0;
	if (yaw < 0)
		yaw += 360;
	pr.state.globals_float[1] = yaw;
};

export const vectoangles = function()
{
	pr.state.globals_float[3] = 0.0;
	var value1 = [pr.state.globals_float[4], pr.state.globals_float[5], pr.state.globals_float[6]];
	if ((value1[0] === 0.0) && (value1[1] === 0.0))
	{
		if (value1[2] > 0.0)
			pr.state.globals_float[1] = 90.0;
		else
			pr.state.globals_float[1] = 270.0;
		pr.state.globals_float[2] = 0.0;
		return;
	}

	var yaw = (Math.atan2(value1[1], value1[0]) * 180.0 / Math.PI) >> 0;
	if (yaw < 0)
		yaw += 360;
	var pitch = (Math.atan2(value1[2], Math.sqrt(value1[0] * value1[0] + value1[1] * value1[1])) * 180.0 / Math.PI) >> 0;
	if (pitch < 0)
		pitch += 360;
	pr.state.globals_float[1] = pitch;
	pr.state.globals_float[2] = yaw;
};

export const random = function()
{
	pr.state.globals_float[1] = Math.random();
};

export const particle = function()
{
	sv.startParticle([pr.state.globals_float[4], pr.state.globals_float[5], pr.state.globals_float[6]],
		[pr.state.globals_float[7], pr.state.globals_float[8], pr.state.globals_float[9]],
		pr.state.globals_float[10] >> 0, pr.state.globals_float[13] >> 0);
};

export const ambientsound = function()
{
	var samp = pr.getString(pr.state.globals_int[7]), i;
	for (i = 0; i < sv.state.server.sound_precache.length; ++i)
	{
		if (sv.state.server.sound_precache[i] === samp)
			break;
	}
	if (i === sv.state.server.sound_precache.length)
	{
		con.print('no precache: ' + samp + '\n');
		return;
	}
	var signon = sv.state.server.signon;
	msg.writeByte(signon, protocol.SVC.spawnstaticsound);
	msg.writeCoord(signon, pr.state.globals_float[4]);
	msg.writeCoord(signon, pr.state.globals_float[5]);
	msg.writeCoord(signon, pr.state.globals_float[6]);
	msg.writeByte(signon, i);
	msg.writeByte(signon, pr.state.globals_float[10] * 255.0);
	msg.writeByte(signon, pr.state.globals_float[13] * 64.0);
};

export const sound = async function()
{
	sv.startSound(sv.state.server.edicts[pr.state.globals_int[4]],
		pr.state.globals_float[7] >> 0,
		pr.getString(pr.state.globals_int[10]),
		(pr.state.globals_float[13] * 255.0) >> 0,
		pr.state.globals_float[16]);
};

export const breakstatement = function()
{
	con.print('break statement\n');
};

export const traceline = function()
{
	var trace = sv.move([pr.state.globals_float[4], pr.state.globals_float[5], pr.state.globals_float[6]],
		vec.origin, vec.origin, [pr.state.globals_float[7], pr.state.globals_float[8], pr.state.globals_float[9]],
		pr.state.globals_float[10] >> 0, sv.state.server.edicts[pr.state.globals_int[13]]);
	pr.state.globals_float[pr.globalvars.trace_allsolid] = (trace.allsolid === true) ? 1.0 : 0.0;
	pr.state.globals_float[pr.globalvars.trace_startsolid] = (trace.startsolid === true) ? 1.0 : 0.0;
	pr.state.globals_float[pr.globalvars.trace_fraction] = trace.fraction;
	pr.state.globals_float[pr.globalvars.trace_inwater] = (trace.inwater === true) ? 1.0 : 0.0;
	pr.state.globals_float[pr.globalvars.trace_inopen] = (trace.inopen === true) ? 1.0 : 0.0;
	pr.state.globals_float[pr.globalvars.trace_endpos] = trace.endpos[0];
	pr.state.globals_float[pr.globalvars.trace_endpos1] = trace.endpos[1];
	pr.state.globals_float[pr.globalvars.trace_endpos2] = trace.endpos[2];
	var plane = trace.plane;
	pr.state.globals_float[pr.globalvars.trace_plane_normal] = plane.normal[0];
	pr.state.globals_float[pr.globalvars.trace_plane_normal1] = plane.normal[1];
	pr.state.globals_float[pr.globalvars.trace_plane_normal2] = plane.normal[2];
	pr.state.globals_float[pr.globalvars.trace_plane_dist] = plane.dist;
	pr.state.globals_int[pr.globalvars.trace_ent] = (trace.ent != null) ? trace.ent.num : 0;
};

export const newcheckclient = function(check)
{
	if (check <= 0)
		check = 1;
	else if (check > sv.state.svs.maxclients)
		check = sv.state.svs.maxclients;
	var i = 1;
	if (check !== sv.state.svs.maxclients)
		i += check;
	var ent;
	for (; ; ++i)
	{
		if (i === sv.state.svs.maxclients + 1)
			i = 1;
		ent = sv.state.server.edicts[i];
		if (i === check)
			break;
		if (ent.free === true)
			continue;
		if ((ent.v_float[pr.entvars.health] <= 0.0) || ((ent.v_float[pr.entvars.flags] & sv.FL.notarget) !== 0))
			continue;
		break;
	}
	checkpvs = mod.leafPVS(mod.pointInLeaf([
			ent.v_float[pr.entvars.origin] + ent.v_float[pr.entvars.view_ofs],
			ent.v_float[pr.entvars.origin1] + ent.v_float[pr.entvars.view_ofs1],
			ent.v_float[pr.entvars.origin2] + ent.v_float[pr.entvars.view_ofs2]
		], sv.state.server.worldmodel), sv.state.server.worldmodel);
	return i;
};

export const checkclient = function()
{
	if ((sv.state.server.time - sv.state.server.lastchecktime) >= 0.1)
	{
		sv.state.server.lastcheck = newcheckclient(sv.state.server.lastcheck);
		sv.state.server.lastchecktime = sv.state.server.time;
	}
	var ent = sv.state.server.edicts[sv.state.server.lastcheck];
	if ((ent.free === true) || (ent.v_float[pr.entvars.health] <= 0.0))
	{
		pr.state.globals_int[1] = 0;
		return;
	}
	var self = sv.state.server.edicts[pr.state.globals_int[pr.globalvars.self]];
	var l = mod.pointInLeaf([
			self.v_float[pr.entvars.origin] + self.v_float[pr.entvars.view_ofs],
			self.v_float[pr.entvars.origin1] + self.v_float[pr.entvars.view_ofs1],
			self.v_float[pr.entvars.origin2] + self.v_float[pr.entvars.view_ofs2]
		], sv.state.server.worldmodel).num - 1;
	if ((l < 0) || ((checkpvs[l >> 3] & (1 << (l & 7))) === 0))
	{
		pr.state.globals_int[1] = 0;
		return;
	}
	pr.state.globals_int[1] = ent.num;
};

export const stuffcmd = async function()
{
	var entnum = pr.state.globals_int[4];
	if ((entnum <= 0) || (entnum > sv.state.svs.maxclients))
		await pr.runError('Parm 0 not a client');
	var client = sv.state.svs.clients[entnum - 1];
	msg.writeByte(client.message, protocol.SVC.stufftext);
	msg.writeString(client.message, pr.getString(pr.state.globals_int[7]));
};

export const localcmd = function()
{
	cmd.state.text += pr.getString(pr.state.globals_int[4]);
};

export const cvar_get = function()
{
	var v = cvar.findVar(pr.getString(pr.state.globals_int[4]));
	pr.state.globals_float[1] = v != null ? v.value : 0.0;
};

export const cvar_set = function()
{
	cvar.set(pr.getString(pr.state.globals_int[4]), pr.getString(pr.state.globals_int[7]));
};

export const findradius = function()
{
	var chain = 0;
	var org = [pr.state.globals_float[4], pr.state.globals_float[5], pr.state.globals_float[6]], eorg = [];
	var rad = pr.state.globals_float[7];
	var i, ent;
	for (i = 1; i < sv.state.server.num_edicts; ++i)
	{
		ent = sv.state.server.edicts[i];
		if (ent.free === true)
			continue;
		if (ent.v_float[pr.entvars.solid] === sv.SOLID.not)
			continue;
		eorg[0] = org[0] - (ent.v_float[pr.entvars.origin] + (ent.v_float[pr.entvars.mins] + ent.v_float[pr.entvars.maxs]) * 0.5);
		eorg[1] = org[1] - (ent.v_float[pr.entvars.origin1] + (ent.v_float[pr.entvars.mins1] + ent.v_float[pr.entvars.maxs1]) * 0.5);
		eorg[2] = org[2] - (ent.v_float[pr.entvars.origin2] + (ent.v_float[pr.entvars.mins2] + ent.v_float[pr.entvars.maxs2]) * 0.5);
		if (Math.sqrt(eorg[0] * eorg[0] + eorg[1] * eorg[1] + eorg[2] * eorg[2]) > rad)
			continue;
		ent.v_int[pr.entvars.chain] = chain;
		chain = i;
	}
	pr.state.globals_int[1] = chain;
};

export const dprint = function()
{
	con.dPrint(varString(0));
};

export const ftos = function()
{
	var v = pr.state.globals_float[4];
	if (v === Math.floor(v))
		pr.tempString(v.toString());
	else
		pr.tempString(v.toFixed(1));
	pr.state.globals_int[1] = pr.state.string_temp;
};

export const fabs = function()
{
	pr.state.globals_float[1] = Math.abs(pr.state.globals_float[4]);
};

export const vtos = function()
{
	pr.tempString(pr.state.globals_float[4].toFixed(1)
		+ ' ' + pr.state.globals_float[5].toFixed(1)
		+ ' ' + pr.state.globals_float[6].toFixed(1));
	pr.state.globals_int[1] = pr.state.string_temp;
};

export const spawn = function()
{
	pr.state.globals_int[1] = ed.alloc().num;
};

export const remove = function()
{
	ed.free(sv.state.server.edicts[pr.state.globals_int[4]]);
};

export const find = function()
{
	var e = pr.state.globals_int[4];
	var f = pr.state.globals_int[7];
	var s = pr.getString(pr.state.globals_int[10]);
	var ed;
	for (++e; e < sv.state.server.num_edicts; ++e)
	{
		ed = sv.state.server.edicts[e];
		if (ed.free === true)
			continue;
		if (pr.getString(ed.v_int[f]) === s)
		{
			pr.state.globals_int[1] = ed.num;
			return;
		}
	}
	pr.state.globals_int[1] = 0;
};

export const moveToGoal = async function()
{
	var ent = sv.state.server.edicts[pr.state.globals_int[pr.globalvars.self]];
	if ((ent.v_float[pr.entvars.flags] & (sv.FL.onground + sv.FL.fly + sv.FL.swim)) === 0)
	{
		pr.state.globals_float[1] = 0.0;
		return;
	}
	var goal = sv.state.server.edicts[ent.v_int[pr.entvars.goalentity]];
	var dist = pr.state.globals_float[4];
	if ((ent.v_int[pr.entvars.enemy] !== 0) && (sv.closeEnough(ent, goal, dist) === true))
		return;
	if ((Math.random() >= 0.75) || (await sv.stepDirection(ent, ent.v_float[pr.entvars.ideal_yaw], dist) !== true))
		await sv.newChaseDir(ent, goal, dist);
};

export const precache_file = function()
{
	pr.state.globals_int[1] = pr.state.globals_int[4];
};

export const precache_sound = async function()
{
	var s = pr.getString(pr.state.globals_int[4]);
	pr.state.globals_int[1] = pr.state.globals_int[4];
	await pr.checkEmptyString(s);
	var i;
	for (i = 0; i < sv.state.server.sound_precache.length; ++i)
	{
		if (sv.state.server.sound_precache[i] === s)
			return;
	}
	sv.state.server.sound_precache[i] = s;
};

export const precache_model = async function()
{
	if (sv.state.server.loading !== true)
		await pr.runError('PF.Precache_*: Precache can only be done in spawn functions');
	var s = pr.getString(pr.state.globals_int[4]);
	pr.state.globals_int[1] = pr.state.globals_int[4];
	await pr.checkEmptyString(s);
	var i;
	for (i = 0; i < sv.state.server.model_precache.length; ++i)
	{
		if (sv.state.server.model_precache[i] === s)
			return;
	}
	sv.state.server.model_precache[i] = s;
	sv.state.server.models[i] = await mod.forName(s, true);
};

export const coredump = function()
{
	ed.printEdicts();
};

export const traceon = function()
{
	pr.state.trace = true;
};

export const traceoff = function()
{
	pr.state.trace = false;
};

export const eprint = function()
{
	ed.print(sv.state.server.edicts[pr.state.globals_float[4]]);
};

export const walkmove = async function()
{
	var ent = sv.state.server.edicts[pr.state.globals_int[pr.globalvars.self]];
	if ((ent.v_float[pr.entvars.flags] & (sv.FL.onground + sv.FL.fly + sv.FL.swim)) === 0)
	{
		pr.state.globals_float[1] = 0.0;
		return;
	}
	var yaw = pr.state.globals_float[4] * Math.PI / 180.0;
	var dist = pr.state.globals_float[7];
	var oldf = pr.state.xfunction;
	pr.state.globals_float[1] = await sv.movestep(ent, [Math.cos(yaw) * dist, Math.sin(yaw) * dist], true);
	pr.state.xfunction = oldf;
	pr.state.globals_int[pr.globalvars.self] = ent.num;
};

export const droptofloor = async function()
{
	var ent = sv.state.server.edicts[pr.state.globals_int[pr.globalvars.self]];
	var trace = sv.move(ed.vector(ent, pr.entvars.origin),
		ed.vector(ent, pr.entvars.mins), ed.vector(ent, pr.entvars.maxs),
		[ent.v_float[pr.entvars.origin], ent.v_float[pr.entvars.origin1], ent.v_float[pr.entvars.origin2] - 256.0], 0, ent);
	if ((trace.fraction === 1.0) || (trace.allsolid === true))
	{
		pr.state.globals_float[1] = 0.0;
		return;
	}
	ed.setVector(ent, pr.entvars.origin, trace.endpos);
	await sv.linkEdict(ent);
	ent.v_float[pr.entvars.flags] |= sv.FL.onground;
	ent.v_int[pr.entvars.groundentity] = trace.ent.num;
	pr.state.globals_float[1] = 1.0;
};

export const lightstyle = function()
{
	var style = pr.state.globals_float[4] >> 0;
	var val = pr.getString(pr.state.globals_int[7]);
	sv.state.server.lightstyles[style] = val;
	if (sv.state.server.loading === true)
		return;
	var i, client;
	for (i = 0; i < sv.state.svs.maxclients; ++i)
	{
		client = sv.state.svs.clients[i];
		if ((client.active !== true) && (client.spawned !== true))
			continue;
		msg.writeByte(client.message, protocol.SVC.lightstyle);
		msg.writeByte(client.message, style);
		msg.writeString(client.message, val);
	}
};

export const rint = function()
{
	var f = pr.state.globals_float[4];
	pr.state.globals_float[1] = (f >= 0.0 ? f + 0.5 : f - 0.5) >> 0;
};

export const floor = function()
{
	pr.state.globals_float[1] = Math.floor(pr.state.globals_float[4]);
};

export const ceil = function()
{
	pr.state.globals_float[1] = Math.ceil(pr.state.globals_float[4]);
};

export const checkbottom = function()
{
	pr.state.globals_float[1] = sv.checkBottom(sv.state.server.edicts[pr.state.globals_int[4]]);
};

export const pointcontents = function()
{
	pr.state.globals_float[1] = sv.pointContents([pr.state.globals_float[4], pr.state.globals_float[5], pr.state.globals_float[6]]);
};

export const nextent = function()
{
	var i;
	for (i = pr.state.globals_int[4] + 1; i < sv.state.server.num_edicts; ++i)
	{
		if (sv.state.server.edicts[i].free !== true)
		{
			pr.state.globals_int[1] = i;
			return;
		}
	}
	pr.state.globals_int[1] = 0;
};

export const aim = function()
{
	var ent = sv.state.server.edicts[pr.state.globals_int[4]];
	var start = [ent.v_float[pr.entvars.origin], ent.v_float[pr.entvars.origin1], ent.v_float[pr.entvars.origin2] + 20.0];
	var dir = [pr.state.globals_float[pr.globalvars.v_forward], pr.state.globals_float[pr.globalvars.v_forward1], pr.state.globals_float[pr.globalvars.v_forward2]];
	var end = [start[0] + 2048.0 * dir[0], start[1] + 2048.0 * dir[1], start[2] + 2048.0 * dir[2]];
	var tr = sv.move(start, vec.origin, vec.origin, end, 0, ent);
	if (tr.ent != null)
	{
		if ((tr.ent.v_float[pr.entvars.takedamage] === sv.DAMAGE.aim) &&
			((host.cvr.teamplay.value === 0) || (ent.v_float[pr.entvars.team] <= 0) ||
			(ent.v_float[pr.entvars.team] !== tr.ent.v_float[pr.entvars.team])))
		{
			pr.state.globals_float[1] = dir[0];
			pr.state.globals_float[2] = dir[1];
			pr.state.globals_float[3] = dir[2];
			return;
		}
	}
	var bestdir = [dir[0], dir[1], dir[2]];
	var bestdist = sv.cvr.aim.value;
	var bestent, i, check, dist, end = [];
	for (i = 1; i < sv.state.server.num_edicts; ++i)
	{
		check = sv.state.server.edicts[i];
		if (check.v_float[pr.entvars.takedamage] !== sv.DAMAGE.aim)
			continue;
		if (check === ent)
			continue;
		if ((host.cvr.teamplay.value !== 0) && (ent.v_float[pr.entvars.team] > 0) && (ent.v_float[pr.entvars.team] === check.v_float[pr.entvars.team]))
			continue;
		end[0] = check.v_float[pr.entvars.origin] + 0.5 * (check.v_float[pr.entvars.mins] + check.v_float[pr.entvars.maxs]);
		end[1] = check.v_float[pr.entvars.origin1] + 0.5 * (check.v_float[pr.entvars.mins1] + check.v_float[pr.entvars.maxs1]);
		end[2] = check.v_float[pr.entvars.origin2] + 0.5 * (check.v_float[pr.entvars.mins2] + check.v_float[pr.entvars.maxs2]);
		dir[0] = end[0] - start[0];
		dir[1] = end[1] - start[1];
		dir[2] = end[2] - start[2];
		vec.normalize(dir);
		dist = dir[0] * bestdir[0] + dir[1] * bestdir[1] + dir[2] * bestdir[2];
		if (dist < bestdist)
			continue;
		tr = sv.move(start, vec.origin, vec.origin, end, 0, ent);
		if (tr.ent === check)
		{
			bestdist = dist;
			bestent = check;
		}
	}
	if (bestent != null)
	{
		dir[0] = bestent.v_float[pr.entvars.origin] - ent.v_float[pr.entvars.origin];
		dir[1] = bestent.v_float[pr.entvars.origin1] - ent.v_float[pr.entvars.origin1];
		dir[2] = bestent.v_float[pr.entvars.origin2] - ent.v_float[pr.entvars.origin2];
		dist = dir[0] * bestdir[0] + dir[1] * bestdir[1] + dir[2] * bestdir[2];
		end[0] = bestdir[0] * dist;
		end[1] = bestdir[1] * dist;
		end[2] = dir[2];
		vec.normalize(end);
		pr.state.globals_float[1] = end[0];
		pr.state.globals_float[2] = end[1];
		pr.state.globals_float[3] = end[2];
		return;
	}
	pr.state.globals_float[1] = bestdir[0];
	pr.state.globals_float[2] = bestdir[1];
	pr.state.globals_float[3] = bestdir[2];
};

export const changeyaw = function()
{
	var ent = sv.state.server.edicts[pr.state.globals_int[pr.globalvars.self]];
	var current = vec.anglemod(ent.v_float[pr.entvars.angles1]);
	var ideal = ent.v_float[pr.entvars.ideal_yaw];
	if (current === ideal)
		return;
	var move = ideal - current;
	if (ideal > current)
	{
		if (move >= 180.0)
			move -= 360.0;
	}
	else if (move <= -180.0)
		move += 360.0;
	var speed = ent.v_float[pr.entvars.yaw_speed];
	if (move > 0.0)
	{
		if (move > speed)
			move = speed;
	}
	else if (move < -speed)
		move = -speed;
	ent.v_float[pr.entvars.angles1] = vec.anglemod(current + move);
};

export const writeDest = async function()
{
	switch (pr.state.globals_float[4] >> 0)
	{
	case 0: // broadcast
		return sv.state.server.datagram;
	case 1: // one
		var entnum = pr.state.globals_int[pr.globalvars.msg_entity];
		if ((entnum <= 0) || (entnum > sv.state.svs.maxclients))
			await pr.runError('WriteDest: not a client');
		return sv.state.svs.clients[entnum - 1].message;
	case 2: // all
		return sv.state.server.reliable_datagram;
	case 3: // init
		return sv.state.server.signon;
	}
	await pr.runError('WriteDest: bad destination');
};

export const writeByte = async function() {msg.writeByte(await writeDest(), pr.state.globals_float[7]);};
export const writeChar = async function() {msg.writeChar(await writeDest(), pr.state.globals_float[7]);};
export const writeShort = async function() {msg.writeShort(await writeDest(), pr.state.globals_float[7]);};
export const writeLong = async function() {msg.writeLong(await writeDest(), pr.state.globals_float[7]);};
export const writeAngle = async function() {msg.writeAngle(await writeDest(), pr.state.globals_float[7]);};
export const writeCoord = async function() {msg.writeCoord(await writeDest(), pr.state.globals_float[7]);};
export const writeString = async function() {msg.writeString(await writeDest(), pr.getString(pr.state.globals_int[7]));};
export const writeEntity = async function() {msg.writeShort(await writeDest(), pr.state.globals_int[7]);};

export const makestatic = function()
{
	var ent = sv.state.server.edicts[pr.state.globals_int[4]];
	var message = sv.state.server.signon;
	msg.writeByte(message, protocol.SVC.spawnstatic);
	msg.writeByte(message, sv.modelIndex(pr.getString(ent.v_int[pr.entvars.model])));
	msg.writeByte(message, ent.v_float[pr.entvars.frame]);
	msg.writeByte(message, ent.v_float[pr.entvars.colormap]);
	msg.writeByte(message, ent.v_float[pr.entvars.skin]);
	msg.writeCoord(message, ent.v_float[pr.entvars.origin]);
	msg.writeAngle(message, ent.v_float[pr.entvars.angles]);
	msg.writeCoord(message, ent.v_float[pr.entvars.origin1]);
	msg.writeAngle(message, ent.v_float[pr.entvars.angles1]);
	msg.writeCoord(message, ent.v_float[pr.entvars.origin2]);
	msg.writeAngle(message, ent.v_float[pr.entvars.angles2]);
	ed.free(ent);
};

export const setspawnparms = async function()
{
	var i = pr.state.globals_int[4];
	if ((i <= 0) || (i > sv.state.svs.maxclients))
		await pr.runError('Entity is not a client');
	var spawn_parms = sv.state.svs.clients[i - 1].spawn_parms;
	for (i = 0; i <= 15; ++i)
		pr.state.globals_float[pr.globalvars.parms + i] = spawn_parms[i];
};

export const changelevel = function()
{
	if (sv.state.svs.changelevel_issued === true)
		return;
	sv.state.svs.changelevel_issued = true;
	cmd.state.text += 'changelevel ' + pr.getString(pr.state.globals_int[4]) + '\n';
};

export const fixme = async function()
{
	await pr.runError('unimplemented builtin');
};

export const builtin = [
	fixme,
	makevectors,
	setorigin,
	setmodel,
	setsize,
	fixme,
	breakstatement,
	random,
	sound,
	normalize,
	error,
	objerror,
	vlen,
	vectoyaw,
	spawn,
	remove,
	traceline,
	checkclient,
	find,
	precache_sound,
	precache_model,
	stuffcmd,
	findradius,
	bprint,
	sprint,
	dprint,
	ftos,
	vtos,
	coredump,
	traceon,
	traceoff,
	eprint,
	walkmove,
	fixme,
	droptofloor,
	lightstyle,
	rint,
	floor,
	ceil,
	fixme,
	checkbottom,
	pointcontents,
	fixme,
	fabs,
	aim,
	cvar_get,
	localcmd,
	nextent,
	particle,
	changeyaw,
	fixme,
	vectoangles,
	writeByte,
	writeChar,
	writeShort,
	writeLong,
	writeCoord,
	writeAngle,
	writeString,
	writeEntity,
	fixme,
	fixme,
	fixme,
	fixme,
	fixme,
	fixme,
	fixme,
	moveToGoal,
	precache_file,
	makestatic,
	changelevel,
	fixme,
	cvar_set,
	centerprint,
	ambientsound,
	precache_model,
	precache_sound,
	precache_file,
	setspawnparms
];