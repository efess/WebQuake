import * as host from './host'
import * as pr from './pr'
import * as mod from './mod'
import * as msg from './msg'
import * as sys from './sys'
import * as con from './console'
import * as cvar from './cvar'
import * as com from './com'
import * as protocol from './protocol'
import * as def from './def'
import * as cmd from './cmd'
import * as net from './net'
import * as scr from './scr'
import * as ed from './ed'
import * as q from './q'
import * as vec from './vec'
import * as sz from './sz'
import * as v from './v'
import * as pf from './pf'

export let state = {
  fatpvs: [],
  fatbytes: 0,
  clientdatagram: {data: new ArrayBuffer(1024), cursize: 0},
  server: {
    num_edicts: 0,
    datagram: {data: new ArrayBuffer(1024), cursize: 0},
    reliable_datagram: {data: new ArrayBuffer(1024), cursize: 0},
    signon: {data: new ArrayBuffer(8192), cursize: 0},
    active: false,
    loading: false
  },
  nop: {
    data: new ArrayBuffer(4),
    cursize: 1
  },
	reconnect: {
    data: new ArrayBuffer(128),
    cursize: 0
  },
  svs: {}
} as any;

export const cvr = {
} as any;

export const MOVE_TYPE = {
	none: 0,
	anglenoclip: 1,
	angleclip: 2,
	walk: 3,
	step: 4,
	fly: 5,
	toss: 6,
	push: 7,
	noclip: 8,
	flymissile: 9,
	bounce: 10
};

export const SOLID = {
	not: 0,
	trigger: 1,
	bbox: 2,
	slidebox: 3,
	bsp: 4
};

export const DAMAGE = {
	no: 0,
	yes: 1,
	aim: 2
};

export const FL = {
	fly: 1,
	swim: 2,
	conveyor: 4,
	client: 8,
	inwater: 16,
	monster: 32,
	godmode: 64,
	notarget: 128,
	item: 256,
	onground: 512,
	partialground: 1024,
	waterjump: 2048,
	jumpreleased: 4096
};

const initState = () => {
	state = {
		fatpvs: [],
		fatbytes: 0,
		clientdatagram: {data: new ArrayBuffer(1024), cursize: 0},
		server: {
			num_edicts: 0,
			datagram: {data: new ArrayBuffer(1024), cursize: 0},
			reliable_datagram: {data: new ArrayBuffer(1024), cursize: 0},
			signon: {data: new ArrayBuffer(8192), cursize: 0},
			active: false,
			loading: false
		},
		nop: {
			data: new ArrayBuffer(4),
			cursize: 1
		},
		reconnect: {
			data: new ArrayBuffer(128),
			cursize: 0
		},
		svs: {}
	} as any;
}
// main

export const startParticle = function(org, dir, color, count)
{
	var datagram = state.server.datagram;
	if (datagram.cursize >= 1009)
		return;
	msg.writeByte(datagram, protocol.SVC.particle);
	msg.writeCoord(datagram, org[0]);
	msg.writeCoord(datagram, org[1]);
	msg.writeCoord(datagram, org[2]);
	var i, v;
	for (i = 0; i <= 2; ++i)
	{
		v = (dir[i] * 16.0) >> 0;
		if (v > 127)
			v = 127;
		else if (v < -128)
			v = -128;
		msg.writeChar(datagram, v);
	}
	msg.writeByte(datagram, count);
	msg.writeByte(datagram, color);
};

export const startSound = function(entity, channel, sample, volume, attenuation)
{
	if ((volume < 0) || (volume > 255))
		sys.error('SV.StartSound: volume = ' + volume);
	if ((attenuation < 0.0) || (attenuation > 4.0))
		sys.error('SV.StartSound: attenuation = ' + attenuation);
	if ((channel < 0) || (channel > 7))
		sys.error('SV.StartSound: channel = ' + channel);

	var datagram = state.server.datagram;
	if (datagram.cursize >= 1009)
		return;

	var i;
	for (i = 1; i < state.server.sound_precache.length; ++i)
	{
		if (sample === state.server.sound_precache[i])
			break;
	}
	if (i >= state.server.sound_precache.length)
	{
		con.print('SV.StartSound: ' + sample + ' not precached\n');
		return;
	}

	var field_mask = 0;
	if (volume !== 255)
		field_mask += 1;
	if (attenuation !== 1.0)
		field_mask += 2;

	msg.writeByte(datagram, protocol.SVC.sound);
	msg.writeByte(datagram, field_mask);
	if ((field_mask & 1) !== 0)
		msg.writeByte(datagram, volume);
	if ((field_mask & 2) !== 0)
		msg.writeByte(datagram, Math.floor(attenuation * 64.0));
	msg.writeShort(datagram, (entity.num << 3) + channel);
	msg.writeByte(datagram, i);
	msg.writeCoord(datagram, entity.v_float[pr.entvars.origin] + 0.5 *
		(entity.v_float[pr.entvars.mins] + entity.v_float[pr.entvars.maxs]));
	msg.writeCoord(datagram, entity.v_float[pr.entvars.origin1] + 0.5 *
		(entity.v_float[pr.entvars.mins1] + entity.v_float[pr.entvars.maxs1]));
	msg.writeCoord(datagram, entity.v_float[pr.entvars.origin2] + 0.5 *
		(entity.v_float[pr.entvars.mins2] + entity.v_float[pr.entvars.maxs2]));
};

const sendServerinfo = function(client)
{
	var message = client.message;
	msg.writeByte(message, protocol.SVC.print);
	msg.writeString(message, '\x02\nVERSION 1.09 SERVER (' + pr.state.crc + ' CRC)');
	msg.writeByte(message, protocol.SVC.serverinfo);
	msg.writeLong(message, protocol.version);
	msg.writeByte(message, state.svs.maxclients);
	msg.writeByte(message, ((host.cvr.coop.value === 0) && (host.cvr.deathmatch.value !== 0)) ? 1 : 0);
	msg.writeString(message, pr.getString(state.server.edicts[0].v_int[pr.entvars.message]));
	var i;
	for (i = 1; i < state.server.model_precache.length; ++i)
		msg.writeString(message, state.server.model_precache[i]);
	msg.writeByte(message, 0);
	for (i = 1; i < state.server.sound_precache.length; ++i)
		msg.writeString(message, state.server.sound_precache[i]);
	msg.writeByte(message, 0);
	msg.writeByte(message, protocol.SVC.cdtrack);
	msg.writeByte(message, state.server.edicts[0].v_float[pr.entvars.sounds]);
	msg.writeByte(message, state.server.edicts[0].v_float[pr.entvars.sounds]);
	msg.writeByte(message, protocol.SVC.setview);
	msg.writeShort(message, client.edict.num);
	msg.writeByte(message, protocol.SVC.signonnum);
	msg.writeByte(message, 1);
	client.sendsignon = true;
	client.spawned = false;
};

const connectClient = async function(clientnum: number)
{
	var client = state.svs.clients[clientnum];
	var i, spawn_parms;
	if (state.server.loadgame === true)
	{
		spawn_parms = [];
		if (client.spawn_parms == null)
		{
			client.spawn_parms = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
				0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
		}
		for (i = 0; i <= 15; ++i)
			spawn_parms[i] = client.spawn_parms[i];
	}
	con.dPrint('Client ' + client.netconnection.address + ' connected\n');
	client.active = true;
	client.dropasap = false;
	client.last_message = 0.0;
	client.cmd = {forwardmove: 0.0, sidemove: 0.0, upmove: 0.0};
	client.wishdir = [0.0, 0.0, 0.0];
	client.message.cursize = 0;
	client.edict = state.server.edicts[clientnum + 1];
	client.edict.v_int[pr.entvars.netname] = pr.state.netnames + (clientnum << 5);
	setClientName(client, 'unconnected');
	client.colors = 0;
	client.ping_times = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
		0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
	client.num_pings = 0;
	if (state.server.loadgame !== true)
	{
		client.spawn_parms = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
			0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
	}
	client.old_frags = 0;
	if (state.server.loadgame === true)
	{
		for (i = 0; i <= 15; ++i)
			client.spawn_parms[i] = spawn_parms[i];
	}
	else
	{
		await pr.executeProgram(pr.state.globals_int[pr.globalvars.SetNewParms]);
		for (i = 0; i <= 15; ++i)
			client.spawn_parms[i] = pr.state.globals_float[pr.globalvars.parms + i];
	}
	sendServerinfo(client);
};

const addToFatPVS = function(org, node)
{
	var pvs, i, normal, d;
	for (;;)
	{
		if (node.contents < 0)
		{
			if (node.contents !== mod.CONTENTS.solid)
			{
				pvs = mod.leafPVS(node, state.server.worldmodel);
				for (i = 0; i < state.fatbytes; ++i)
					state.fatpvs[i] |= pvs[i];
			}
			return;
		}
		normal = node.plane.normal;
		d = org[0] * normal[0] + org[1] * normal[1] + org[2] * normal[2] - node.plane.dist;
		if (d > 8.0)
			node = node.children[0];
		else
		{
			if (d >= -8.0)
				addToFatPVS(org, node.children[0]);
			node = node.children[1];
		}
	}
};

const fatPVS = function(org)
{
	state.fatbytes = (state.server.worldmodel.leafs.length + 31) >> 3;
	var i;
	for (i = 0; i < state.fatbytes; ++i)
		state.fatpvs[i] = 0;
	addToFatPVS(org, state.server.worldmodel.nodes[0]);
};

const writeEntitiesToClient = function(clent, message)
{
	fatPVS([
		clent.v_float[pr.entvars.origin] + clent.v_float[pr.entvars.view_ofs],
		clent.v_float[pr.entvars.origin1] + clent.v_float[pr.entvars.view_ofs1],
		clent.v_float[pr.entvars.origin2] + clent.v_float[pr.entvars.view_ofs2]
	]);
	var pvs = state.fatpvs, ent, e, i, bits, miss;
	for (e = 1; e < state.server.num_edicts; ++e)
	{
		ent = state.server.edicts[e];
		if (ent !== clent)
		{
			if ((ent.v_float[pr.entvars.modelindex] === 0.0) || (pr.state.strings[ent.v_int[pr.entvars.model]] === 0))
				continue;
			for (i = 0; i < ent.leafnums.length; ++i)
			{
				if ((pvs[ent.leafnums[i] >> 3] & (1 << (ent.leafnums[i] & 7))) !== 0)
					break;
			}
			if (i === ent.leafnums.length)
				continue;
		}
		if ((message.data.byteLength - message.cursize) < 16)
		{
			con.print('packet overflow\n');
			return;
		}

		bits = 0;
		for (i = 0; i <= 2; ++i)
		{
			miss = ent.v_float[pr.entvars.origin + i] - ent.baseline.origin[i];
			if ((miss < -0.1) || (miss > 0.1))
				bits += protocol.U.origin1 << i;
		}
		if (ent.v_float[pr.entvars.angles] !== ent.baseline.angles[0])
			bits += protocol.U.angle1;
		if (ent.v_float[pr.entvars.angles1] !== ent.baseline.angles[1])
			bits += protocol.U.angle2;
		if (ent.v_float[pr.entvars.angles2] !== ent.baseline.angles[2])
			bits += protocol.U.angle3;
		if (ent.v_float[pr.entvars.movetype] === MOVE_TYPE.step)
			bits += protocol.U.nolerp;
		if (ent.baseline.colormap !== ent.v_float[pr.entvars.colormap])
			bits += protocol.U.colormap;
		if (ent.baseline.skin !== ent.v_float[pr.entvars.skin])
			bits += protocol.U.skin;
		if (ent.baseline.frame !== ent.v_float[pr.entvars.frame])
			bits += protocol.U.frame;
		if (ent.baseline.effects !== ent.v_float[pr.entvars.effects])
			bits += protocol.U.effects;
		if (ent.baseline.modelindex !== ent.v_float[pr.entvars.modelindex])
			bits += protocol.U.model;
		if (e >= 256)
			bits += protocol.U.longentity;
		if (bits >= 256)
			bits += protocol.U.morebits;

		msg.writeByte(message, bits + protocol.U.signal);
		if ((bits & protocol.U.morebits) !== 0)
			msg.writeByte(message, bits >> 8);
		if ((bits & protocol.U.longentity) !== 0)
			msg.writeShort(message, e);
		else
			msg.writeByte(message, e);
		if ((bits & protocol.U.model) !== 0)
			msg.writeByte(message, ent.v_float[pr.entvars.modelindex]);
		if ((bits & protocol.U.frame) !== 0)
			msg.writeByte(message, ent.v_float[pr.entvars.frame]);
		if ((bits & protocol.U.colormap) !== 0)
			msg.writeByte(message, ent.v_float[pr.entvars.colormap]);
		if ((bits & protocol.U.skin) !== 0)
			msg.writeByte(message, ent.v_float[pr.entvars.skin]);
		if ((bits & protocol.U.effects) !== 0)
			msg.writeByte(message, ent.v_float[pr.entvars.effects]);
		if ((bits & protocol.U.origin1) !== 0)
			msg.writeCoord(message, ent.v_float[pr.entvars.origin]);
		if ((bits & protocol.U.angle1) !== 0)
			msg.writeAngle(message, ent.v_float[pr.entvars.angles]);
		if ((bits & protocol.U.origin2) !== 0)
			msg.writeCoord(message, ent.v_float[pr.entvars.origin1]);
		if ((bits & protocol.U.angle2) !== 0)
			msg.writeAngle(message, ent.v_float[pr.entvars.angles1]);
		if ((bits & protocol.U.origin3) !== 0)
			msg.writeCoord(message, ent.v_float[pr.entvars.origin2]);
		if ((bits & protocol.U.angle3) !== 0)
			msg.writeAngle(message, ent.v_float[pr.entvars.angles2]);
	}
};


const sendClientDatagram = async function()
{
	var client = host.state.client;
	var message = state.clientdatagram;
	message.cursize = 0;
	msg.writeByte(message, protocol.SVC.time);
	msg.writeFloat(message, state.server.time);
	writeClientdataToMessage(client.edict, message);
	writeEntitiesToClient(client.edict, message);
	if ((message.cursize + state.server.datagram.cursize) < message.data.byteLength)
		sz.write(message, new Uint8Array(state.server.datagram.data), state.server.datagram.cursize);
	if (net.sendUnreliableMessage(client.netconnection, message) === -1)
	{
		await host.dropClient(true);
		return;
	}
	return true;
};

const updateToReliableMessages = function()
{
	var i, frags, j, client;

	for (i = 0; i < state.svs.maxclients; ++i)
	{
		host.state.client = state.svs.clients[i];
		host.state.client.edict.v_float[pr.entvars.frags] >>= 0;
		frags = host.state.client.edict.v_float[pr.entvars.frags];
		if (host.state.client.old_frags === frags)
			continue;
		for (j = 0; j < state.svs.maxclients; ++j)
		{
			client = state.svs.clients[j];
			if (client.active !== true)
				continue;
			msg.writeByte(client.message, protocol.SVC.updatefrags);
			msg.writeByte(client.message, i);
			msg.writeShort(client.message, frags);
		}
		host.state.client.old_frags = frags;
	}

	for (i = 0; i < state.svs.maxclients; ++i)
	{
		client = state.svs.clients[i];
		if (client.active === true)
			sz.write(client.message, new Uint8Array(state.server.reliable_datagram.data), state.server.reliable_datagram.cursize);
	}

	state.server.reliable_datagram.cursize = 0;
};

export const modelIndex = function(name)
{
	if (name == null)
		return 0;
	if (name.length === 0)
		return 0;
	var i;
	for (i = 0; i < state.server.model_precache.length; ++i)
	{
		if (state.server.model_precache[i] === name)
			return i;
	}
	sys.error('SV.ModelIndex: model ' + name + ' not precached');
};

const createBaseline = function()
{
	var i, svent, baseline;
	var player = modelIndex('progs/player.mdl');
	var signon = state.server.signon;
	for (i = 0; i < state.server.num_edicts; ++i)
	{
		svent = state.server.edicts[i];
		if (svent.free === true)
			continue;
		if ((i > state.svs.maxclients) && (svent.v_int[pr.entvars.modelindex] === 0))
			continue;
		baseline = svent.baseline;
		baseline.origin = ed.vector(svent, pr.entvars.origin);
		baseline.angles = ed.vector(svent, pr.entvars.angles);
		baseline.frame = svent.v_float[pr.entvars.frame] >> 0;
		baseline.skin = svent.v_float[pr.entvars.skin] >> 0;
		if ((i > 0) && (i <= state.server.maxclients))
		{
			// JOE:FIXME: entnum not defined. Original code issue
			baseline.colormap = undefined // entnum;
			baseline.modelindex = player;
		}
		else
		{
			baseline.colormap = 0;
			baseline.modelindex = modelIndex(pr.getString(svent.v_int[pr.entvars.model]));
		}
		msg.writeByte(signon, protocol.SVC.spawnbaseline);
		msg.writeShort(signon, i);
		msg.writeByte(signon, baseline.modelindex);
		msg.writeByte(signon, baseline.frame);
		msg.writeByte(signon, baseline.colormap);
		msg.writeByte(signon, baseline.skin);
		msg.writeCoord(signon, baseline.origin[0]);
		msg.writeAngle(signon, baseline.angles[0]);
		msg.writeCoord(signon, baseline.origin[1]);
		msg.writeAngle(signon, baseline.angles[1]);
		msg.writeCoord(signon, baseline.origin[2]);
		msg.writeAngle(signon, baseline.angles[2]);
	}
};

// move

export const checkBottom = function(ent)
{
	var mins = [
		ent.v_float[pr.entvars.origin] + ent.v_float[pr.entvars.mins],
		ent.v_float[pr.entvars.origin1] + ent.v_float[pr.entvars.mins1],
		ent.v_float[pr.entvars.origin2] + ent.v_float[pr.entvars.mins2]
	];
	var maxs = [
		ent.v_float[pr.entvars.origin] + ent.v_float[pr.entvars.maxs],
		ent.v_float[pr.entvars.origin1] + ent.v_float[pr.entvars.maxs1],
		ent.v_float[pr.entvars.origin2] + ent.v_float[pr.entvars.maxs2]
	];
	for (;;)
	{
		if (pointContents([mins[0], mins[1], mins[2] - 1.0]) !== mod.CONTENTS.solid)
			break;
		if (pointContents([mins[0], maxs[1], mins[2] - 1.0]) !== mod.CONTENTS.solid)
			break;
		if (pointContents([maxs[0], mins[1], mins[2] - 1.0]) !== mod.CONTENTS.solid)
			break;
		if (pointContents([maxs[0], maxs[1], mins[2] - 1.0]) !== mod.CONTENTS.solid)
			break;
		return true;
	}
	var start = [(mins[0] + maxs[0]) * 0.5, (mins[1] + maxs[1]) * 0.5, mins[2]];
	var stop = [start[0], start[1], start[2] - 36.0];
	var trace = move(start, vec.origin, vec.origin, stop, 1, ent);
	if (trace.fraction === 1.0)
		return;
	var mid, bottom;
	mid = bottom = trace.endpos[2];
	var x, y;
	for (x = 0; x <= 1; ++x)
	{
		for (y = 0; y <= 1; ++y)
		{
			start[0] = stop[0] = (x !== 0) ? maxs[0] : mins[0];
			start[1] = stop[1] = (y !== 0) ? maxs[1] : mins[1];
			trace = move(start, vec.origin, vec.origin, stop, 1, ent);
			if ((trace.fraction !== 1.0) && (trace.endpos[2] > bottom))
				bottom = trace.endpos[2];
			if ((trace.fraction === 1.0) || ((mid - trace.endpos[2]) > 18.0))
				return;
		}
	}
	return true;
};

export const movestep = async function(ent, _move, relink)
{
	var oldorg = ed.vector(ent, pr.entvars.origin);
	var neworg = [];
	var mins = ed.vector(ent, pr.entvars.mins), maxs = ed.vector(ent, pr.entvars.maxs);
	var trace;
	if ((ent.v_float[pr.entvars.flags] & (FL.swim + FL.fly)) !== 0)
	{
		var i, enemy = ent.v_int[pr.entvars.enemy], dz;
		for (i = 0; i <= 1; ++i)
		{
			neworg[0] = ent.v_float[pr.entvars.origin] + _move[0];
			neworg[1] = ent.v_float[pr.entvars.origin1] + _move[1];
			neworg[2] = ent.v_float[pr.entvars.origin2];
			if ((i === 0) && (enemy !== 0))
			{
				dz = ent.v_float[pr.entvars.origin2] - state.server.edicts[enemy].v_float[pr.entvars.origin2];
				if (dz > 40.0)
					neworg[2] -= 8.0;
				else if (dz < 30.0)
					neworg[2] += 8.0;
			}
			trace = move(ed.vector(ent, pr.entvars.origin), mins, maxs, neworg, 0, ent);
			if (trace.fraction === 1.0)
			{
				if (((ent.v_float[pr.entvars.flags] & FL.swim) !== 0) && (pointContents(trace.endpos) === mod.CONTENTS.empty))
					return 0;
				ent.v_float[pr.entvars.origin] = trace.endpos[0];
				ent.v_float[pr.entvars.origin1] = trace.endpos[1];
				ent.v_float[pr.entvars.origin2] = trace.endpos[2];
				if (relink === true)
					await linkEdict(ent, true);
				return 1;
			}
			if (enemy === 0)
				return 0;
		}
		return 0;
	}
	neworg[0] = ent.v_float[pr.entvars.origin] + _move[0];
	neworg[1] = ent.v_float[pr.entvars.origin1] + _move[1];
	neworg[2] = ent.v_float[pr.entvars.origin2] + 18.0;
	var end = [neworg[0], neworg[1], neworg[2] - 36.0];
	trace = move(neworg, mins, maxs, end, 0, ent);
	if (trace.allsolid === true)
		return 0;
	if (trace.startsolid === true)
	{
		neworg[2] -= 18.0;
		trace = move(neworg, mins, maxs, end, 0, ent);
		if ((trace.allsolid === true) || (trace.startsolid === true))
			return 0;
	}
	if (trace.fraction === 1.0)
	{
		if ((ent.v_float[pr.entvars.flags] & FL.partialground) === 0)
			return 0;
		ent.v_float[pr.entvars.origin] += _move[0];
		ent.v_float[pr.entvars.origin1] += _move[1];
		if (relink === true)
			await linkEdict(ent, true);
		ent.v_float[pr.entvars.flags] &= (~FL.onground >>> 0);
		return 1;
	}
	ent.v_float[pr.entvars.origin] = trace.endpos[0];
	ent.v_float[pr.entvars.origin1] = trace.endpos[1];
	ent.v_float[pr.entvars.origin2] = trace.endpos[2];
	if (checkBottom(ent) !== true)
	{
		if ((ent.v_float[pr.entvars.flags] & FL.partialground) !== 0)
		{
			if (relink === true)
				await linkEdict(ent, true);
			return 1;
		}
		ent.v_float[pr.entvars.origin] = oldorg[0];
		ent.v_float[pr.entvars.origin1] = oldorg[1];
		ent.v_float[pr.entvars.origin2] = oldorg[2];
		return 0;
	}
	ent.v_float[pr.entvars.flags] &= (~FL.partialground >>> 0);
	ent.v_int[pr.entvars.groundentity] = trace.ent.num;
	if (relink === true)
		await linkEdict(ent, true);
	return 1;
};

export const stepDirection = async function(ent, yaw, dist)
{
	ent.v_float[pr.entvars.ideal_yaw] = yaw;
	pf.changeyaw();
	yaw *= Math.PI / 180.0;
	var oldorigin = ed.vector(ent, pr.entvars.origin);
	if (await movestep(ent, [Math.cos(yaw) * dist, Math.sin(yaw) * dist], false) === 1)
	{
		var delta = ent.v_float[pr.entvars.angles1] - ent.v_float[pr.entvars.ideal_yaw];
		if ((delta > 45.0) && (delta < 315.0))
			ed.setVector(ent, pr.entvars.origin, oldorigin);
		await linkEdict(ent, true);
		return true;
	}
	await linkEdict(ent, true);
};

export const newChaseDir = async function(actor, enemy, dist)
{
	var olddir = vec.anglemod(((actor.v_float[pr.entvars.ideal_yaw] / 45.0) >> 0) * 45.0);
	var turnaround = vec.anglemod(olddir - 180.0);
	var deltax = enemy.v_float[pr.entvars.origin] - actor.v_float[pr.entvars.origin];
	var deltay = enemy.v_float[pr.entvars.origin1] - actor.v_float[pr.entvars.origin1];
	var dx, dy;
	if (deltax > 10.0)
		dx = 0.0;
	else if (deltax < -10.0)
		dx = 180.0;
	else
		dx = -1;
	if (deltay < -10.0)
		dy = 270.0;
	else if (deltay > 10.0)
		dy = 90.0;
	else
		dy = -1;
	var tdir;
	if ((dx !== -1) && (dy !== -1))
	{
		if (dx === 0.0)
			tdir = (dy === 90.0) ? 45.0 : 315.0;
		else
			tdir = (dy === 90.0) ? 135.0 : 215.0;
		if ((tdir !== turnaround) && (await stepDirection(actor, tdir, dist) === true))
			return;
	}
	if ((Math.random() >= 0.25) || (Math.abs(deltay) > Math.abs(deltax)))
	{
		tdir = dx;
		dx = dy;
		dy = tdir;
	}
	if ((dx !== -1) && (dx !== turnaround) && (await stepDirection(actor, dx, dist) === true))
		return;
	if ((dy !== -1) && (dy !== turnaround) && (await stepDirection(actor, dy, dist) === true))
		return;
	if ((olddir !== -1) && (await stepDirection(actor, olddir, dist) === true))
		return;
	if (Math.random() >= 0.5)
	{
		for (tdir = 0.0; tdir <= 315.0; tdir += 45.0)
		{
			if ((tdir !== turnaround) && (await stepDirection(actor, tdir, dist) === true))
				return;
		}
	}
	else
	{
		for (tdir = 315.0; tdir >= 0.0; tdir -= 45.0)
		{
			if ((tdir !== turnaround) && (await stepDirection(actor, tdir, dist) === true))
				return;
		}
	}
	if ((turnaround !== -1) && (await stepDirection(actor, turnaround, dist) === true))
		return;
	actor.v_float[pr.entvars.ideal_yaw] = olddir;
	if (checkBottom(actor) !== true)
		actor.v_float[pr.entvars.flags] |= FL.partialground;
};

export const closeEnough = function(ent, goal, dist)
{
	var i;
	for (i = 0; i <= 2; ++i)
	{
		if (goal.v_float[pr.entvars.absmin + i] > (ent.v_float[pr.entvars.absmax + i] + dist))
			return;
		if (goal.v_float[pr.entvars.absmax + i] < (ent.v_float[pr.entvars.absmin + i] - dist))
			return;
	}
	return true;
};

// phys

const checkAllEnts = function()
{
	var e, check, movetype;
	for (e = 1; e < state.server.num_edicts; ++e)
	{
		check = state.server.edicts[e];
		if (check.free === true)
			continue;
		switch (check.v_float[pr.entvars.movetype])
		{
		case MOVE_TYPE.push:
		case MOVE_TYPE.none:
		case MOVE_TYPE.noclip:
			continue;
		}
		if (testEntityPosition(check) === true)
			con.print('entity in invalid position\n');
	}
};

const checkVelocity = function(ent)
{
	var i, velocity;
	for (i = 0; i <= 2; ++i)
	{
		velocity = ent.v_float[pr.entvars.velocity + i];
		if (q.isNaN(velocity) === true)
		{
			con.print('Got a NaN velocity on ' + pr.getString(ent.v_int[pr.entvars.classname]) + '\n');
			velocity = 0.0;
		}
		if (q.isNaN(ent.v_float[pr.entvars.origin + i]) === true)
		{
			con.print('Got a NaN origin on ' + pr.getString(ent.v_int[pr.entvars.classname]) + '\n');
			ent.v_float[pr.entvars.origin + i] = 0.0;
		}
		if (velocity > cvr.maxvelocity.value)
			velocity = cvr.maxvelocity.value;
		else if (velocity < -cvr.maxvelocity.value)
			velocity = -cvr.maxvelocity.value;
		ent.v_float[pr.entvars.velocity + i] = velocity;
	}
};

async function runThink(ent)
{
	var thinktime = ent.v_float[pr.entvars.nextthink];
	if ((thinktime <= 0.0) || (thinktime > (state.server.time + host.state.frametime)))
		return true;
	if (thinktime < state.server.time)
		thinktime = state.server.time;
	ent.v_float[pr.entvars.nextthink] = 0.0;
	pr.state.globals_float[pr.globalvars.time] = thinktime;
	pr.state.globals_int[pr.globalvars.self] = ent.num;
	pr.state.globals_int[pr.globalvars.other] = 0;
	await pr.executeProgram(ent.v_int[pr.entvars.think]);
	return (ent.free !== true);
};

const impact = async function(e1, e2)
{
	var old_self = pr.state.globals_int[pr.globalvars.self];
	var old_other = pr.state.globals_int[pr.globalvars.other];
	pr.state.globals_float[pr.globalvars.time] = state.server.time;

	if ((e1.v_int[pr.entvars.touch] !== 0) && (e1.v_float[pr.entvars.solid] !== SOLID.not))
	{
		pr.state.globals_int[pr.globalvars.self] = e1.num;
		pr.state.globals_int[pr.globalvars.other] = e2.num;
		await pr.executeProgram(e1.v_int[pr.entvars.touch]);
	}
	if ((e2.v_int[pr.entvars.touch] !== 0) && (e2.v_float[pr.entvars.solid] !== SOLID.not))
	{
		pr.state.globals_int[pr.globalvars.self] = e2.num;
		pr.state.globals_int[pr.globalvars.other] = e1.num;
		await pr.executeProgram(e2.v_int[pr.entvars.touch]);
	}

	pr.state.globals_int[pr.globalvars.self] = old_self;
	pr.state.globals_int[pr.globalvars.other] = old_other;
};

const clipVelocity = function(vec, normal, out, overbounce)
{
	var backoff = (vec[0] * normal[0] + vec[1] * normal[1] + vec[2] * normal[2]) * overbounce;

	out[0] = vec[0] - normal[0] * backoff;
	if ((out[0] > -0.1) && (out[0] < 0.1))
		out[0] = 0.0;
	out[1] = vec[1] - normal[1] * backoff;
	if ((out[1] > -0.1) && (out[1] < 0.1))
		out[1] = 0.0;
	out[2] = vec[2] - normal[2] * backoff;
	if ((out[2] > -0.1) && (out[2] < 0.1))
		out[2] = 0.0;
};

const flyMove = async function(ent, time)
{
	var bumpcount;
	var numplanes = 0;
	var dir, d;
	var planes = [], plane;
	var primal_velocity = ed.vector(ent, pr.entvars.velocity);
	var original_velocity = ed.vector(ent, pr.entvars.velocity);
	var new_velocity = [];
	var i, j;
	var trace;
	var end = [];
	var time_left = time;
	var blocked = 0;
	for (bumpcount = 0; bumpcount <= 3; ++bumpcount)
	{
		if ((ent.v_float[pr.entvars.velocity] === 0.0) &&
			(ent.v_float[pr.entvars.velocity1] === 0.0) &&
			(ent.v_float[pr.entvars.velocity2] === 0.0))
			break;
		end[0] = ent.v_float[pr.entvars.origin] + time_left * ent.v_float[pr.entvars.velocity];
		end[1] = ent.v_float[pr.entvars.origin1] + time_left * ent.v_float[pr.entvars.velocity1];
		end[2] = ent.v_float[pr.entvars.origin2] + time_left * ent.v_float[pr.entvars.velocity2];
		trace = move(ed.vector(ent, pr.entvars.origin), ed.vector(ent, pr.entvars.mins), ed.vector(ent, pr.entvars.maxs), end, 0, ent);
		if (trace.allsolid === true)
		{
			ed.setVector(ent, pr.entvars.velocity, vec.origin);
			return 3;
		}
		if (trace.fraction > 0.0)
		{
			ed.setVector(ent, pr.entvars.origin, trace.endpos);
			original_velocity = ed.vector(ent, pr.entvars.velocity);
			numplanes = 0;
			if (trace.fraction === 1.0)
				break;
		}
		if (trace.ent == null)
			sys.error('SV.FlyMove: !trace.ent');
		if (trace.plane.normal[2] > 0.7)
		{
			blocked |= 1;
			if (trace.ent.v_float[pr.entvars.solid] === SOLID.bsp)
			{
				ent.v_float[pr.entvars.flags] |= FL.onground;
				ent.v_int[pr.entvars.groundentity] = trace.ent.num;
			}
		}
		else if (trace.plane.normal[2] === 0.0)
		{
			blocked |= 2;
			state.steptrace = trace;
		}
		await impact(ent, trace.ent);
		if (ent.free === true)
			break;
		time_left -= time_left * trace.fraction;
		if (numplanes >= 5)
		{
			ed.setVector(ent, pr.entvars.velocity, vec.origin);
			return 3;
		}
		planes[numplanes++] = [trace.plane.normal[0], trace.plane.normal[1], trace.plane.normal[2]];
		for (i = 0; i < numplanes; ++i)
		{
			clipVelocity(original_velocity, planes[i], new_velocity, 1.0);
			for (j = 0; j < numplanes; ++j)
			{
				if (j !== i)
				{
					plane = planes[j];
					if ((new_velocity[0] * plane[0] + new_velocity[1] * plane[1] + new_velocity[2] * plane[2]) < 0.0)
						break;
				}
			}
			if (j === numplanes)
				break;
		}
		if (i !== numplanes)
			ed.setVector(ent, pr.entvars.velocity, new_velocity);
		else
		{
			if (numplanes !== 2)
			{
				ed.setVector(ent, pr.entvars.velocity, vec.origin);
				return 7;
			}
			dir = vec.crossProduct(planes[0], planes[1]);
			d = dir[0] * ent.v_float[pr.entvars.velocity] +
				dir[1] * ent.v_float[pr.entvars.velocity1] +
				dir[2] * ent.v_float[pr.entvars.velocity2];
			ent.v_float[pr.entvars.velocity] = dir[0] * d;
			ent.v_float[pr.entvars.velocity1] = dir[1] * d;
			ent.v_float[pr.entvars.velocity2] = dir[2] * d;
		}
		if ((ent.v_float[pr.entvars.velocity] * primal_velocity[0] +
			ent.v_float[pr.entvars.velocity1] * primal_velocity[1] +
			ent.v_float[pr.entvars.velocity2] * primal_velocity[2]) <= 0.0)
		{
			ed.setVector(ent, pr.entvars.velocity, vec.origin);
			return blocked;
		}
	}
	return blocked;
};

const addGravity = function(ent)
{
	var val = pr.entvars.gravity, ent_gravity;
	if (val != null)
		ent_gravity = (ent.v_float[val] !== 0.0) ? ent.v_float[val] : 1.0;
	else
		ent_gravity = 1.0;
	ent.v_float[pr.entvars.velocity2] -= ent_gravity * cvr.gravity.value * host.state.frametime;
};

const pushEntity = async function(ent, push)
{
	var end = [
		ent.v_float[pr.entvars.origin] + push[0],
		ent.v_float[pr.entvars.origin1] + push[1],
		ent.v_float[pr.entvars.origin2] + push[2]
	];
	var nomonsters;
	var solid = ent.v_float[pr.entvars.solid];
	if (ent.v_float[pr.entvars.movetype] === MOVE_TYPE.flymissile)
		nomonsters = MOVE.missile;
	else if ((solid === SOLID.trigger) || (solid === SOLID.not))
		nomonsters = MOVE.nomonsters
	else
		nomonsters = MOVE.normal;
	var trace = move(ed.vector(ent, pr.entvars.origin), ed.vector(ent, pr.entvars.mins),
		ed.vector(ent, pr.entvars.maxs), end, nomonsters, ent);
	ed.setVector(ent, pr.entvars.origin, trace.endpos);
	await linkEdict(ent, true);
	if (trace.ent != null)
		await impact(ent, trace.ent);
	return trace;
};

const pushMove = async function(pusher, movetime)
{
	if ((pusher.v_float[pr.entvars.velocity] === 0.0) &&
		(pusher.v_float[pr.entvars.velocity1] === 0.0) &&
		(pusher.v_float[pr.entvars.velocity2] === 0.0))
	{
		pusher.v_float[pr.entvars.ltime] += movetime;
		return;
	}
	var _move = [
		pusher.v_float[pr.entvars.velocity] * movetime,
		pusher.v_float[pr.entvars.velocity1] * movetime,
		pusher.v_float[pr.entvars.velocity2] * movetime
	];
	var mins = [
		pusher.v_float[pr.entvars.absmin] + _move[0],
		pusher.v_float[pr.entvars.absmin1] + _move[1],
		pusher.v_float[pr.entvars.absmin2] + _move[2]
	];
	var maxs = [
		pusher.v_float[pr.entvars.absmax] + _move[0],
		pusher.v_float[pr.entvars.absmax1] + _move[1],
		pusher.v_float[pr.entvars.absmax2] + _move[2]
	];
	var pushorig = ed.vector(pusher, pr.entvars.origin);
	pusher.v_float[pr.entvars.origin] += _move[0];
	pusher.v_float[pr.entvars.origin1] += _move[1];
	pusher.v_float[pr.entvars.origin2] += _move[2];
	pusher.v_float[pr.entvars.ltime] += movetime;
	await linkEdict(pusher, false);
	var e, check, movetype;
	var entorig, moved = [], moved_edict, i;
	for (e = 1; e < state.server.num_edicts; ++e)
	{
		check = state.server.edicts[e];
		if (check.free === true)
			continue;
		movetype = check.v_float[pr.entvars.movetype];
		if ((movetype === MOVE_TYPE.push)
			|| (movetype === MOVE_TYPE.none)
			|| (movetype === MOVE_TYPE.noclip))
			continue;
		if (((check.v_float[pr.entvars.flags] & FL.onground) === 0) ||
			(check.v_int[pr.entvars.groundentity] !== pusher.num))
		{
			if ((check.v_float[pr.entvars.absmin] >= maxs[0])
				|| (check.v_float[pr.entvars.absmin1] >= maxs[1])
				|| (check.v_float[pr.entvars.absmin2] >= maxs[2])
				|| (check.v_float[pr.entvars.absmax] <= mins[0])
				|| (check.v_float[pr.entvars.absmax1] <= mins[1])
				|| (check.v_float[pr.entvars.absmax2] <= mins[2]))
				continue;
			if (testEntityPosition(check) !== true)
				continue;
		}
		if (movetype !== MOVE_TYPE.walk)
			check.v_float[pr.entvars.flags] &= (~FL.onground) >>> 0;
		entorig = ed.vector(check, pr.entvars.origin);
		moved[moved.length] = [entorig[0], entorig[1], entorig[2], check];
		pusher.v_float[pr.entvars.solid] = SOLID.not;
		await pushEntity(check, _move);
		pusher.v_float[pr.entvars.solid] = SOLID.bsp;
		if (testEntityPosition(check) === true)
		{
			if (check.v_float[pr.entvars.mins] === check.v_float[pr.entvars.maxs])
				continue;
			if ((check.v_float[pr.entvars.solid] === SOLID.not) || (check.v_float[pr.entvars.solid] === SOLID.trigger))
			{
				check.v_float[pr.entvars.mins] = check.v_float[pr.entvars.maxs] = 0.0;
				check.v_float[pr.entvars.mins1] = check.v_float[pr.entvars.maxs1] = 0.0;
				check.v_float[pr.entvars.maxs2] = check.v_float[pr.entvars.mins2];
				continue;
			}
			check.v_float[pr.entvars.origin] = entorig[0];
			check.v_float[pr.entvars.origin1] = entorig[1];
			check.v_float[pr.entvars.origin2] = entorig[2];
			await linkEdict(check, true);
			pusher.v_float[pr.entvars.origin] = pushorig[0];
			pusher.v_float[pr.entvars.origin1] = pushorig[1];
			pusher.v_float[pr.entvars.origin2] = pushorig[2];
			await linkEdict(pusher, false);
			pusher.v_float[pr.entvars.ltime] -= movetime;
			if (pusher.v_int[pr.entvars.blocked] !== 0)
			{
				pr.state.globals_int[pr.globalvars.self] = pusher.num;
				pr.state.globals_int[pr.globalvars.other] = check.num;
				await pr.executeProgram(pusher.v_int[pr.entvars.blocked]);
			}
			for (i = 0; i < moved.length; ++i)
			{
				moved_edict = moved[i];
				moved_edict[3].v_float[pr.entvars.origin] = moved_edict[0];
				moved_edict[3].v_float[pr.entvars.origin1] = moved_edict[1];
				moved_edict[3].v_float[pr.entvars.origin2] = moved_edict[2];
				await linkEdict(moved_edict[3], false);
			}
			return;
		}
	}
};

const physics_Pusher = async function(ent)
{
	var oldltime = ent.v_float[pr.entvars.ltime];
	var thinktime = ent.v_float[pr.entvars.nextthink];
	var movetime;
	if (thinktime < (oldltime + host.state.frametime))
	{
		movetime = thinktime - oldltime;
		if (movetime < 0.0)
			movetime = 0.0;
	}
	else
		movetime = host.state.frametime;
	if (movetime !== 0.0)
		await pushMove(ent, movetime);
	if ((thinktime <= oldltime) || (thinktime > ent.v_float[pr.entvars.ltime]))
		return;
	ent.v_float[pr.entvars.nextthink] = 0.0;
	pr.state.globals_float[pr.globalvars.time] = state.server.time;
	pr.state.globals_int[pr.globalvars.self] = ent.num;
	pr.state.globals_int[pr.globalvars.other] = 0;
	await pr.executeProgram(ent.v_int[pr.entvars.think]);
};

const checkStuck = async function(ent)
{
	if (testEntityPosition(ent) !== true)
	{
		ent.v_float[pr.entvars.oldorigin] = ent.v_float[pr.entvars.origin];
		ent.v_float[pr.entvars.oldorigin1] = ent.v_float[pr.entvars.origin1];
		ent.v_float[pr.entvars.oldorigin2] = ent.v_float[pr.entvars.origin2];
		return;
	}
	var org = ed.vector(ent, pr.entvars.origin);
	ent.v_float[pr.entvars.origin] = ent.v_float[pr.entvars.oldorigin];
	ent.v_float[pr.entvars.origin1] = ent.v_float[pr.entvars.oldorigin1];
	ent.v_float[pr.entvars.origin2] = ent.v_float[pr.entvars.oldorigin2];
	if (testEntityPosition(ent) !== true)
	{
		con.dPrint('Unstuck.\n');
		await linkEdict(ent, true);
		return;
	}
	var z, i, j;
	for (z = 0.0; z <= 17.0; ++z)
	{
		for (i = -1.0; i <= 1.0; ++i)
		{
			for (j = -1.0; j <= 1.0; ++j)
			{
				ent.v_float[pr.entvars.origin] = org[0] + i;
				ent.v_float[pr.entvars.origin1] = org[1] + j;
				ent.v_float[pr.entvars.origin2] = org[2] + z;
				if (testEntityPosition(ent) !== true)
				{
					con.dPrint('Unstuck.\n');
					await linkEdict(ent, true);
					return;
				}
			}
		}
	}
	ed.setVector(ent, pr.entvars.origin, org);
	con.dPrint('player is stuck.\n');
};

const checkWater = function(ent)
{
	var point = [
		ent.v_float[pr.entvars.origin],
		ent.v_float[pr.entvars.origin1],
		ent.v_float[pr.entvars.origin2] + ent.v_float[pr.entvars.mins2] + 1.0
	];
	ent.v_float[pr.entvars.waterlevel] = 0.0;
	ent.v_float[pr.entvars.watertype] = mod.CONTENTS.empty;
	var cont = pointContents(point);
	if (cont > mod.CONTENTS.water)
		return;
	ent.v_float[pr.entvars.watertype] = cont;
	ent.v_float[pr.entvars.waterlevel] = 1.0;
	point[2] = ent.v_float[pr.entvars.origin2] + (ent.v_float[pr.entvars.mins2] + ent.v_float[pr.entvars.maxs2]) * 0.5;
	cont = pointContents(point);
	if (cont <= mod.CONTENTS.water)
	{
		ent.v_float[pr.entvars.waterlevel] = 2.0;
		point[2] = ent.v_float[pr.entvars.origin2] + ent.v_float[pr.entvars.view_ofs2];
		cont = pointContents(point);
		if (cont <= mod.CONTENTS.water)
			ent.v_float[pr.entvars.waterlevel] = 3.0;
	}
	return ent.v_float[pr.entvars.waterlevel] > 1.0;
};

const wallFriction = function(ent, trace)
{
	var forward = [];
	vec.angleVectors(ed.vector(ent, pr.entvars.v_angle), forward, null, null);
	var normal = trace.plane.normal;
	var d = normal[0] * forward[0] + normal[1] * forward[1] + normal[2] * forward[2] + 0.5;
	if (d >= 0.0)
		return;
	d += 1.0;
	var i = normal[0] * ent.v_float[pr.entvars.velocity]
		+ normal[1] * ent.v_float[pr.entvars.velocity1]
		+ normal[2] * ent.v_float[pr.entvars.velocity2];
	ent.v_float[pr.entvars.velocity] = (ent.v_float[pr.entvars.velocity] - normal[0] * i) * d; 
	ent.v_float[pr.entvars.velocity1] = (ent.v_float[pr.entvars.velocity1] - normal[1] * i) * d; 
};

const tryUnstick = async function(ent, oldvel)
{
	var oldorg = ed.vector(ent, pr.entvars.origin);
	var dir = [2.0, 0.0, 0.0];
	var i, clip;
	for (i = 0; i <= 7; ++i)
	{
		switch (i)
		{
		case 1: dir[0] = 0.0; dir[1] = 2.0; break;
		case 2: dir[0] = -2.0; dir[1] = 0.0; break;
		case 3: dir[0] = 0.0; dir[1] = -2.0; break;
		case 4: dir[0] = 2.0; dir[1] = 2.0; break;
		case 5: dir[0] = -2.0; dir[1] = 2.0; break;
		case 6: dir[0] = 2.0; dir[1] = -2.0; break;
		case 7: dir[0] = -2.0; dir[1] = -2.0;
		}
		await pushEntity(ent, dir);
		ent.v_float[pr.entvars.velocity] = oldvel[0];
		ent.v_float[pr.entvars.velocity1] = oldvel[1];
		ent.v_float[pr.entvars.velocity2] = 0.0;
		clip = await flyMove(ent, 0.1);
		if ((Math.abs(oldorg[1] - ent.v_float[pr.entvars.origin1]) > 4.0)
			|| (Math.abs(oldorg[0] - ent.v_float[pr.entvars.origin]) > 4.0))
			return clip;
		ed.setVector(ent, pr.entvars.origin, oldorg);
	}
	ed.setVector(ent, pr.entvars.velocity, vec.origin);
	return 7;
};

const walkMove = async function(ent)
{
	var oldonground = ent.v_float[pr.entvars.flags] & FL.onground;
	ent.v_float[pr.entvars.flags] ^= oldonground;
	var oldorg = ed.vector(ent, pr.entvars.origin);
	var oldvel = ed.vector(ent, pr.entvars.velocity);
	var clip = await flyMove(ent, host.state.frametime);
	if ((clip & 2) === 0)
		return;
	if ((oldonground === 0) && (ent.v_float[pr.entvars.waterlevel] === 0.0))
		return;
	if (ent.v_float[pr.entvars.movetype] !== MOVE_TYPE.walk)
		return;
	if (cvr.nostep.value !== 0)
		return;
	if ((state.player.v_float[pr.entvars.flags] & FL.waterjump) !== 0)
		return;
	var nosteporg = ed.vector(ent, pr.entvars.origin);
	var nostepvel = ed.vector(ent, pr.entvars.velocity);
	ed.setVector(ent, pr.entvars.origin, oldorg);
	await pushEntity(ent, [0.0, 0.0, 18.0]);
	ent.v_float[pr.entvars.velocity] = oldvel[0];
	ent.v_float[pr.entvars.velocity1] = oldvel[1];
	ent.v_float[pr.entvars.velocity2] = 0.0;
	clip = await flyMove(ent, host.state.frametime);
	if (clip !== 0)
	{
		if ((Math.abs(oldorg[1] - ent.v_float[pr.entvars.origin1]) < 0.03125)
			&& (Math.abs(oldorg[0] - ent.v_float[pr.entvars.origin]) < 0.03125))
			clip = await tryUnstick(ent, oldvel);
		if ((clip & 2) !== 0)
			wallFriction(ent, state.steptrace);
	}
	var downtrace = await pushEntity(ent, [0.0, 0.0, oldvel[2] * host.state.frametime - 18.0]);
	if (downtrace.plane.normal[2] > 0.7)
	{
		if (ent.v_float[pr.entvars.solid] === SOLID.bsp)
		{
			ent.v_float[pr.entvars.flags] |= FL.onground;
			ent.v_int[pr.entvars.groundentity] = downtrace.ent.num;
		}
		return;
	}
	ed.setVector(ent, pr.entvars.origin, nosteporg);
	ed.setVector(ent, pr.entvars.velocity, nostepvel);
};

const physics_Client = async function(ent)
{
	if (state.svs.clients[ent.num - 1].active !== true)
		return;
	pr.state.globals_float[pr.globalvars.time] = state.server.time;
	pr.state.globals_int[pr.globalvars.self] = ent.num;
	await pr.executeProgram(pr.state.globals_int[pr.globalvars.PlayerPreThink]);
	checkVelocity(ent);
	var movetype = ent.v_float[pr.entvars.movetype] >> 0;
	if ((movetype === MOVE_TYPE.toss) || (movetype === MOVE_TYPE.bounce))
		await physics_Toss(ent);
	else
	{
		if (await runThink(ent) !== true)
			return;
		switch (movetype)
		{
		case MOVE_TYPE.none:
			break;
		case MOVE_TYPE.walk:
			if ((checkWater(ent) !== true) && ((ent.v_float[pr.entvars.flags] & FL.waterjump) === 0))
				addGravity(ent);
			await checkStuck(ent);
			await walkMove(ent);
			break;
		case MOVE_TYPE.fly:
			await flyMove(ent, host.state.frametime);
			break;
		case MOVE_TYPE.noclip:
			ent.v_float[pr.entvars.origin] += host.state.frametime * ent.v_float[pr.entvars.velocity];
			ent.v_float[pr.entvars.origin1] += host.state.frametime * ent.v_float[pr.entvars.velocity1];
			ent.v_float[pr.entvars.origin2] += host.state.frametime * ent.v_float[pr.entvars.velocity2];
			break;
		default:
			sys.error('SV.Physics_Client: bad movetype ' + movetype);
		}
	}
	await linkEdict(ent, true);
	pr.state.globals_float[pr.globalvars.time] = state.server.time;
	pr.state.globals_int[pr.globalvars.self] = ent.num;
	await pr.executeProgram(pr.state.globals_int[pr.globalvars.PlayerPostThink]);
};

const physics_Noclip = async function(ent)
{
	if (await runThink(ent) !== true)
		return;
	ent.v_float[pr.entvars.angles] += host.state.frametime * ent.v_float[pr.entvars.avelocity];
	ent.v_float[pr.entvars.angles1] += host.state.frametime * ent.v_float[pr.entvars.avelocity1];
	ent.v_float[pr.entvars.angles2] += host.state.frametime * ent.v_float[pr.entvars.avelocity2];
	ent.v_float[pr.entvars.origin] += host.state.frametime * ent.v_float[pr.entvars.velocity];
	ent.v_float[pr.entvars.origin1] += host.state.frametime * ent.v_float[pr.entvars.velocity1];
	ent.v_float[pr.entvars.origin2] += host.state.frametime * ent.v_float[pr.entvars.velocity2];
	await linkEdict(ent, false);
};

const checkWaterTransition = function(ent)
{
	var cont = pointContents(ed.vector(ent, pr.entvars.origin));
	if (ent.v_float[pr.entvars.watertype] === 0.0)
	{
		ent.v_float[pr.entvars.watertype] = cont;
		ent.v_float[pr.entvars.waterlevel] = 1.0;
		return;
	}
	if (cont <= mod.CONTENTS.water)
	{
		if (ent.v_float[pr.entvars.watertype] === mod.CONTENTS.empty)
			startSound(ent, 0, 'misc/h2ohit1.wav', 255, 1.0);
		ent.v_float[pr.entvars.watertype] = cont;
		ent.v_float[pr.entvars.waterlevel] = 1.0;
		return;
	}
	if (ent.v_float[pr.entvars.watertype] !== mod.CONTENTS.empty)
		startSound(ent, 0, 'misc/h2ohit1.wav', 255, 1.0);
	ent.v_float[pr.entvars.watertype] = mod.CONTENTS.empty;
	ent.v_float[pr.entvars.waterlevel] = cont;
};

const physics_Toss = async function(ent)
{
	if (await runThink(ent) !== true)
		return;
	if ((ent.v_float[pr.entvars.flags] & FL.onground) !== 0)
		return;
	checkVelocity(ent);
	var movetype = ent.v_float[pr.entvars.movetype];
	if ((movetype !== MOVE_TYPE.fly) && (movetype !== MOVE_TYPE.flymissile))
		addGravity(ent);
	ent.v_float[pr.entvars.angles] += host.state.frametime * ent.v_float[pr.entvars.avelocity];
	ent.v_float[pr.entvars.angles1] += host.state.frametime * ent.v_float[pr.entvars.avelocity1];
	ent.v_float[pr.entvars.angles2] += host.state.frametime * ent.v_float[pr.entvars.avelocity2];
	var trace = await pushEntity(ent,
		[
			ent.v_float[pr.entvars.velocity] * host.state.frametime,
			ent.v_float[pr.entvars.velocity1] * host.state.frametime,
			ent.v_float[pr.entvars.velocity2] * host.state.frametime
		]);
	if ((trace.fraction === 1.0) || (ent.free === true))
		return;
	var velocity = [];
	clipVelocity(ed.vector(ent, pr.entvars.velocity), trace.plane.normal, velocity, (movetype === MOVE_TYPE.bounce) ? 1.5 : 1.0);
	ed.setVector(ent, pr.entvars.velocity, velocity);
	if (trace.plane.normal[2] > 0.7)
	{
		if ((ent.v_float[pr.entvars.velocity2] < 60.0) || (movetype !== MOVE_TYPE.bounce))
		{
			ent.v_float[pr.entvars.flags] |= FL.onground;
			ent.v_int[pr.entvars.groundentity] = trace.ent.num;
			ent.v_float[pr.entvars.velocity] = ent.v_float[pr.entvars.velocity1] = ent.v_float[pr.entvars.velocity2] = 0.0;
			ent.v_float[pr.entvars.avelocity] = ent.v_float[pr.entvars.avelocity1] = ent.v_float[pr.entvars.avelocity2] = 0.0;
		}
	}
	checkWaterTransition(ent);
};

const physics_Step = async function(ent)
{
	if ((ent.v_float[pr.entvars.flags] & (FL.onground + FL.fly + FL.swim)) === 0)
	{
		var hitsound = (ent.v_float[pr.entvars.velocity2] < (cvr.gravity.value * -0.1));
		addGravity(ent);
		checkVelocity(ent);
		await flyMove(ent, host.state.frametime);
		await linkEdict(ent, true);
		if (((ent.v_float[pr.entvars.flags] & FL.onground) !== 0) && (hitsound === true))
			startSound(ent, 0, 'demon/dland2.wav', 255, 1.0);
	}
	await runThink(ent);
	checkWaterTransition(ent);
};


// user

const setIdealPitch = function()
{
	var ent = state.player;
	if ((ent.v_float[pr.entvars.flags] & FL.onground) === 0)
		return;
	var angleval = ent.v_float[pr.entvars.angles1] * (Math.PI / 180.0);
	var sinval = Math.sin(angleval);
	var cosval = Math.cos(angleval);
	var top = [0.0, 0.0, ent.v_float[pr.entvars.origin2] + ent.v_float[pr.entvars.view_ofs2]];
	var bottom = [0.0, 0.0, top[2] - 160.0];
	var i, tr, z = [];
	for (i = 0; i < 6; ++i)
	{
		top[0] = bottom[0] = ent.v_float[pr.entvars.origin] + cosval * (i + 3) * 12.0;
		top[1] = bottom[1] = ent.v_float[pr.entvars.origin1] + sinval * (i + 3) * 12.0;
		tr = move(top, vec.origin, vec.origin, bottom, 1, ent);
		if ((tr.allsolid === true) || (tr.fraction === 1.0))
			return;
		z[i] = top[2] - tr.fraction * 160.0;
	}
	var dir = 0.0, step, steps = 0;
	for (i = 1; i < 6; ++i)
	{
		step = z[i] - z[i - 1];
		if ((step > -0.1) && (step < 0.1))
			continue;
		if ((dir !== 0.0) && (((step - dir) > 0.1) || ((step - dir) < -0.1)))
			return;
		++steps;
		dir = step;
	}
	if (dir === 0.0)
	{
		ent.v_float[pr.entvars.idealpitch] = 0.0;
		return;
	}
	if (steps >= 2)
		ent.v_float[pr.entvars.idealpitch] = -dir * cvr.idealpitchscale.value;
};

const userFriction = function()
{
	var ent = state.player;
	var vel0 = ent.v_float[pr.entvars.velocity], vel1 = ent.v_float[pr.entvars.velocity1];
	var speed = Math.sqrt(vel0 * vel0 + vel1 * vel1);
	if (speed === 0.0)
		return;
	var start = [
		ent.v_float[pr.entvars.origin] + vel0 / speed * 16.0,
		ent.v_float[pr.entvars.origin1] + vel1 / speed * 16.0,
		ent.v_float[pr.entvars.origin2] + ent.v_float[pr.entvars.mins2]
	];
	var friction = cvr.friction.value;
	if (move(start, vec.origin, vec.origin, [start[0], start[1], start[2] - 34.0], 1, ent).fraction === 1.0)
		friction *= cvr.edgefriction.value;
	var newspeed = speed - host.state.frametime * (speed < cvr.stopspeed.value ? cvr.stopspeed.value : speed) * friction;
	if (newspeed < 0.0)
		newspeed = 0.0;
	newspeed /= speed;
	ent.v_float[pr.entvars.velocity] *= newspeed;
	ent.v_float[pr.entvars.velocity1] *= newspeed;
	ent.v_float[pr.entvars.velocity2] *= newspeed;
};

const accelerate = function(wishvel, air, wishdir, wishspeed)
{
    var wishAir, addspeed, ent = state.player;;
    if(air){
        wishAir = vec.normalize (wishvel);
        if (wishAir > 30)
            wishAir = 30;
            
        addspeed = wishAir - (ent.v_float[pr.entvars.velocity] * wishvel[0]
            + ent.v_float[pr.entvars.velocity1] * wishvel[1]
            + ent.v_float[pr.entvars.velocity2] * wishvel[2]);

    } else {        
        addspeed = wishspeed - (ent.v_float[pr.entvars.velocity] * wishdir[0]
            + ent.v_float[pr.entvars.velocity1] * wishdir[1]
            + ent.v_float[pr.entvars.velocity2] * wishdir[2]);
    }
	if (addspeed <= 0)
		return;
	var accelspeed = cvr.accelerate.value*host.state.frametime*wishspeed;
	if (accelspeed > addspeed)
		accelspeed = addspeed;
        
    var velToMult = air ? wishvel : wishdir;
    
	ent.v_float[pr.entvars.velocity] += accelspeed * velToMult[0];
	ent.v_float[pr.entvars.velocity1] += accelspeed * velToMult[1];
	ent.v_float[pr.entvars.velocity2] += accelspeed * velToMult[2];
};

const waterMove = function()
{
	var ent = state.player, _cmd = host.state.client.cmd;
	var forward = [], right = [];
	vec.angleVectors(ed.vector(ent, pr.entvars.v_angle), forward, right, null);
	var wishvel = [
		forward[0] * _cmd.forwardmove + right[0] * _cmd.sidemove,
		forward[1] * _cmd.forwardmove + right[1] * _cmd.sidemove,
		forward[2] * _cmd.forwardmove + right[2] * _cmd.sidemove
	];
	if ((_cmd.forwardmove === 0.0) && (_cmd.sidemove === 0.0) && (_cmd.upmove === 0.0))
		wishvel[2] -= 60.0;
	else
		wishvel[2] += _cmd.upmove;
	var wishspeed = Math.sqrt(wishvel[0] * wishvel[0] + wishvel[1] * wishvel[1] + wishvel[2] * wishvel[2]);
	var scale;
	if (wishspeed > cvr.maxspeed.value)
	{
		scale = cvr.maxspeed.value / wishspeed;
		wishvel[0] *= scale;
		wishvel[1] *= scale;
		wishvel[2] *= scale;
		wishspeed = cvr.maxspeed.value;
	}
	wishspeed *= 0.7;
	var speed = Math.sqrt(ent.v_float[pr.entvars.velocity] * ent.v_float[pr.entvars.velocity]
		+ ent.v_float[pr.entvars.velocity1] * ent.v_float[pr.entvars.velocity1]
		+ ent.v_float[pr.entvars.velocity2] * ent.v_float[pr.entvars.velocity2]
	), newspeed;
	if (speed !== 0.0)
	{
		newspeed = speed - host.state.frametime * speed * cvr.friction.value;
		if (newspeed < 0.0)
			newspeed = 0.0;
		scale = newspeed / speed;
		ent.v_float[pr.entvars.velocity] *= scale;
		ent.v_float[pr.entvars.velocity1] *= scale;
		ent.v_float[pr.entvars.velocity2] *= scale;
	}
	else
		newspeed = 0.0;
	if (wishspeed === 0.0)
		return;
	var addspeed = wishspeed - newspeed;
	if (addspeed <= 0.0)
		return;
	var accelspeed = cvr.accelerate.value * wishspeed * host.state.frametime;
	if (accelspeed > addspeed)
		accelspeed = addspeed;
	ent.v_float[pr.entvars.velocity] += accelspeed * (wishvel[0] / wishspeed);
	ent.v_float[pr.entvars.velocity1] += accelspeed * (wishvel[1] / wishspeed);
	ent.v_float[pr.entvars.velocity2] += accelspeed * (wishvel[2] / wishspeed);
};

const waterJump = function()
{
	var ent = state.player;
	if ((state.server.time > ent.v_float[pr.entvars.teleport_time]) || (ent.v_float[pr.entvars.waterlevel] === 0.0))
	{
		ent.v_float[pr.entvars.flags] &= (~FL.waterjump >>> 0);
		ent.v_float[pr.entvars.teleport_time] = 0.0;
	}
	ent.v_float[pr.entvars.velocity] = ent.v_float[pr.entvars.movedir];
	ent.v_float[pr.entvars.velocity1] = ent.v_float[pr.entvars.movedir1];
};

const airMove = function()
{
	var ent = state.player;
	var _cmd = host.state.client.cmd;
	var forward = [], right = [];
    
	vec.angleVectors(ed.vector(ent, pr.entvars.angles), forward, right, null);
    
	var fmove = _cmd.forwardmove;
	var smove = _cmd.sidemove;
    
	if ((state.server.time < ent.v_float[pr.entvars.teleport_time]) && (fmove < 0.0))
		fmove = 0.0;
        
	var wishvel = [
		forward[0] * fmove + right[0] * smove,
		forward[1] * fmove + right[1] * smove,
		((ent.v_float[pr.entvars.movetype] >> 0) !== MOVE_TYPE.walk) ? _cmd.upmove : 0.0];    
    
	var wishdir = [wishvel[0], wishvel[1], wishvel[2]],
        wishspeed = vec.normalize(wishdir);
    var scaler = (cvr.maxspeed.value / wishspeed);
	if (wishspeed > cvr.maxspeed.value)
	{
		wishvel[0] = wishvel[0] * scaler;
		wishvel[1] = wishvel[1] * scaler;
		wishvel[2] = wishvel[2] * scaler;
		wishspeed = cvr.maxspeed.value;
	}
    
	if (ent.v_float[pr.entvars.movetype] === MOVE_TYPE.noclip)
		ed.setVector(ent, pr.entvars.velocity, wishvel);
	else if ((ent.v_float[pr.entvars.flags] & FL.onground) !== 0)
	{
		userFriction() // wishvel); original has this param. Fn doesn't take one.
		accelerate(wishvel, false, wishdir, wishspeed);
	}
	else
		accelerate(wishvel, true, wishdir, wishspeed);
};

const clientThink = function()
{
	var ent = state.player;

	if (ent.v_float[pr.entvars.movetype] === MOVE_TYPE.none)
		return;

	var punchangle = ed.vector(ent, pr.entvars.punchangle);
	var len = vec.normalize(punchangle) - 10.0 * host.state.frametime;
	if (len < 0.0)
		len = 0.0;
	ent.v_float[pr.entvars.punchangle] = punchangle[0] * len;
	ent.v_float[pr.entvars.punchangle1] = punchangle[1] * len;
	ent.v_float[pr.entvars.punchangle2] = punchangle[2] * len;

	if (ent.v_float[pr.entvars.health] <= 0.0)
		return;

	ent.v_float[pr.entvars.angles2] = v.calcRoll(ed.vector(ent, pr.entvars.angles), ed.vector(ent, pr.entvars.velocity)) * 4.0;
	if (state.player.v_float[pr.entvars.fixangle] === 0.0)
	{
		ent.v_float[pr.entvars.angles] = (ent.v_float[pr.entvars.v_angle] + ent.v_float[pr.entvars.punchangle]) / -3.0;
		ent.v_float[pr.entvars.angles1] = ent.v_float[pr.entvars.v_angle1] + ent.v_float[pr.entvars.punchangle1];
	}

	if ((ent.v_float[pr.entvars.flags] & FL.waterjump) !== 0)
		waterJump();
	else if ((ent.v_float[pr.entvars.waterlevel] >= 2.0) && (ent.v_float[pr.entvars.movetype] !== MOVE_TYPE.noclip))
		waterMove();
	else
		airMove();
};

const readClientMove = function()
{
	var client = host.state.client;
	client.ping_times[client.num_pings++ & 15] = state.server.time - msg.readFloat();
	client.edict.v_float[pr.entvars.v_angle] = msg.readAngle();
	client.edict.v_float[pr.entvars.v_angle1] = msg.readAngle();
	client.edict.v_float[pr.entvars.v_angle2] = msg.readAngle();
	client.cmd.forwardmove = msg.readShort();
	client.cmd.sidemove = msg.readShort();
	client.cmd.upmove = msg.readShort();
	var i = msg.readByte();
	client.edict.v_float[pr.entvars.button0] = i & 1;
	client.edict.v_float[pr.entvars.button2] = (i & 2) >> 1;
	i = msg.readByte();
	if (i !== 0)
		client.edict.v_float[pr.entvars.impulse] = i;
};

const readClientMessage = async function()
{
	var ret, _cmd, s, i;
	var cmds = [
		'status',
		'god', 
		'notarget',
		'fly',
		'name',
		'noclip',
		'say',
		'say_team',
		'tell',
		'color',
		'kill',
		'pause',
		'spawn',
		'begin',
		'prespawn',
		'kick',
		'ping',
		'give',
		'ban'
	];
	do
	{
		ret = net.getMessage(host.state.client.netconnection);
		if (ret === -1)
		{
			sys.print('SV.ReadClientMessage: NET.GetMessage failed\n');
			return;
		}
		if (ret === 0)
			return true;
		msg.beginReading();
		for (;;)
		{
			if (host.state.client.active !== true)
				return;
			if (msg.state.badread === true)
			{
				sys.print('SV.ReadClientMessage: badread\n');
				return;
			}
			_cmd = msg.readChar();
			if (_cmd === -1)
			{
				ret = 1;
				break;
			}
			if (_cmd === protocol.CLC.nop)
				continue;
			if (_cmd === protocol.CLC.stringcmd)
			{
				s = msg.readString();
				console.log('read -> ' + s)
				for (i = 0; i < cmds.length; ++i)
				{
					if (s.substring(0, cmds[i].length).toLowerCase() !== cmds[i])
						continue;
					await cmd.executeString(s, true);
					break;
				}
				if (i === cmds.length)
					con.dPrint(getClientName(host.state.client) + ' tried to ' + s);
			}
			else if (_cmd === protocol.CLC.disconnect)
				return;
			else if (_cmd === protocol.CLC.move)
				readClientMove();
			else
			{
				sys.print('SV.ReadClientMessage: unknown command char\n');
				return;
			}
		}
	} while (ret === 1);
};

// world

const MOVE = {
	normal: 0,
	nomonsters: 1,
	missile: 2
};

const initBoxHull = function()
{
	state.box_clipnodes = [];
	state.box_planes = [];
	state.box_hull = {
		clipnodes: state.box_clipnodes,
		planes: state.box_planes,
		firstclipnode: 0,
		lastclipnode: 5
	};
	var i, node, plane;
	for (i = 0; i <= 5; ++i)
	{
		node = {};
		state.box_clipnodes[i] = node;
		node.planenum = i;
		node.children = [];
		node.children[i & 1] = mod.CONTENTS.empty;
		if (i !== 5)
			node.children[1 - (i & 1)] = i + 1;
		else
			node.children[1 - (i & 1)] = mod.CONTENTS.solid;
		plane = {};
		state.box_planes[i] = plane;
		plane.type = i >> 1;
		plane.normal = [0.0, 0.0, 0.0];
		plane.normal[i >> 1] = 1.0;
		plane.dist = 0.0;
	}
};

const hullForEntity = function(ent, mins, maxs, offset)
{
	if (ent.v_float[pr.entvars.solid] !== SOLID.bsp)
	{
		state.box_planes[0].dist = ent.v_float[pr.entvars.maxs] - mins[0];
		state.box_planes[1].dist = ent.v_float[pr.entvars.mins] - maxs[0];
		state.box_planes[2].dist = ent.v_float[pr.entvars.maxs1] - mins[1];
		state.box_planes[3].dist = ent.v_float[pr.entvars.mins1] - maxs[1];
		state.box_planes[4].dist = ent.v_float[pr.entvars.maxs2] - mins[2];
		state.box_planes[5].dist = ent.v_float[pr.entvars.mins2] - maxs[2];
		offset[0] = ent.v_float[pr.entvars.origin];
		offset[1] = ent.v_float[pr.entvars.origin1];
		offset[2] = ent.v_float[pr.entvars.origin2];
		return state.box_hull;
	}
	if (ent.v_float[pr.entvars.movetype] !== MOVE_TYPE.push)
		sys.error('SOLID_BSP without MOVETYPE_PUSH');
	var model = state.server.models[ent.v_float[pr.entvars.modelindex] >> 0];
	if (model == null)
		sys.error('MOVETYPE_PUSH with a non bsp model');
	if (model.type !== mod.TYPE.brush)
		sys.error('MOVETYPE_PUSH with a non bsp model');
	var size = maxs[0] - mins[0];
	var hull;
	if (size < 3.0)
		hull = model.hulls[0];
	else if (size <= 32.0)
		hull = model.hulls[1];
	else
		hull = model.hulls[2];
	offset[0] = hull.clip_mins[0] - mins[0] + ent.v_float[pr.entvars.origin];
	offset[1] = hull.clip_mins[1] - mins[1] + ent.v_float[pr.entvars.origin1];
	offset[2] = hull.clip_mins[2] - mins[2] + ent.v_float[pr.entvars.origin2];
	return hull;
};

const createAreaNode = function(depth, mins, maxs)
{
	var anode = {} as any;
	state.areanodes[state.areanodes.length++] = anode;

	anode.trigger_edicts = {};
	anode.trigger_edicts.prev = anode.trigger_edicts.next = anode.trigger_edicts;
	anode.solid_edicts = {};
	anode.solid_edicts.prev = anode.solid_edicts.next = anode.solid_edicts;

	if (depth === 4)
	{
		anode.axis = -1;
		anode.children = [];
		return anode;
	}

	anode.axis = (maxs[0] - mins[0]) > (maxs[1] - mins[1]) ? 0 : 1;
	anode.dist = 0.5 * (maxs[anode.axis] + mins[anode.axis]);

	var maxs1 = [maxs[0], maxs[1], maxs[2]];
	var mins2 = [mins[0], mins[1], mins[2]];
	maxs1[anode.axis] = mins2[anode.axis] = anode.dist;
	anode.children = [createAreaNode(depth + 1, mins2, maxs), createAreaNode(depth + 1, mins, maxs1)];
	return anode;
};

export const unlinkEdict = function(ent)
{
	if (ent.area.prev != null)
		ent.area.prev.next = ent.area.next;
	if (ent.area.next != null)
		ent.area.next.prev = ent.area.prev;
	ent.area.prev = ent.area.next = null;
};

const touchLinks = async function(ent, node)
{
	var l, next, touch, old_self, old_other;
	for (l = node.trigger_edicts.next; l !== node.trigger_edicts; l = next)
	{
		next = l.next;
		touch = l.ent;
		if (touch === ent)
			continue;
		if ((touch.v_int[pr.entvars.touch] === 0) || (touch.v_float[pr.entvars.solid] !== SOLID.trigger))
			continue;
		if ((ent.v_float[pr.entvars.absmin] > touch.v_float[pr.entvars.absmax]) ||
			(ent.v_float[pr.entvars.absmin1] > touch.v_float[pr.entvars.absmax1]) || 
			(ent.v_float[pr.entvars.absmin2] > touch.v_float[pr.entvars.absmax2]) ||
			(ent.v_float[pr.entvars.absmax] < touch.v_float[pr.entvars.absmin]) ||
			(ent.v_float[pr.entvars.absmax1] < touch.v_float[pr.entvars.absmin1]) ||
			(ent.v_float[pr.entvars.absmax2] < touch.v_float[pr.entvars.absmin2]))
			continue;
		old_self = pr.state.globals_int[pr.globalvars.self];
		old_other = pr.state.globals_int[pr.globalvars.other];
		pr.state.globals_int[pr.globalvars.self] = touch.num;
		pr.state.globals_int[pr.globalvars.other] = ent.num;
		pr.state.globals_float[pr.globalvars.time] = state.server.time;
		await pr.executeProgram(touch.v_int[pr.entvars.touch]);
		pr.state.globals_int[pr.globalvars.self] = old_self;
		pr.state.globals_int[pr.globalvars.other] = old_other;
	}
	if (node.axis === -1)
		return;
	if (ent.v_float[pr.entvars.absmax + node.axis] > node.dist)
		await touchLinks(ent, node.children[0]);
	if (ent.v_float[pr.entvars.absmin + node.axis] < node.dist)
		await touchLinks(ent, node.children[1]);
};

const findTouchedLeafs = function(ent, node)
{
	if (node.contents === mod.CONTENTS.solid)
		return;

	if (node.contents < 0)
	{
		if (ent.leafnums.length === 16)
			return;
		ent.leafnums[ent.leafnums.length] = node.num - 1;
		return;
	}

	var sides = vec.boxOnPlaneSide([ent.v_float[pr.entvars.absmin], ent.v_float[pr.entvars.absmin1], ent.v_float[pr.entvars.absmin2]],
		[ent.v_float[pr.entvars.absmax], ent.v_float[pr.entvars.absmax1], ent.v_float[pr.entvars.absmax2]], node.plane);
	if ((sides & 1) !== 0)
		findTouchedLeafs(ent, node.children[0]);
	if ((sides & 2) !== 0)
		findTouchedLeafs(ent, node.children[1]);
};

export const linkEdict = async function(ent, touch_triggers: boolean = false)
{
	if ((ent === state.server.edicts[0]) || (ent.free === true))
		return;

	unlinkEdict(ent);

	ent.v_float[pr.entvars.absmin] = ent.v_float[pr.entvars.origin] + ent.v_float[pr.entvars.mins] - 1.0;
	ent.v_float[pr.entvars.absmin1] = ent.v_float[pr.entvars.origin1] + ent.v_float[pr.entvars.mins1] - 1.0;
	ent.v_float[pr.entvars.absmin2] = ent.v_float[pr.entvars.origin2] + ent.v_float[pr.entvars.mins2];
	ent.v_float[pr.entvars.absmax] = ent.v_float[pr.entvars.origin] + ent.v_float[pr.entvars.maxs] + 1.0;
	ent.v_float[pr.entvars.absmax1] = ent.v_float[pr.entvars.origin1] + ent.v_float[pr.entvars.maxs1] + 1.0;
	ent.v_float[pr.entvars.absmax2] = ent.v_float[pr.entvars.origin2] + ent.v_float[pr.entvars.maxs2];

	if ((ent.v_float[pr.entvars.flags] & FL.item) !== 0)
	{
		ent.v_float[pr.entvars.absmin] -= 14.0;
		ent.v_float[pr.entvars.absmin1] -= 14.0;
		ent.v_float[pr.entvars.absmax] += 14.0;
		ent.v_float[pr.entvars.absmax1] += 14.0;
	}
	else
	{
		ent.v_float[pr.entvars.absmin2] -= 1.0;
		ent.v_float[pr.entvars.absmax2] += 1.0;
	}

	ent.leafnums = [];
	if (ent.v_float[pr.entvars.modelindex] !== 0.0)
		findTouchedLeafs(ent, state.server.worldmodel.nodes[0]);

	if (ent.v_float[pr.entvars.solid] === SOLID.not)
		return;

	var node = state.areanodes[0];
	for (;;)
	{
		if (node.axis === -1)
			break;
		if (ent.v_float[pr.entvars.absmin + node.axis] > node.dist)
			node = node.children[0];
		else if (ent.v_float[pr.entvars.absmax + node.axis] < node.dist)
			node = node.children[1];
		else
			break;
	}

	var before = (ent.v_float[pr.entvars.solid] === SOLID.trigger) ? node.trigger_edicts : node.solid_edicts;
	ent.area.next = before;
	ent.area.prev = before.prev;
	ent.area.prev.next = ent.area;
	ent.area.next.prev = ent.area;
	ent.area.ent = ent;

	if (touch_triggers === true)
		await touchLinks(ent, state.areanodes[0]);
};

const hullPointContents = function(hull, num, p)
{
	var d, node, plane;
	for (; num >= 0; )
	{
		if ((num < hull.firstclipnode) || (num > hull.lastclipnode))
			sys.error('SV.HullPointContents: bad node number');
		node = hull.clipnodes[num];
		plane = hull.planes[node.planenum];
		if (plane.type <= 2)
			d = p[plane.type] - plane.dist;
		else
			d = plane.normal[0] * p[0] + plane.normal[1] * p[1] + plane.normal[2] * p[2] - plane.dist;
		if (d >= 0.0)
			num = node.children[0];
		else
			num = node.children[1];
	}
	return num;
};

export const pointContents = function(p)
{
	var cont = hullPointContents(state.server.worldmodel.hulls[0], 0, p);
	if ((cont <= mod.CONTENTS.current_0) && (cont >= mod.CONTENTS.current_down))
		return mod.CONTENTS.water;
	return cont;
};

const testEntityPosition = function(ent)
{
	var origin = ed.vector(ent, pr.entvars.origin);
	return move(origin, ed.vector(ent, pr.entvars.mins), ed.vector(ent, pr.entvars.maxs), origin, 0, ent).startsolid;
};

export const recursiveHullCheck = function(hull, num, p1f, p2f, p1, p2, trace)
{
	if (num < 0)
	{
		if (num !== mod.CONTENTS.solid)
		{
			trace.allsolid = false;
			if (num === mod.CONTENTS.empty)
				trace.inopen = true;
			else
				trace.inwater = true;
		}
		else
			trace.startsolid = true;
		return true;
	}

	if ((num < hull.firstclipnode) || (num > hull.lastclipnode))
		sys.error('SV.RecursiveHullCheck: bad node number');

	var node = hull.clipnodes[num];
	var plane = hull.planes[node.planenum];
	var t1, t2;

	if (plane.type <= 2)
	{
		t1 = p1[plane.type] - plane.dist;
		t2 = p2[plane.type] - plane.dist;
	}
	else
	{
		t1 = plane.normal[0] * p1[0] + plane.normal[1] * p1[1] + plane.normal[2] * p1[2] - plane.dist;
		t2 = plane.normal[0] * p2[0] + plane.normal[1] * p2[1] + plane.normal[2] * p2[2] - plane.dist;
	}

	if ((t1 >= 0.0) && (t2 >= 0.0))
		return recursiveHullCheck(hull, node.children[0], p1f, p2f, p1, p2, trace);
	if ((t1 < 0.0) && (t2 < 0.0))
		return recursiveHullCheck(hull, node.children[1], p1f, p2f, p1, p2, trace);

	var frac = (t1 + (t1 < 0.0 ? 0.03125 : -0.03125)) / (t1 - t2);
	if (frac < 0.0)
		frac = 0.0;
	else if (frac > 1.0)
		frac = 1.0;

	var midf = p1f + (p2f - p1f) * frac;
	var mid = [
		p1[0] + frac * (p2[0] - p1[0]),
		p1[1] + frac * (p2[1] - p1[1]),
		p1[2] + frac * (p2[2] - p1[2])
	];
	var side = t1 < 0.0 ? 1 : 0;

	if (recursiveHullCheck(hull, node.children[side], p1f, midf, p1, mid, trace) !== true)
		return;

	if (hullPointContents(hull, node.children[1 - side], mid) !== mod.CONTENTS.solid)
		return recursiveHullCheck(hull, node.children[1 - side], midf, p2f, mid, p2, trace);

	if (trace.allsolid === true)
		return;

	if (side === 0)
	{
		trace.plane.normal = [plane.normal[0], plane.normal[1], plane.normal[2]];
		trace.plane.dist = plane.dist;
	}
	else
	{
		trace.plane.normal = [-plane.normal[0], -plane.normal[1], -plane.normal[2]];
		trace.plane.dist = -plane.dist;
	}

	while (hullPointContents(hull, hull.firstclipnode, mid) === mod.CONTENTS.solid)
	{
		frac -= 0.1;
		if (frac < 0.0)
		{
			trace.fraction = midf;
			trace.endpos = [mid[0], mid[1], mid[2]];
			con.dPrint('backup past 0\n');
			return;
		}
		midf = p1f + (p2f - p1f) * frac;
		mid[0] = p1[0] + frac * (p2[0] - p1[0]);
		mid[1] = p1[1] + frac * (p2[1] - p1[1]);
		mid[2] = p1[2] + frac * (p2[2] - p1[2]);
	}

	trace.fraction = midf;
	trace.endpos = [mid[0], mid[1], mid[2]];
};

const clipMoveToEntity = function(ent, start, mins, maxs, end)
{
	var trace = {
		fraction: 1.0,
		allsolid: true,
		endpos: [end[0], end[1], end[2]],
		plane: {normal: [0.0, 0.0, 0.0], dist: 0.0}
	} as any
	var offset = [];
	var hull = hullForEntity(ent, mins, maxs, offset);
	recursiveHullCheck(hull, hull.firstclipnode, 0.0, 1.0,
		[start[0] - offset[0], start[1] - offset[1], start[2] - offset[2]],
		[end[0] - offset[0], end[1] - offset[1], end[2] - offset[2]], trace);
	if (trace.fraction !== 1.0)
	{
		trace.endpos[0] += offset[0];
		trace.endpos[1] += offset[1];
		trace.endpos[2] += offset[2];
	}
	if ((trace.fraction < 1.0) || (trace.startsolid === true))
		trace.ent = ent;
	return trace;
};

const clipToLinks = function(node, clip)
{
	var l, next, touch, solid, trace;
	for (l = node.solid_edicts.next; l !== node.solid_edicts; l = l.next)
	{
		touch = l.ent;
		solid = touch.v_float[pr.entvars.solid];
		if ((solid === SOLID.not) || (touch === clip.passedict))
			continue;
		if (solid === SOLID.trigger)
			sys.error('Trigger in clipping list');
		if ((clip.type === MOVE.nomonsters) && (solid !== SOLID.bsp))
			continue;
		if ((clip.boxmins[0] > touch.v_float[pr.entvars.absmax]) ||
			(clip.boxmins[1] > touch.v_float[pr.entvars.absmax1]) ||
			(clip.boxmins[2] > touch.v_float[pr.entvars.absmax2]) ||
			(clip.boxmaxs[0] < touch.v_float[pr.entvars.absmin]) ||
			(clip.boxmaxs[1] < touch.v_float[pr.entvars.absmin1]) ||
			(clip.boxmaxs[2] < touch.v_float[pr.entvars.absmin2]))
			continue;
		if (clip.passedict != null)
		{
			if ((clip.passedict.v_float[pr.entvars.size] !== 0.0) && (touch.v_float[pr.entvars.size] === 0.0))
				continue;
		}
		if (clip.trace.allsolid === true)
			return;
		if (clip.passedict != null)
		{
			if (state.server.edicts[touch.v_int[pr.entvars.owner]] === clip.passedict)
				continue;
			if (state.server.edicts[clip.passedict.v_int[pr.entvars.owner]] === touch)
				continue;
		}
		if ((touch.v_float[pr.entvars.flags] & FL.monster) !== 0)
			trace = clipMoveToEntity(touch, clip.start, clip.mins2, clip.maxs2, clip.end);
		else
			trace = clipMoveToEntity(touch, clip.start, clip.mins, clip.maxs, clip.end);
		if ((trace.allsolid === true) || (trace.startsolid === true) || (trace.fraction < clip.trace.fraction))
		{
			trace.ent = touch;
			clip.trace = trace;
			if (trace.startsolid === true)
				clip.trace.startsolid = true;
		}
	}
	if (node.axis === -1)
		return;
	if (clip.boxmaxs[node.axis] > node.dist)
		clipToLinks(node.children[0], clip);
	if (clip.boxmins[node.axis] < node.dist)
		clipToLinks(node.children[1], clip);
};

export const move = function(start, mins, maxs, end, type, passedict)
{
	var clip = {
		trace: clipMoveToEntity(state.server.edicts[0], start, mins, maxs, end),
		start: start,
		end: end,
		mins: mins,
		maxs: maxs,
		type: type,
		passedict: passedict,
		boxmins: [],
		boxmaxs: []
	} as any;
	if (type === MOVE.missile)
	{
		clip.mins2 = [-15.0, -15.0, -15.0];
		clip.maxs2 = [15.0, 15.0, 15.0];
	}
	else
	{
		clip.mins2 = [mins[0], mins[1], mins[2]];
		clip.maxs2 = [maxs[0], maxs[1], maxs[2]];
	}
	var i;
	for (i = 0; i <= 2; ++i)
	{
		if (end[i] > start[i])
		{
			clip.boxmins[i] = start[i] + clip.mins2[i] - 1.0;
			clip.boxmaxs[i] = end[i] + clip.maxs2[i] + 1.0;
			continue;
		}
		clip.boxmins[i] = end[i] + clip.mins2[i] - 1.0;
		clip.boxmaxs[i] = start[i] + clip.maxs2[i] + 1.0;
	}
	clipToLinks(state.areanodes[0], clip);
	return clip.trace;
};

export const runClients = async function()
{
	var i;
	for (i = 0; i < state.svs.maxclients; ++i)
	{
		host.state.client = state.svs.clients[i];
		if (host.state.client.active !== true)
			continue;
		state.player = host.state.client.edict;
		if (await readClientMessage() !== true)
		{
			await host.dropClient(false);
			continue;
		}
		if (host.state.client.spawned !== true)
		{
			host.state.client.cmd.forwardmove = 0.0;
			host.state.client.cmd.sidemove = 0.0;
			host.state.client.cmd.upmove = 0.0;
			continue;
		}
		clientThink();
	}
};

export const writeClientdataToMessage = function(ent, message)
{
	if ((ent.v_float[pr.entvars.dmg_take] !== 0.0) || (ent.v_float[pr.entvars.dmg_save] !== 0.0))
	{
		var other = state.server.edicts[ent.v_int[pr.entvars.dmg_inflictor]];
		msg.writeByte(message, protocol.SVC.damage);
		msg.writeByte(message, ent.v_float[pr.entvars.dmg_save]);
		msg.writeByte(message, ent.v_float[pr.entvars.dmg_take]);
		msg.writeCoord(message, other.v_float[pr.entvars.origin] + 0.5 * (other.v_float[pr.entvars.mins] + other.v_float[pr.entvars.maxs]));
		msg.writeCoord(message, other.v_float[pr.entvars.origin1] + 0.5 * (other.v_float[pr.entvars.mins1] + other.v_float[pr.entvars.maxs1]));
		msg.writeCoord(message, other.v_float[pr.entvars.origin2] + 0.5 * (other.v_float[pr.entvars.mins2] + other.v_float[pr.entvars.maxs2]));
		ent.v_float[pr.entvars.dmg_take] = 0.0;
		ent.v_float[pr.entvars.dmg_save] = 0.0;
	}

	setIdealPitch();

	if (ent.v_float[pr.entvars.fixangle] !== 0.0)
	{
		msg.writeByte(message, protocol.SVC.setangle);
		msg.writeAngle(message, ent.v_float[pr.entvars.angles]);
		msg.writeAngle(message, ent.v_float[pr.entvars.angles1]);
		msg.writeAngle(message, ent.v_float[pr.entvars.angles2]);
		ent.v_float[pr.entvars.fixangle] = 0.0;
	};

	var bits = protocol.SU.items + protocol.SU.weapon;
	if (ent.v_float[pr.entvars.view_ofs2] !== protocol.default_viewheight)
		bits += protocol.SU.viewheight;
	if (ent.v_float[pr.entvars.idealpitch] !== 0.0)
		bits += protocol.SU.idealpitch;

	var val = pr.entvars.items2, items;
	if (val != null)
	{
		if (ent.v_float[val] !== 0.0)
			items = (ent.v_float[pr.entvars.items] >> 0) + ((ent.v_float[val] << 23) >>> 0);
		else
			items = (ent.v_float[pr.entvars.items] >> 0) + ((pr.state.globals_float[pr.globalvars.serverflags] << 28) >>> 0);
	}
	else
		items = (ent.v_float[pr.entvars.items] >> 0) + ((pr.state.globals_float[pr.globalvars.serverflags] << 28) >>> 0);

	if (ent.v_float[pr.entvars.flags] & FL.onground)
		bits += protocol.SU.onground;
	if (ent.v_float[pr.entvars.waterlevel] >= 2.0)
		bits += protocol.SU.inwater;

	if (ent.v_float[pr.entvars.punchangle] !== 0.0)
		bits += protocol.SU.punch1;
	if (ent.v_float[pr.entvars.velocity] !== 0.0)
		bits += protocol.SU.velocity1;
	if (ent.v_float[pr.entvars.punchangle1] !== 0.0)
		bits += protocol.SU.punch2;
	if (ent.v_float[pr.entvars.velocity1] !== 0.0)
		bits += protocol.SU.velocity2;
	if (ent.v_float[pr.entvars.punchangle2] !== 0.0)
		bits += protocol.SU.punch3;
	if (ent.v_float[pr.entvars.velocity2] !== 0.0)
		bits += protocol.SU.velocity3;

	if (ent.v_float[pr.entvars.weaponframe] !== 0.0)
		bits += protocol.SU.weaponframe;
	if (ent.v_float[pr.entvars.armorvalue] !== 0.0)
		bits += protocol.SU.armor;

	msg.writeByte(message, protocol.SVC.clientdata);
	msg.writeShort(message, bits);
	if ((bits & protocol.SU.viewheight) !== 0)
		msg.writeChar(message, ent.v_float[pr.entvars.view_ofs2]);
	if ((bits & protocol.SU.idealpitch) !== 0)
		msg.writeChar(message, ent.v_float[pr.entvars.idealpitch]);

	if ((bits & protocol.SU.punch1) !== 0)
		msg.writeChar(message, ent.v_float[pr.entvars.punchangle]);
	if ((bits & protocol.SU.velocity1) !== 0)
		msg.writeChar(message, ent.v_float[pr.entvars.velocity] * 0.0625);
	if ((bits & protocol.SU.punch2) !== 0)
		msg.writeChar(message, ent.v_float[pr.entvars.punchangle1]);
	if ((bits & protocol.SU.velocity2) !== 0)
		msg.writeChar(message, ent.v_float[pr.entvars.velocity1] * 0.0625);
	if ((bits & protocol.SU.punch3) !== 0)
		msg.writeChar(message, ent.v_float[pr.entvars.punchangle2]);
	if ((bits & protocol.SU.velocity3) !== 0)
		msg.writeChar(message, ent.v_float[pr.entvars.velocity2] * 0.0625);

	msg.writeLong(message, items);
	if ((bits & protocol.SU.weaponframe) !== 0)
		msg.writeByte(message, ent.v_float[pr.entvars.weaponframe]);
	if ((bits & protocol.SU.armor) !== 0)
		msg.writeByte(message, ent.v_float[pr.entvars.armorvalue]);
	msg.writeByte(message, modelIndex(pr.getString(ent.v_int[pr.entvars.weaponmodel])));
	msg.writeShort(message, ent.v_float[pr.entvars.health]);
	msg.writeByte(message, ent.v_float[pr.entvars.currentammo]);
	msg.writeByte(message, ent.v_float[pr.entvars.ammo_shells]);
	msg.writeByte(message, ent.v_float[pr.entvars.ammo_nails]);
	msg.writeByte(message, ent.v_float[pr.entvars.ammo_rockets]);
	msg.writeByte(message, ent.v_float[pr.entvars.ammo_cells]);
	if (com.state.standard_quake === true)
		msg.writeByte(message, ent.v_float[pr.entvars.weapon]);
	else
	{
		var i, weapon = ent.v_float[pr.entvars.weapon];
		for (i = 0; i <= 31; ++i)
		{
			if ((weapon & (1 << i)) !== 0)
			{
				msg.writeByte(message, i);
				break;
			}
		}
	}
};

export const saveSpawnparms = async function()
{
	state.svs.serverflags = pr.state.globals_float[pr.globalvars.serverflags];
	var i, j;
	for (i = 0; i < state.svs.maxclients; ++i)
	{
		host.state.client = state.svs.clients[i];
		if (host.state.client.active !== true)
			continue;
		pr.state.globals_int[pr.globalvars.self] = host.state.client.edict.num;
		await pr.executeProgram(pr.state.globals_int[pr.globalvars.SetChangeParms]);
		for (j = 0; j <= 15; ++j)
			host.state.client.spawn_parms[j] = pr.state.globals_float[pr.globalvars.parms + j];
	}
};

export const spawnServer = async function(server)
{
	var i;

	if (net.cvr.hostname.string.length === 0)
		cvar.set('hostname', 'UNNAMED');

	scr.state.centertime_off = 0.0;

	con.dPrint('SpawnServer: ' + server + '\n');
	state.svs.changelevel_issued = false;

	if (state.server.active === true)
	{
		net.sendToAll(state.reconnect);
		await cmd.executeString('reconnect\n', undefined);
	}

	if (host.cvr.coop.value !== 0)
		cvar.setValue('deathmatch', 0);
	host.state.current_skill = Math.floor(host.cvr.skill.value + 0.5);
	if (host.state.current_skill < 0)
		host.state.current_skill = 0;
	else if (host.state.current_skill > 3)
		host.state.current_skill = 3;
	cvar.setValue('skill', host.state.current_skill);

	con.dPrint('Clearing memory\n');
	mod.clearAll();

	await pr.loadProgs();

	state.server.edicts = [];
	var _ed;
	for (i = 0; i < def.max_edicts; ++i)
	{
		_ed = {
			num: i,
			free: false,
			area: {},
			leafnums: [],
			baseline: {
				origin: [0.0, 0.0, 0.0],
				angles: [0.0, 0.0, 0.0],
				modelindex: 0,
				frame: 0,
				colormap: 0,
				skin: 0,
				effects: 0
			},
			freetime: 0.0,
			v: new ArrayBuffer(pr.state.entityfields << 2)
		};
		_ed.area.ent = _ed;
		_ed.v_float = new Float32Array(_ed.v);
		_ed.v_int = new Int32Array(_ed.v);
		state.server.edicts[i] = _ed;
	}

	state.server.datagram.cursize = 0;
	state.server.reliable_datagram.cursize = 0;
	state.server.signon.cursize = 0;
	state.server.num_edicts = state.svs.maxclients + 1;
	for (i = 0; i < state.svs.maxclients; ++i)
		state.svs.clients[i].edict = state.server.edicts[i + 1];
	state.server.loading = true;
	state.server.paused = false;
	state.server.loadgame = false;
	state.server.time = 1.0;
	state.server.lastcheck = 0;
	state.server.lastchecktime = 0.0;
	state.server.modelname = 'maps/' + server + '.bsp';
	state.server.worldmodel = await mod.forName(state.server.modelname, false);
	if (state.server.worldmodel == null)
	{
		con.print('Couldn\'t spawn server ' + state.server.modelname + '\n');
		state.server.active = false;
		return;
	}
	state.server.models = [];
	state.server.models[1] = state.server.worldmodel;

	state.areanodes = [];
	createAreaNode(0, state.server.worldmodel.mins, state.server.worldmodel.maxs);

	state.server.sound_precache = [''];
	state.server.model_precache = ['', state.server.modelname];
	for (i = 1; i <= state.server.worldmodel.submodels.length; ++i)
	{
		state.server.model_precache[i + 1] = '*' + i;
		state.server.models[i + 1] = await mod.forName('*' + i, false);
	}

	state.server.lightstyles = [];
	for (i = 0; i <= 63; ++i)
		state.server.lightstyles[i] = '';

	var ent = state.server.edicts[0];
	ent.v_int[pr.entvars.model] = pr.newString(state.server.modelname, 64);
	ent.v_float[pr.entvars.modelindex] = 1.0;
	ent.v_float[pr.entvars.solid] = SOLID.bsp;
	ent.v_float[pr.entvars.movetype] = MOVE_TYPE.push;

	if (host.cvr.coop.value !== 0)
		pr.state.globals_float[pr.globalvars.coop] = host.cvr.coop.value;
	else
		pr.state.globals_float[pr.globalvars.deathmatch] = host.cvr.deathmatch.value;

	pr.state.globals_int[pr.globalvars.mapname] = pr.newString(server, 64);
	pr.state.globals_float[pr.globalvars.serverflags] = state.svs.serverflags;
	await ed.loadFromFile(state.server.worldmodel.entities);
	state.server.active = true;
	state.server.loading = false;
	host.state.frametime = 0.1;
	
	await physics();
	await physics();
	createBaseline();
	for (i = 0; i < state.svs.maxclients; ++i)
	{
		host.state.client = state.svs.clients[i];
		if (host.state.client.active !== true)
			continue;
		host.state.client.edict.v_int[pr.entvars.netname] = pr.state.netnames + (i << 5);
		sendServerinfo(host.state.client);
	}
	net.registerWithMaster()
	con.dPrint('Server spawned.\n');
};

export const sendClientMessages = async function()
{
	updateToReliableMessages();
	var i, client;
	for (i = 0; i < state.svs.maxclients; ++i)
	{
		host.state.client = client = state.svs.clients[i];
		if (client.active !== true)
			continue;
		if (client.spawned === true)
		{
			if (await sendClientDatagram() !== true)
				continue;
		}
		else if (client.sendsignon !== true)
		{
			if ((host.state.realtime - client.last_message) > 5.0)
			{
				if (net.sendUnreliableMessage(client.netconnection, state.nop) === -1)
					await host.dropClient(true);
				client.last_message = host.state.realtime;
			}
			continue;
		}
		if (client.message.overflowed === true)
		{
			await host.dropClient(true);
			client.message.overflowed = false;
			continue;
		}
		if (client.dropasap === true)
		{
			if (net.canSendMessage(client.netconnection) === true)
				await host.dropClient(false);
		}
		else if (client.message.cursize !== 0)
		{
			if (net.canSendMessage(client.netconnection) !== true)
				continue;
			if (net.sendMessage(client.netconnection, client.message) === -1)
				await host.dropClient(true);
			client.message.cursize = 0;
			client.last_message = host.state.realtime;
			client.sendsignon = false;
		}
	}

	for (i = 1; i < state.server.num_edicts; ++i)
		state.server.edicts[i].v_float[pr.entvars.effects] &= (~mod.EFFECTS.muzzleflash >>> 0);
};
export const physics = async function()
{
	pr.state.globals_int[pr.globalvars.self] = 0;
	pr.state.globals_int[pr.globalvars.other] = 0;
	pr.state.globals_float[pr.globalvars.time] = state.server.time;
	await pr.executeProgram(pr.state.globals_int[pr.globalvars.StartFrame]);
	var i, ent;
	for (i = 0; i < state.server.num_edicts; ++i)
	{
		ent = state.server.edicts[i];
		if (ent.free === true)
			continue;
		if (pr.state.globals_float[pr.globalvars.force_retouch] !== 0.0)
			await linkEdict(ent, true);
		if ((i > 0) && (i <= state.svs.maxclients))
		{
			await physics_Client(ent);
			continue;
		}
		switch (ent.v_float[pr.entvars.movetype])
		{
		case MOVE_TYPE.push:
			await physics_Pusher(ent);
			continue;
		case MOVE_TYPE.none:
			await runThink(ent);
			continue;
		case MOVE_TYPE.noclip:
			await runThink(ent);
			continue;
		case MOVE_TYPE.step:
			await physics_Step(ent);
			continue;
		case MOVE_TYPE.toss:
		case MOVE_TYPE.bounce:
		case MOVE_TYPE.fly:
		case MOVE_TYPE.flymissile:
			await physics_Toss(ent);
			continue;
		}
		sys.error('SV.Physics: bad movetype ' + (ent.v_float[pr.entvars.movetype] >> 0));
	}
	if (pr.state.globals_float[pr.globalvars.force_retouch] !== 0.0)
		--pr.state.globals_float[pr.globalvars.force_retouch];
	state.server.time += host.state.frametime;
};

export const checkForNewClients = async function()
{
	var ret, i;
	for (;;)
	{
		ret = net.checkNewConnections();
		if (ret == null)
			return;
		for (i = 0; i < state.svs.maxclients; ++i)
		{
			if (state.svs.clients[i].active !== true)
				break;
		}
		if (i === state.svs.maxclients)
			sys.error('SV.CheckForNewClients: no free clients');
		state.svs.clients[i].netconnection = ret;
		await connectClient(i);
		++net.state.activeconnections;
	}
};

export const setClientName = function(client, name)
{
	var ofs = pr.state.netnames + (client.num << 5), i;
	for (i = 0; i < name.length; ++i)
		pr.state.strings[ofs + i] = name.charCodeAt(i);
	pr.state.strings[ofs + i] = 0;
};

export const getClientName = function(client)
{
	return pr.getString(pr.state.netnames + (client.num << 5));
};

export const init = function()
{
	initState()
	cvr.maxvelocity = cvar.registerVariable('sv_maxvelocity', '2000');
	cvr.gravity = cvar.registerVariable('sv_gravity', '800', false, true);
	cvr.friction = cvar.registerVariable('sv_friction', '4', false, true);
	cvr.edgefriction = cvar.registerVariable('edgefriction', '2');
	cvr.stopspeed = cvar.registerVariable('sv_stopspeed', '100');
	cvr.maxspeed = cvar.registerVariable('sv_maxspeed', '320', false, true);
	cvr.accelerate = cvar.registerVariable('sv_accelerate', '10');
	cvr.idealpitchscale = cvar.registerVariable('sv_idealpitchscale', '0.8');
	cvr.aim = cvar.registerVariable('sv_aim', '0.93');
	cvr.nostep = cvar.registerVariable('sv_nostep', '0');

	(new Uint8Array(state.nop.data))[0] = protocol.SVC.nop;
	msg.writeByte(state.reconnect, protocol.SVC.stufftext);
	msg.writeString(state.reconnect, 'reconnect\n');

	initBoxHull();
};