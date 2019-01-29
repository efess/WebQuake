import * as cmd from './cmd'
import * as host from './host'
import * as con from './console'
import * as mod from './mod'
import * as msg from './msg'
import * as com from './com'
import * as def from './def'
import * as sv from './sv'
import * as chase from './chase'
import * as sys from './sys'
import * as v from './v'
import * as net from './net/index'
import * as cvar from './cvar'
import * as scr from './scr'
import * as r from './r'
import * as s from './s'
import * as cdAudio from './cdAudio'
import * as input from './input'
import * as protocol from './protocol'
import * as q from './q'
import * as vec from './vec'
import * as webs from './net/webs'

export const cls = {
  state: 0,
  spawnparms: '',
  demonum: 0,
  message: {data: new ArrayBuffer(8192), cursize: 0}
} as any

export const clState = {
} as any

export const state = {
  static_entities: [],
  visedicts: [],
  kbuttons: [],
  // parse
  lastmsg: 0.0,
  // tent
  temp_entities: [],
  sendmovebuf: {data: new ArrayBuffer(16), cursize: 0}
} as any;

export const cvr = {
} as any

export const CSHIFT = {
	contents: 0,
	damage: 1,
	bonus: 2,
	powerup: 3
};

export const ACTIVE = {
	disconnected: 0,
	connecting: 1,
	connected: 2
};

export const KBUTTON = {
	mlook: 0,
	klook: 1,
	left: 2,
	right: 3,
	forward: 4,
	back: 5,
	lookup: 6,
	lookdown: 7,
	moveleft: 8,
	moveright: 9,
	strafe: 10,
	speed: 11,
	use: 12,
	jump: 13,
	attack: 14,
	moveup: 15,
	movedown: 16,
	num: 17
};

const SVC_STRINGS = [
	'bad',
	'nop',
	'disconnect',
	'updatestat',
	'version',
	'setview',
	'sound',
	'time',
	'print',
	'stufftext',
	'setangle',
	'serverinfo',
	'lightstyle',
	'updatename',
	'updatefrags',
	'clientdata',
	'stopsound',
	'updatecolors',
	'particle',
	'damage',
	'spawnstatic',
	'OBSOLETE spawnbinary',
	'spawnbaseline',
	'temp_entity',
	'setpause',
	'signonnum',
	'centerprint',
	'killedmonster',
	'foundsecret',
	'spawnstaticsound',
	'intermission',
	'finale',
	'cdtrack',
	'sellscreen',
	'cutscene'
];

// demo

export const stopPlayback = function()
{
	if (cls.demoplayback !== true)
		return;
	cls.demoplayback = false;
	cls.demofile = null;
	cls.state = ACTIVE.disconnected;
	if (cls.timedemo === true)
		finishTimeDemo();
};

export const writeDemoMessage = function()
{
	var len = cls.demoofs + 16 + net.state.message.cursize;
	if (cls.demofile.byteLength < len)
	{
		var src = new Uint8Array(cls.demofile, 0, cls.demoofs);
		cls.demofile = new ArrayBuffer(cls.demofile.byteLength + 16384);
		(new Uint8Array(cls.demofile)).set(src);
	}
	var f = new DataView(cls.demofile, cls.demoofs, 16);
	f.setInt32(0, net.state.message.cursize, true);
	f.setFloat32(4, state.clState.viewangles[0], true);
	f.setFloat32(8, clState.viewangles[1], true);
	f.setFloat32(12, clState.viewangles[2], true);
	(new Uint8Array(cls.demofile)).set(new Uint8Array(net.state.message.data, 0, net.state.message.cursize), cls.demoofs + 16);
	cls.demoofs = len;
};

export const getMessage = function()
{
	if (cls.demoplayback === true)
	{
		if (cls.signon === 4)
		{
			if (cls.timedemo === true)
			{
				if (host.state.framecount === cls.td_lastframe)
					return 0;
				cls.td_lastframe = host.state.framecount;
				if (host.state.framecount === (cls.td_startframe + 1))
					cls.td_starttime = host.state.realtime;
			}
			else if (clState.time <= clState.mtime[0])
				return 0;
		}
		if ((cls.demoofs + 16) >= cls.demosize)
		{
			stopPlayback();
			return 0;
		}
		var view = new DataView(cls.demofile);
		net.state.message.cursize = view.getUint32(cls.demoofs, true);
		if (net.state.message.cursize > 8000)
			sys.error('Demo message > MAX_MSGLEN');
		clState.mviewangles[1] = clState.mviewangles[0];
		clState.mviewangles[0] = [view.getFloat32(cls.demoofs + 4, true), view.getFloat32(cls.demoofs + 8, true), view.getFloat32(cls.demoofs + 12, true)];
		cls.demoofs += 16;
		if ((cls.demoofs + net.state.message.cursize) > cls.demosize)
		{
			stopPlayback();
			return 0;
		}
		var src = new Uint8Array(cls.demofile, cls.demoofs, net.state.message.cursize);
		var dest = new Uint8Array(net.state.message.data, 0, net.state.message.cursize);
		var i;
		for (i = 0; i < net.state.message.cursize; ++i)
			dest[i] = src[i];
		cls.demoofs += net.state.message.cursize;
		return 1;
	};

	var r;
	for (;;)
	{
		r = net.getMessage(cls.netcon);
		if ((r !== 1) && (r !== 2))
			return r;
		if ((net.state.message.cursize === 1) && ((new Uint8Array(net.state.message.data, 0, 1))[0] === protocol.SVC.nop))
			con.print('<-- server to client keepalive\n');
		else
			break;
	}

	if (cls.demorecording === true)
		writeDemoMessage();

	return r;
};

export const stop_f = function()
{
	if (cmd.state.client === true)
		return;
	if (cls.demorecording !== true)
	{
		con.print('Not recording a demo.\n');
		return;
	}
	net.state.message.cursize = 0;
	msg.writeByte(net.state.message, protocol.SVC.disconnect);
	writeDemoMessage();
	if (com.writeFile(cls.demoname, new Uint8Array(cls.demofile), cls.demoofs) !== true)
		con.print('ERROR: couldn\'t open.\n');
	cls.demofile = null;
	cls.demorecording = false;
	con.print('Completed demo\n');
};

export const record_f = async function()
{
	var c = cmd.state.argv.length;
	if ((c <= 1) || (c >= 5))
	{
		con.print('record <demoname> [<map> [cd track]]\n');
		return;
	}
	if (cmd.state.argv[1].indexOf('..') !== -1)
	{
		con.print('Relative pathnames are not allowed.\n');
		return;
	}
	if ((c === 2) && (cls.state === ACTIVE.connected))
	{
		con.print('Can not record - already connected to server\nClient demo recording must be started before connecting\n');
		return;
	}
	if (c === 4)
	{
		cls.forcetrack = q.atoi(cmd.state.argv[3]);
		con.print('Forcing CD track to ' + cls.forcetrack);
	}
	else
		cls.forcetrack = -1;
	cls.demoname = com.defaultExtension(cmd.state.argv[1], '.dem');
	if (c >= 3)
		await cmd.executeString('map ' + cmd.state.argv[2]);
	con.print('recording to ' + cls.demoname + '.\n');
	cls.demofile = new ArrayBuffer(16384);
	var track = cls.forcetrack.toString() + '\n';
	var i, dest = new Uint8Array(cls.demofile, 0, track.length);
	for (i = 0; i < track.length; ++i)
		dest[i] = track.charCodeAt(i);
	cls.demoofs = track.length;
	cls.demorecording = true;
};

export const playDemo_f = async function()
{
	if (cmd.state.client === true)
		return;
	if (cmd.state.argv.length !== 2)
	{
		con.print('playdemo <demoname> : plays a demo\n');
		return;
	}
	await disconnect();
	var name = com.defaultExtension(cmd.state.argv[1], '.dem');
	con.print('Playing demo from ' + name + '.\n');
	var demofile = await com.loadFile(name) as any;
	if (demofile == null)
	{
		con.print('ERROR: couldn\'t open.\n');
		cls.demonum = -1;
		scr.state.disabled_for_loading = false;
		return;
	}
	cls.demofile = demofile;
	demofile = new Uint8Array(demofile);
	cls.demosize = demofile.length;
	cls.demoplayback = true;
	cls.state = ACTIVE.connected;
	cls.forcetrack = 0;
	var i, c, neg;
	for (i = 0; i < demofile.length; ++i)
	{
		c = demofile[i];
		if (c === 10)
			break;
		if (c === 45)
			neg = true;
		else
			cls.forcetrack = cls.forcetrack * 10 + c - 48;
	}
	if (neg === true)
		cls.forcetrack = -cls.forcetrack;
	cls.demoofs = i + 1;
};

export const finishTimeDemo = function()
{
	cls.timedemo = false;
	var frames = host.state.framecount - cls.td_startframe - 1;
	var time = host.state.realtime - cls.td_starttime;
	if (time === 0.0)
		time = 1.0;
	con.print(frames + ' frames ' + time.toFixed(1) + ' seconds ' + (frames / time).toFixed(1) + ' fps\n');
};

export const timeDemo_f = async function()
{
	if (cmd.state.client === true)
		return;
	if (cmd.state.argv.length !== 2)
	{
		con.print('timedemo <demoname> : gets demo speeds\n');
		return;
	}
	await playDemo_f();
	cls.timedemo = true;
	cls.td_startframe = host.state.framecount;
	cls.td_lastframe = -1;
};

// input

export const keyDown = function()
{
	var b = KBUTTON[cmd.state.argv[0].substring(1)];
	if (b == null)
		return;
	b = state.kbuttons[b];

	var k;
	if (cmd.state.argv[1] != null)
		k = q.atoi(cmd.state.argv[1]);
	else
		k = -1;

	if ((k === b.down[0]) || (k === b.down[1]))
		return;

	if (b.down[0] === 0)
		b.down[0] = k;
	else if (b.down[1] === 0)
		b.down[1] = k;
	else
	{
		con.print('Three keys down for a button!\n');
		return;
	}

	if ((b.state & 1) === 0)
		b.state |= 3;
};

export const keyUp = function()
{
	var b = KBUTTON[cmd.state.argv[0].substring(1)];
	if (b == null)
		return;
	b = state.kbuttons[b];

	var k;
	if (cmd.state.argv[1] != null)
		k = q.atoi(cmd.state.argv[1]);
	else
	{
		b.down[0] = b.down[1] = 0;
		b.state = 4;
		return;
	}

	if (b.down[0] === k)
		b.down[0] = 0;
	else if (b.down[1] === k)
		b.down[1] = 0;
	else
		return;
	if ((b.down[0] !== 0) || (b.down[1] !== 0))
		return;

	if ((b.state & 1) !== 0)
		b.state = (b.state - 1) | 4;
};

export const mLookUp = function()
{
	keyUp();
	if (((state.kbuttons[KBUTTON.mlook].state & 1) === 0) && (cvr.lookspring.value !== 0))
		v.startPitchDrift();
};

export const impulse = function()
{
	state.impulse = q.atoi(cmd.state.argv[1]);
};

export const keyState = function(key)
{
	key = state.kbuttons[key];
	var down = key.state & 1;
	key.state &= 1;
	if ((key.state & 2) !== 0)
	{
		if ((key.state & 4) !== 0)
			return (down !== 0) ? 0.75 : 0.25;
		return (down !== 0) ? 0.5 : 0.0;
	}
	if ((key.state & 4) !== 0)
		return 0.0;
	return (down !== 0) ? 1.0 : 0.0;
};

export const adjustAngles = function()
{
	var speed = host.state.frametime;
	if ((state.kbuttons[KBUTTON.speed].state & 1) !== 0)
		speed *= cvr.anglespeedkey.value;

	var angles = clState.viewangles;

	if ((state.kbuttons[KBUTTON.strafe].state & 1) === 0)
	{
		angles[1] += speed * cvr.yawspeed.value * (keyState(KBUTTON.left) - keyState(KBUTTON.right));
		angles[1] = vec.anglemod(angles[1]);
	}
	if ((state.kbuttons[KBUTTON.klook].state & 1) !== 0)
	{
		v.stopPitchDrift();
		angles[0] += speed * cvr.pitchspeed.value * (keyState(KBUTTON.back) - keyState(KBUTTON.forward));
	}

	var up = keyState(KBUTTON.lookup), down = keyState(KBUTTON.lookdown);
	if ((up !== 0.0) || (down !== 0.0))
	{
		angles[0] += speed * cvr.pitchspeed.value * (down - up);
		v.stopPitchDrift();
	}

	if (angles[0] > 80.0)
		angles[0] = 80.0;
	else if (angles[0] < -70.0)
		angles[0] = -70.0;

	if (angles[2] > 50.0)
		angles[2] = 50.0;
	else if (angles[2] < -50.0)
		angles[2] = -50.0;
};

export const baseMove = function()
{
	if (cls.signon !== 4)
		return;

	adjustAngles();

	var cmd = clState.cmd;

	cmd.sidemove = cvr.sidespeed.value * (keyState(KBUTTON.moveright) - keyState(KBUTTON.moveleft));
	if ((state.kbuttons[KBUTTON.strafe].state & 1) !== 0)
		cmd.sidemove += cvr.sidespeed.value * (keyState(KBUTTON.right) - keyState(KBUTTON.left));

	cmd.upmove = cvr.upspeed.value * (keyState(KBUTTON.moveup) - keyState(KBUTTON.movedown));

	if ((state.kbuttons[KBUTTON.klook].state & 1) === 0)
		cmd.forwardmove = cvr.forwardspeed.value * keyState(KBUTTON.forward) - cvr.backspeed.value * keyState(KBUTTON.back);
	else
		cmd.forwardmove = 0.0;

	if ((state.kbuttons[KBUTTON.speed].state & 1) !== 0)
	{
		cmd.forwardmove *= cvr.movespeedkey.value;
		cmd.sidemove *= cvr.movespeedkey.value;
		cmd.upmove *= cvr.movespeedkey.value;
	}
};

export const sendMove = async function()
{
	var buf = state.sendmovebuf;
	buf.cursize = 0;
	msg.writeByte(buf, protocol.CLC.move);
	msg.writeFloat(buf, clState.mtime[0]);
	msg.writeAngle(buf, clState.viewangles[0]);
	msg.writeAngle(buf, clState.viewangles[1]);
	msg.writeAngle(buf, clState.viewangles[2]);
	msg.writeShort(buf, clState.cmd.forwardmove);
	msg.writeShort(buf, clState.cmd.sidemove);
	msg.writeShort(buf, clState.cmd.upmove);
	var bits = 0;
	if ((state.kbuttons[KBUTTON.attack].state & 3) !== 0)
		bits += 1;
	state.kbuttons[KBUTTON.attack].state &= 5;
	if ((state.kbuttons[KBUTTON.jump].state & 3) !== 0)
		bits += 2;
	state.kbuttons[KBUTTON.jump].state &= 5;
	msg.writeByte(buf, bits);
	msg.writeByte(buf, state.impulse);
	state.impulse = 0;
	if (cls.demoplayback === true)
		return;
	if (++clState.movemessages <= 2)
		return;
	if (net.sendUnreliableMessage(cls.netcon, buf) === -1)
	{
		con.print('CL.SendMove: lost server connection\n');
		await disconnect();
	}
};

export const initInput = function()
{
	var i;

	var commands = ['moveup', 'movedown', 'left', 'right',
		'forward', 'back', 'lookup', 'lookdown',
		'strafe', 'moveleft', 'moveright', 'speed',
		'attack', 'use', 'jump', 'klook'
	];
	for (i = 0; i < commands.length; ++i)
	{
		cmd.addCommand('+' + commands[i], keyDown);
		cmd.addCommand('-' + commands[i], keyUp);
	}
	cmd.addCommand('impulse', impulse);
	cmd.addCommand('+mlook', keyDown);
	cmd.addCommand('-mlook', mLookUp);

	for (i = 0; i < KBUTTON.num; ++i)
		state.kbuttons[i] = {down: [0, 0], state: 0};
};

// main

export const rcon_f = function()
{
	if (cvr.rcon_password.string.length === 0)
	{
		con.print('You must set \'rcon_password\' before\nissuing an rcon command.\n');
		return;
	}
	var to;
	if ((cls.state === ACTIVE.connected) && (cls.netcon != null))
	{
		if (net.state.drivers[cls.netcon.driver] === webs)
			to = cls.netcon.address.substring(5);
	}
	if (to == null)
	{
		if (cvr.rcon_address.string.length === 0)
		{
			con.print('You must either be connected,\nor set the \'rcon_address\' cvar\nto issue rcon commands\n');
			return;
		}
		to = cvr.rcon_address.string;
	}
	var pw;
	try
	{
		pw = btoa('quake:' + cvr.rcon_password.string);
	}
	catch (e)
	{
		return;
	}
	var message = '', i;
	for (i = 1; i < cmd.state.argv.length; ++i)
		message += cmd.state.argv[i] + ' ';
	try
	{
		message = encodeURIComponent(message);
	}
	catch (e)
	{
		return;
	}
	var xhr = new XMLHttpRequest();
	xhr.open('HEAD', 'http://' + to + '/rcon/' + message);
	xhr.setRequestHeader('Authorization', 'Basic ' + pw);
	xhr.send();
};

export const clearState = function()
{
	if (sv.state.server.active !== true)
	{
		con.dPrint('Clearing memory\n');
		mod.clearAll();
		cls.signon = 0;
	}

  Object.keys(clState).forEach(function(key) {
    delete clState[key];
  });

	clState.movemessages = 0
	clState.cmd = {
    forwardmove: 0.0,
    sidemove: 0.0,
    upmove: 0.0
  }
	clState.stats = [
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0
  ]
  clState.items = 0
  clState.item_gettime = [
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
  ]
  clState.faceanimtime = 0.0
  clState.cshifts = [[0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0]]
  clState.mviewangles = [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0]]
  clState.viewangles = [0.0, 0.0, 0.0]
  clState.mvelocity = [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0]]
  clState.velocity = [0.0, 0.0, 0.0]
  clState.punchangle = [0.0, 0.0, 0.0]
  clState.idealpitch = 0.0
  clState.pitchvel = 0.0
  clState.driftmove = 0.0
  clState.laststop = 0.0
  clState.crouch = 0.0
  clState.intermission = 0
  clState.completed_time = 0
  clState.mtime = [0.0, 0.0]
  clState.time = 0.0
  clState.oldtime = 0.0
  clState.last_received_message = 0.0
  clState.viewentity = 0
  clState.num_statics = 0
  clState.viewent = {num: -1, origin: [0.0, 0.0, 0.0], angles: [0.0, 0.0, 0.0], skinnum: 0}
  clState.cdtrack = 0
  clState.looptrack = 0

	cls.message.cursize = 0;

	state.entities = [];
	
	var i;

	state.dlights = [];
	for (i = 0; i <= 31; ++i)
		state.dlights[i] = {radius: 0.0, die: 0.0};

	state.lightstyle = [];
	for (i = 0; i <= 63; ++i)
		state.lightstyle[i] = '';

	state.beams = [];
	for (i = 0; i <= 23; ++i)
		state.beams[i] = {endtime: 0.0};
};

export const disconnect = async function()
{
	s.stopAllSounds();
	if (cls.demoplayback === true)
		stopPlayback();
	else if (cls.state === ACTIVE.connected)
	{
		if (cls.demorecording === true)
			stop_f();
		con.dPrint('Sending clc_disconnect\n');
		cls.message.cursize = 0;
		msg.writeByte(cls.message, protocol.CLC.disconnect);
		net.sendUnreliableMessage(cls.netcon, cls.message);
		cls.message.cursize = 0;
		net.close(cls.netcon);
		cls.state = ACTIVE.disconnected;
		if (sv.state.server.active === true)
			await host.shutdownServer();
	}
	cls.demoplayback = cls.timedemo = false;
	cls.signon = 0;
};

export const connect = function(sock)
{
	cls.netcon = sock;
	con.dPrint('CL.Connect: connected to ' + state.host + '\n');
	cls.demonum = -1;
	cls.state = ACTIVE.connected;
	cls.signon = 0;
};

export const establishConnection = async function(host)
{
	if (cls.demoplayback === true)
		return;
	await disconnect();
	state.host = host;
	var sock = net.connect(host);
	if (sock == null)
		await host.error('CL.EstablishConnection: connect failed\n');
	connect(sock);
};

export const signonReply = function()
{
	con.dPrint('CL.SignonReply: ' + cls.signon + '\n');
	switch (cls.signon)
	{
	case 1:
		msg.writeByte(cls.message, protocol.CLC.stringcmd);
		msg.writeString(cls.message, 'prespawn');
		return;
	case 2:
		msg.writeByte(cls.message, protocol.CLC.stringcmd);
		msg.writeString(cls.message, 'name "' + cvr.name.string + '"\n');
		msg.writeByte(cls.message, protocol.CLC.stringcmd);
		msg.writeString(cls.message, 'color ' + (cvr.color.value >> 4) + ' ' + (cvr.color.value & 15) + '\n');
		msg.writeByte(cls.message, protocol.CLC.stringcmd);
		msg.writeString(cls.message, 'spawn ' + cls.spawnparms);
		return;
	case 3:
		msg.writeByte(cls.message, protocol.CLC.stringcmd);
		msg.writeString(cls.message, 'begin');
		return;
	case 4:
		scr.endLoadingPlaque();
	}
};

export const nextDemo = function()
{
	if (cls.demonum === -1)
		return;
	scr.beginLoadingPlaque();
	if (cls.demonum >= cls.demos.length)
	{
		if (cls.demos.length === 0)
		{
			con.print('No demos listed with startdemos\n');
			cls.demonum = -1;
			return;
		}
		cls.demonum = 0;
	}
	cmd.state.text = 'playdemo ' + cls.demos[cls.demonum++] + '\n' + cmd.state.text;
};

export const printEntities_f = function()
{
	var i, ent;
	for (i = 0; i < state.entities.length; ++i)
	{
		ent = state.entities[i];
		if (i <= 9)
			con.print('  ' + i + ':');
		else if (i <= 99)
			con.print(' ' + i + ':');
		else
			con.print(i + ':');
		if (ent.model == null)
		{
			con.print('EMPTY\n');
			continue;
		}
		con.print(ent.model.name + (ent.frame <= 9 ? ': ' : ':') + ent.frame +
			'  (' + ent.origin[0].toFixed(1) + ',' + ent.origin[1].toFixed(1) + ',' + ent.origin[2].toFixed(1) +
			') [' + ent.angles[0].toFixed(1) + ' ' + ent.angles[1].toFixed(1) + ' ' + ent.angles[2].toFixed(1) + ']\n');
	}
};

export const allocDlight = function(key)
{
	var i, dl;
	if (key !== 0)
	{
		for (i = 0; i <= 31; ++i)
		{
			if (state.dlights[i].key === key)
			{
				dl = state.dlights[i];
				break;
			}
		}
	}
	if (dl == null)
	{
		for (i = 0; i <= 31; ++i)
		{
			if (state.dlights[i].die < clState.time)
			{
				dl = state.dlights[i];
				break;
			}
		}
		if (dl == null)
			dl = state.dlights[0];
	}
	dl.origin = [0.0, 0.0, 0.0];
	dl.radius = 0.0;
	dl.die = 0.0;
	dl.decay = 0.0;
	dl.minlight = 0.0;
	dl.key = key;
	return dl;
};

export const decayLights = function()
{
	var i, dl, time = clState.time - clState.oldtime;
	for (i = 0; i <= 31; ++i)
	{
		dl = state.dlights[i];
		if ((dl.die < clState.time) || (dl.radius === 0.0))
			continue;
		dl.radius -= time * dl.decay;
		if (dl.radius < 0.0)
			dl.radius = 0.0;
	}
}

export const lerpPoint = function()
{
	var f = clState.mtime[0] - clState.mtime[1];
	if ((f === 0.0) || (cvr.nolerp.value !== 0) || (cls.timedemo === true) || (sv.state.server.active === true))
	{
		clState.time = clState.mtime[0];
		return 1.0;
	}
	if (f > 0.1)
	{
		clState.mtime[1] = clState.mtime[0] - 0.1;
		f = 0.1;
	}
	var frac = (clState.time - clState.mtime[1]) / f;
	if (frac < 0.0)
	{
		if (frac < -0.01)
			clState.time = clState.mtime[1];
		return 0.0;
	}
	if (frac > 1.0)
	{
		if (frac > 1.01)
			clState.time = clState.mtime[0];
		return 1.0;
	}
	return frac;
};

export const relinkEntities = function()
{
	var i, j;
	var frac = lerpPoint(), f, d, delta = [];

	state.numvisedicts = 0;

	clState.velocity[0] = clState.mvelocity[1][0] + frac * (clState.mvelocity[0][0] - clState.mvelocity[1][0]);
	clState.velocity[1] = clState.mvelocity[1][1] + frac * (clState.mvelocity[0][1] - clState.mvelocity[1][1]);
	clState.velocity[2] = clState.mvelocity[1][2] + frac * (clState.mvelocity[0][2] - clState.mvelocity[1][2]);

	if (cls.demoplayback === true)
	{
		for (i = 0; i <= 2; ++i)
		{
			d = clState.mviewangles[0][i] - clState.mviewangles[1][i];
			if (d > 180.0)
				d -= 360.0;
			else if (d < -180.0)
				d += 360.0;
			clState.viewangles[i] = clState.mviewangles[1][i] + frac * d;
		}
	}

	var bobjrotate = vec.anglemod(100.0 * clState.time);
	var ent, oldorg = [], dl;
	for (i = 1; i < state.entities.length; ++i)
	{
		ent = state.entities[i];
		if (ent.model == null)
			continue;
		if (ent.msgtime !== clState.mtime[0])
		{
			ent.model = null;
			continue;
		}
		oldorg[0] = ent.origin[0];
		oldorg[1] = ent.origin[1];
		oldorg[2] = ent.origin[2];
		if (ent.forcelink === true)
		{
			vec.copy(ent.msg_origins[0], ent.origin);
			vec.copy(ent.msg_angles[0], ent.angles);
		}
		else
		{
			f = frac;
			for (j = 0; j <= 2; ++j)
			{
				delta[j] = ent.msg_origins[0][j] - ent.msg_origins[1][j];
				if ((delta[j] > 100.0) || (delta[j] < -100.0))
					f = 1.0;
			}
			for (j = 0; j <= 2; ++j)
			{
				ent.origin[j] = ent.msg_origins[1][j] + f * delta[j];
				d = ent.msg_angles[0][j] - ent.msg_angles[1][j];
				if (d > 180.0)
					d -= 360.0;
				else if (d < -180.0)
					d += 360.0;
				ent.angles[j] = ent.msg_angles[1][j] + f * d;
			}
		}

		if ((ent.model.flags & mod.FLAGS.rotate) !== 0)
			ent.angles[1] = bobjrotate;
		if ((ent.effects & mod.EFFECTS.brightfield) !== 0)
			r.entityParticles(ent);
		if ((ent.effects & mod.EFFECTS.muzzleflash) !== 0)
		{
			dl = allocDlight(i);
			var fv = [];
			vec.angleVectors(ent.angles, fv);
			dl.origin = [
				ent.origin[0] + 18.0 * fv[0],
				ent.origin[1] + 18.0 * fv[1],
				ent.origin[2] + 16.0 + 18.0 * fv[2]
			];
			dl.radius = 200.0 + Math.random() * 32.0;
			dl.minlight = 32.0;
			dl.die = clState.time + 0.1;
		}
		if ((ent.effects & mod.EFFECTS.brightlight) !== 0)
		{
			dl = allocDlight(i);
			dl.origin = [ent.origin[0], ent.origin[1], ent.origin[2] + 16.0];
			dl.radius = 400.0 + Math.random() * 32.0;
			dl.die = clState.time + 0.001;
		}
		if ((ent.effects & mod.EFFECTS.dimlight) !== 0)
		{
			dl = allocDlight(i);
			dl.origin = [ent.origin[0], ent.origin[1], ent.origin[2] + 16.0];
			dl.radius = 200.0 + Math.random() * 32.0;
			dl.die = clState.time + 0.001;
		}
		if ((ent.model.flags & mod.FLAGS.gib) !== 0)
			r.rocketTrail(oldorg, ent.origin, 2);
		else if ((ent.model.flags & mod.FLAGS.zomgib) !== 0)
			r.rocketTrail(oldorg, ent.origin, 4);
		else if ((ent.model.flags & mod.FLAGS.tracer) !== 0)
			r.rocketTrail(oldorg, ent.origin, 3);
		else if ((ent.model.flags & mod.FLAGS.tracer2) !== 0)
			r.rocketTrail(oldorg, ent.origin, 5);
		else if ((ent.model.flags & mod.FLAGS.rocket) !== 0)
		{
			r.rocketTrail(oldorg, ent.origin, 0);
			dl = allocDlight(i)
			dl.origin = [ent.origin[0], ent.origin[1], ent.origin[2]];
			dl.radius = 200.0;
			dl.die = clState.time + 0.01;
		}
		else if ((ent.model.flags & mod.FLAGS.grenade) !== 0)
			r.rocketTrail(oldorg, ent.origin, 1);
		else if ((ent.model.flags & mod.FLAGS.tracer3) !== 0)
			r.rocketTrail(oldorg, ent.origin, 6);

		ent.forcelink = false;
		if ((i !== clState.viewentity) || (chase.cvr.active.value !== 0))
			state.visedicts[state.numvisedicts++] = ent;
	}
};

export const readFromServer = async function()
{
	clState.oldtime = clState.time;
	clState.time += host.state.frametime;
	var ret;
	for (;;)
	{
		ret = getMessage();
		if (ret === -1)
			await host.error('CL.ReadFromServer: lost server connection');
		if (ret === 0)
			break;
		clState.last_received_message = host.state.realtime;
		await parseServerMessage();
		if (cls.state !== ACTIVE.connected)
			break;
	}
	if (cvr.shownet.value !== 0)
		con.print('\n');
	relinkEntities();
	updateTEnts();
};

export const sendCmd = async function()
{
	if (cls.state !== ACTIVE.connected)
		return;

	if (cls.signon === 4)
	{
		baseMove();
		input.move();
		await sendMove();
	}

	if (cls.demoplayback === true)
	{
		cls.message.cursize = 0;
		return;
	}

	if (cls.message.cursize === 0)
		return;

	if (net.canSendMessage(cls.netcon) !== true)
	{
		con.dPrint('CL.SendCmd: can\'t send\n');
		return;
	}

	if (net.sendMessage(cls.netcon, cls.message) === -1)
		await host.error('CL.SendCmd: lost server connection');

	cls.message.cursize = 0;
};

export const init = async function()
{
	clearState();
	initInput();
	await initTEnts();
	cvr.name = cvar.registerVariable('_cl_name', 'player', true);
	cvr.color = cvar.registerVariable('_cl_color', '0', true);
	cvr.upspeed = cvar.registerVariable('cl_upspeed', '200');
	cvr.forwardspeed = cvar.registerVariable('cl_forwardspeed', '200', true);
	cvr.backspeed = cvar.registerVariable('cl_backspeed', '200', true);
	cvr.sidespeed = cvar.registerVariable('cl_sidespeed', '350');
	cvr.movespeedkey = cvar.registerVariable('cl_movespeedkey', '2.0');
	cvr.yawspeed = cvar.registerVariable('cl_yawspeed', '140');
	cvr.pitchspeed = cvar.registerVariable('cl_pitchspeed', '150');
	cvr.anglespeedkey = cvar.registerVariable('cl_anglespeedkey', '1.5');
	cvr.shownet = cvar.registerVariable('cl_shownet', '0');
	cvr.nolerp = cvar.registerVariable('cl_nolerp', '0');
	cvr.lookspring = cvar.registerVariable('lookspring', '0', true);
	cvr.lookstrafe = cvar.registerVariable('lookstrafe', '0', true);
	cvr.sensitivity = cvar.registerVariable('sensitivity', '3', true);
	cvr.m_pitch = cvar.registerVariable('m_pitch', '0.022', true);
	cvr.m_yaw = cvar.registerVariable('m_yaw', '0.022', true);
	cvr.m_forward = cvar.registerVariable('m_forward', '1', true);
	cvr.m_side = cvar.registerVariable('m_side', '0.8', true);
	cvr.rcon_password = cvar.registerVariable('rcon_password', '');
	cvr.rcon_address = cvar.registerVariable('rcon_address', '');
	cmd.addCommand('entities', printEntities_f);
	cmd.addCommand('disconnect', disconnect);
	cmd.addCommand('record', record_f);
	cmd.addCommand('stop', stop_f);
	cmd.addCommand('playdemo', playDemo_f);
	cmd.addCommand('timedemo', timeDemo_f);
	cmd.addCommand('rcon', rcon_f);
};

// parse

export const entityNum = function(num)
{
	if (num < state.entities.length)
		return state.entities[num];
	for (; state.entities.length <= num; )
	{
		state.entities[state.entities.length] = {
			num: num,
			update_type: 0,
			baseline: {
				origin: [0.0, 0.0, 0.0],
				angles: [0.0, 0.0, 0.0],
				modelindex: 0,
				frame: 0,
				colormap: 0,
				skin: 0,
				effects: 0
			},
			msgtime: 0.0,
			msg_origins: [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0]],
			origin: [0.0, 0.0, 0.0],
			msg_angles: [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0]],
			angles: [0.0, 0.0, 0.0],
			frame: 0,
			syncbase: 0.0,
			effects: 0,
			skinnum: 0,
			visframe: 0,
			dlightframe: 0,
			dlightbits: 0
		};
	}
	return state.entities[num];
};

export const parseStartSoundPacket = async function()
{
	var field_mask = msg.readByte();
	var volume = ((field_mask & 1) !== 0) ? msg.readByte() : 255;
	var attenuation = ((field_mask & 2) !== 0) ? msg.readByte() * 0.015625 : 1.0;
	var channel = msg.readShort();
	var sound_num = msg.readByte();
	var ent = channel >> 3;
	channel &= 7;
	var pos = [msg.readCoord(), msg.readCoord(), msg.readCoord()];
	await s.startSound(ent, channel, clState.sound_precache[sound_num], pos, volume / 255.0, attenuation);
};

export const keepaliveMessage = async function()
{
	if ((sv.state.server.active === true) || (cls.demoplayback === true))
		return;
	var oldsize = net.state.message.cursize;
	var olddata = new Uint8Array(8192);
	olddata.set(new Uint8Array(net.state.message.data, 0, oldsize));
	var ret;
	for (;;)
	{
		ret = getMessage();
		switch (ret)
		{
		case 0:
			break;
		case 1:
			await host.error('keepaliveMessage: received a message');
		case 2:
			if (msg.readByte() !== protocol.SVC.nop)
				await host.error('keepaliveMessage: datagram wasn\'t a nop');
		default:
			await host.error('keepaliveMessage: CL.GetMessage failed');
		}
		if (ret === 0)
			break;
	}
	net.state.message.cursize = oldsize;
	(new Uint8Array(net.state.message.data, 0, oldsize)).set(olddata.subarray(0, oldsize));
	var time = sys.floatTime();
	if ((time - state.lastmsg) < 5.0)
		return;
	state.lastmsg = time;
	con.print('--> client to server keepalive\n');
	msg.writeByte(cls.message, protocol.CLC.nop);
	net.sendMessage(cls.netcon, cls.message);
	cls.message.cursize = 0;
};

export const parseServerInfo = async function()
{
	con.dPrint('Serverinfo packet received.\n');
	clearState();
	var i = msg.readLong();
	if (i !== protocol.version)
	{
		con.print('Server returned version ' + i + ', not ' + protocol.version + '\n');
		return;
	}
	clState.maxclients = msg.readByte();
	if ((clState.maxclients <= 0) || (clState.maxclients > 16))
	{
		con.print('Bad maxclients (' + clState.maxclients + ') from server\n');
		return;
	}
	clState.scores = [];
	for (i = 0; i < clState.maxclients; ++i)
	{
		clState.scores[i] = {
			name: '',
			entertime: 0.0,
			frags: 0,
			colors: 0
		};
	}
	clState.gametype = msg.readByte();
	clState.levelname = msg.readString();
	con.print('\n\n\x1D\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1F\n\n');
	con.print('\x02' + clState.levelname + '\n');

	var str;
	var nummodels, model_precache = [];
	for (nummodels = 1; ; ++nummodels)
	{
		str = msg.readString();
		if (str.length === 0)
			break;
		model_precache[nummodels] = str;
	}
	var numsounds, sound_precache = [];
	for (numsounds = 1; ; ++numsounds)
	{
		str = msg.readString();
		if (str.length === 0)
			break;
		sound_precache[numsounds] = str;
	}

	clState.model_precache = [];
	for (i = 1; i < nummodels; ++i)
	{
		clState.model_precache[i] = await mod.forName(model_precache[i]);
		if (clState.model_precache[i] == null)
		{
			con.print('Model ' + model_precache[i] + ' not found\n');
			return;
		}
		await keepaliveMessage();
	}
	clState.sound_precache = [];
	for (i = 1; i < numsounds; ++i)
	{
		clState.sound_precache[i] = await s.precacheSound(sound_precache[i]);
		await keepaliveMessage();
	}

	clState.worldmodel = clState.model_precache[1];
	entityNum(0).model = clState.worldmodel;
	r.newMap();
	host.state.noclip_anglehack = false;
};

export const parseUpdate = function(bits)
{
	if (cls.signon === 3)
	{
		cls.signon = 4;
		signonReply();
	}

	if ((bits & protocol.U.morebits) !== 0)
		bits += (msg.readByte() << 8);

	var ent = entityNum(((bits & protocol.U.longentity) !== 0) ? msg.readShort() : msg.readByte());

	var forcelink = ent.msgtime !== clState.mtime[1];
	ent.msgtime = clState.mtime[0];

	var model = clState.model_precache[((bits & protocol.U.model) !== 0) ? msg.readByte() : ent.baseline.modelindex];
	if (model !== ent.model)
	{
		ent.model = model;
		if (model != null)
			ent.syncbase = (model.random === true) ? Math.random() : 0.0;
		else
			forcelink = true;
	}

	ent.frame = ((bits & protocol.U.frame) !== 0) ? msg.readByte() : ent.baseline.frame;
	ent.colormap = ((bits & protocol.U.colormap) !== 0) ? msg.readByte() : ent.baseline.colormap;
	if (ent.colormap > clState.maxclients)
		sys.error('i >= cl.maxclients');
	ent.skinnum = ((bits & protocol.U.skin) !== 0) ? msg.readByte() : ent.baseline.skin;
	ent.effects = ((bits & protocol.U.effects) !== 0) ? msg.readByte() : ent.baseline.effects;

	vec.copy(ent.msg_origins[0], ent.msg_origins[1]);
	vec.copy(ent.msg_angles[0], ent.msg_angles[1]);
	ent.msg_origins[0][0] = ((bits & protocol.U.origin1) !== 0) ? msg.readCoord() : ent.baseline.origin[0];
	ent.msg_angles[0][0] = ((bits & protocol.U.angle1) !== 0) ? msg.readAngle() : ent.baseline.angles[0];
	ent.msg_origins[0][1] = ((bits & protocol.U.origin2) !== 0) ? msg.readCoord() : ent.baseline.origin[1];
	ent.msg_angles[0][1] = ((bits & protocol.U.angle2) !== 0) ? msg.readAngle() : ent.baseline.angles[1];
	ent.msg_origins[0][2] = ((bits & protocol.U.origin3) !== 0) ? msg.readCoord() : ent.baseline.origin[2];
	ent.msg_angles[0][2] = ((bits & protocol.U.angle3) !== 0) ? msg.readAngle() : ent.baseline.angles[2];

	if ((bits & protocol.U.nolerp) !== 0)
		ent.forcelink = true;

	if (forcelink === true)
	{
		vec.copy(ent.msg_origins[0], ent.origin);
		vec.copy(ent.origin, ent.msg_origins[1]);
		vec.copy(ent.msg_angles[0], ent.angles);
		vec.copy(ent.angles, ent.msg_angles[1]);
		ent.forcelink = true;
	}
};

const parseBaseline = function(ent)
{
	ent.baseline.modelindex = msg.readByte();
	ent.baseline.frame = msg.readByte();
	ent.baseline.colormap = msg.readByte();
	ent.baseline.skin = msg.readByte();
	ent.baseline.origin[0] = msg.readCoord();
	ent.baseline.angles[0] = msg.readAngle();
	ent.baseline.origin[1] = msg.readCoord();
	ent.baseline.angles[1] = msg.readAngle();
	ent.baseline.origin[2] = msg.readCoord();
	ent.baseline.angles[2] = msg.readAngle();
};

export const parseClientdata = function(bits)
{
	var i;

	clState.viewheight = ((bits & protocol.SU.viewheight) !== 0) ? msg.readChar() : protocol.default_viewheight;
	clState.idealpitch = ((bits & protocol.SU.idealpitch) !== 0) ? msg.readChar() : 0.0;

	clState.mvelocity[1] = [clState.mvelocity[0][0], clState.mvelocity[0][1], clState.mvelocity[0][2]];
	for (i = 0; i <= 2; ++i)
	{
		if ((bits & (protocol.SU.punch1 << i)) !== 0)
			clState.punchangle[i] = msg.readChar();
		else
			clState.punchangle[i] = 0.0;
		if ((bits & (protocol.SU.velocity1 << i)) !== 0)
			clState.mvelocity[0][i] = msg.readChar() * 16.0;
		else
			clState.mvelocity[0][i] = 0.0;
	}

	i = msg.readLong();
	var j;
	if (clState.items !== i)
	{
		for (j = 0; j <= 31; ++j)
		{
			if ((((i >>> j) & 1) !== 0) && (((clState.items >>> j) & 1) === 0))
				clState.item_gettime[j] = clState.time;
		}
		clState.items = i;
	}

	clState.onground = (bits & protocol.SU.onground) !== 0;
	clState.inwater = (bits & protocol.SU.inwater) !== 0;

	clState.stats[def.STAT.weaponframe] = ((bits & protocol.SU.weaponframe) !== 0) ? msg.readByte() : 0;
	clState.stats[def.STAT.armor] = ((bits & protocol.SU.armor) !== 0) ? msg.readByte() : 0;
	clState.stats[def.STAT.weapon] = ((bits & protocol.SU.weapon) !== 0) ? msg.readByte() : 0;
	clState.stats[def.STAT.health] = msg.readShort();
	clState.stats[def.STAT.ammo] = msg.readByte();
	clState.stats[def.STAT.shells] = msg.readByte();
	clState.stats[def.STAT.nails] = msg.readByte();
	clState.stats[def.STAT.rockets] = msg.readByte();
	clState.stats[def.STAT.cells] = msg.readByte();
	if (com.state.standard_quake === true)
		clState.stats[def.STAT.activeweapon] = msg.readByte();
	else
		clState.stats[def.STAT.activeweapon] = 1 << msg.readByte();
};

export const parseStatic = function()
{
	var ent = {
		num: -1,
		update_type: 0,
		baseline: {origin: [], angles: []},
		msgtime: 0.0,
		msg_origins: [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0]],
		msg_angles: [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0]],
		syncbase: 0.0,
		visframe: 0,
		dlightframe: 0,
		dlightbits: 0,
		leafs: []
	} as any;
	state.static_entities[clState.num_statics++] = ent;
	parseBaseline(ent);
	ent.model = clState.model_precache[ent.baseline.modelindex];
	ent.frame = ent.baseline.frame;
	ent.skinnum = ent.baseline.skin;
	ent.effects = ent.baseline.effects;
	ent.origin = [ent.baseline.origin[0], ent.baseline.origin[1], ent.baseline.origin[2]];
	ent.angles = [ent.baseline.angles[0], ent.baseline.angles[1], ent.baseline.angles[2]];
	r.state.currententity = ent;
	r.state.emins = [ent.origin[0] + ent.model.mins[0], ent.origin[1] + ent.model.mins[1], ent.origin[2] + ent.model.mins[2]];
	r.state.emaxs = [ent.origin[0] + ent.model.maxs[0], ent.origin[1] + ent.model.maxs[1], ent.origin[2] + ent.model.maxs[2]];
	r.splitEntityOnNode(clState.worldmodel.nodes[0]);
};

export const parseStaticSound = async function()
{
	var org = [msg.readCoord(), msg.readCoord(), msg.readCoord()];
	var sound_num = msg.readByte();
	var vol = msg.readByte();
	var atten = msg.readByte();
	await s.staticSound(clState.sound_precache[sound_num], org, vol / 255.0, atten);
};

export const shownet = function(x)
{
	if (cvr.shownet.value === 2)
	{
		con.print((msg.state.readcount <= 99 ? (msg.state.readcount <= 9 ? '  ' : ' ') : '')
			+ (msg.state.readcount - 1) + ':' + x + '\n');
	}
};

export const parseServerMessage = async function()
{
	if (cvr.shownet.value === 1)
		con.print(net.state.message.cursize + ' ');
	else if (cvr.shownet.value === 2)
		con.print('------------------\n');

	clState.onground = false;

	msg.beginReading();

	var _cmd, i;
	for (;;)
	{
		if (msg.state.badread === true)
			await host.error('CL.ParseServerMessage: Bad server message');

		_cmd = msg.readByte();

		if (_cmd === -1)
		{
			shownet('END OF MESSAGE');
			return;
		}

		if ((_cmd & 128) !== 0)
		{
			shownet('fast update');
			parseUpdate(_cmd & 127);
			continue;
		}

		shownet('svc_' + SVC_STRINGS[_cmd]);
		switch (_cmd)
		{
		case protocol.SVC.nop:
			continue;
		case protocol.SVC.time:
			clState.mtime[1] = clState.mtime[0];
			clState.mtime[0] = msg.readFloat();
			continue;
		case protocol.SVC.clientdata:
			parseClientdata(msg.readShort());
			continue;
		case protocol.SVC.version:
			i = msg.readLong();
			if (i !== protocol.version)
				await host.error('CL.ParseServerMessage: Server is protocol ' + i + ' instead of ' + protocol.version + '\n');
			continue;
		case protocol.SVC.disconnect:
			await host.endGame('Server disconnected\n');
		case protocol.SVC.print:
			con.print(msg.readString());
			continue;
		case protocol.SVC.centerprint:
			scr.centerPrint(msg.readString());
			continue;
		case protocol.SVC.stufftext:
			cmd.state.text += msg.readString();
			continue;
		case protocol.SVC.damage:
			v.parseDamage();
			continue;
		case protocol.SVC.serverinfo:
			await parseServerInfo();
			scr.state.recalc_refdef = true;
			continue;
		case protocol.SVC.setangle:
			clState.viewangles[0] = msg.readAngle();
			clState.viewangles[1] = msg.readAngle();
			clState.viewangles[2] = msg.readAngle();
			continue;
		case protocol.SVC.setview:
			clState.viewentity = msg.readShort();
			continue;
		case protocol.SVC.lightstyle:
			i = msg.readByte();
			if (i >= 64)
				sys.error('svc_lightstyle > MAX_LIGHTSTYLES');
			state.lightstyle[i] = msg.readString();
			continue;
		case protocol.SVC.sound:
			await parseStartSoundPacket();
			continue;
		case protocol.SVC.stopsound:
			i = msg.readShort();
			s.stopSound(i >> 3, i & 7);
			continue;
		case protocol.SVC.updatename:
			i = msg.readByte();
			if (i >= clState.maxclients)
				await host.error('CL.ParseServerMessage: svc_updatename > MAX_SCOREBOARD');
			clState.scores[i].name = msg.readString();
			continue;
		case protocol.SVC.updatefrags:
			i = msg.readByte();
			if (i >= clState.maxclients)
				await host.error('CL.ParseServerMessage: svc_updatefrags > MAX_SCOREBOARD');
			clState.scores[i].frags = msg.readShort();
			continue;
		case protocol.SVC.updatecolors:
			i = msg.readByte();
			if (i >= clState.maxclients)
				await host.error('CL.ParseServerMessage: svc_updatecolors > MAX_SCOREBOARD');
			clState.scores[i].colors = msg.readByte();
			continue;
		case protocol.SVC.particle:
			r.parseParticleEffect();
			continue;
		case protocol.SVC.spawnbaseline:
			parseBaseline(entityNum(msg.readShort()));
			continue;
		case protocol.SVC.spawnstatic:
			parseStatic();
			continue;
		case protocol.SVC.temp_entity:
			await parseTEnt();
			continue;
		case protocol.SVC.setpause:
			clState.paused = msg.readByte() !== 0;
			if (clState.paused === true)
				cdAudio.pause();
			else
				cdAudio.resume();
			continue;
		case protocol.SVC.signonnum:
			i = msg.readByte();
			if (i <= cls.signon)
				await host.error('Received signon ' + i + ' when at ' + cls.signon);
			cls.signon = i;
			signonReply();
			continue;
		case protocol.SVC.killedmonster:
			++clState.stats[def.STAT.monsters];
			continue;
		case protocol.SVC.foundsecret:
			++clState.stats[def.STAT.secrets];
			continue;
		case protocol.SVC.updatestat:
			i = msg.readByte();
			if (i >= 32)
				sys.error('svc_updatestat: ' + i + ' is invalid');
			clState.stats[i] = msg.readLong();
			continue;
		case protocol.SVC.spawnstaticsound:
			await parseStaticSound();
			continue;
		case protocol.SVC.cdtrack:
			clState.cdtrack = msg.readByte();
			msg.readByte();
			if (((cls.demoplayback === true) || (cls.demorecording === true)) && (cls.forcetrack !== -1))
				await cdAudio.play(cls.forcetrack, true);
			else
				await cdAudio.play(clState.cdtrack, true);
			continue;
		case protocol.SVC.intermission:
			clState.intermission = 1;
			clState.completed_time = clState.time;
			scr.state.recalc_refdef = true;
			continue;
		case protocol.SVC.finale:
			clState.intermission = 2;
			clState.completed_time = clState.time;
			scr.state.recalc_refdef = true;
			scr.centerPrint(msg.readString());
			continue;
		case protocol.SVC.cutscene:
			clState.intermission = 3;
			clState.completed_time = clState.time;
			scr.state.recalc_refdef = true;
			scr.centerPrint(msg.readString());
			continue;
		case protocol.SVC.sellscreen:
			await cmd.executeString('help');
			continue;
		}
		await host.error('CL.ParseServerMessage: Illegible server message\n');
	}
};

// TEnt

export const initTEnts = async function()
{
	state.sfx_wizhit = await s.precacheSound('wizard/hit.wav');
	state.sfx_knighthit = await s.precacheSound('hknight/hit.wav');
	state.sfx_tink1 = await s.precacheSound('weapons/tink1.wav');
	state.sfx_ric1 = await s.precacheSound('weapons/ric1.wav');
	state.sfx_ric2 = await s.precacheSound('weapons/ric2.wav');
	state.sfx_ric3 = await s.precacheSound('weapons/ric3.wav');
	state.sfx_r_exp3 = await s.precacheSound('weapons/r_exp3.wav');
};

export const parseBeam = function(m)
{
	var ent = msg.readShort();
	var start = [msg.readCoord(), msg.readCoord(), msg.readCoord()];
	var end = [msg.readCoord(), msg.readCoord(), msg.readCoord()];
	var i, b;
	for (i = 0; i <= 23; ++i)
	{
		b = state.beams[i];
		if (b.entity !== ent)
			continue;
		b.model = m;
		b.endtime = clState.time + 0.2;
		b.start = [start[0], start[1], start[2]];
		b.end = [end[0], end[1], end[2]];
		return;
	}
	for (i = 0; i <= 23; ++i)
	{
		b = state.beams[i];
		if ((b.model != null) && (b.endtime >= clState.time))
			continue;
		b.entity = ent;
		b.model = m;
		b.endtime = clState.time + 0.2;
		b.start = [start[0], start[1], start[2]];
		b.end = [end[0], end[1], end[2]];
		return;
	}
	con.print('beam list overflow!\n');
};

export const parseTEnt = async function()
{
	var type = msg.readByte();

	switch (type)
	{
	case protocol.TE.lightning1:
		parseBeam(await mod.forName('progs/bolt.mdl', true));
		return;
	case protocol.TE.lightning2:
		parseBeam(await mod.forName('progs/bolt2.mdl', true));
		return;
	case protocol.TE.lightning3:
		parseBeam(await mod.forName('progs/bolt3.mdl', true));
		return;
	case protocol.TE.beam:
		parseBeam(await mod.forName('progs/beam.mdl', true));
		return;
	}

	var pos = [msg.readCoord(), msg.readCoord(), msg.readCoord()];
	var dl;
	switch (type)
	{
	case protocol.TE.wizspike:
		r.runParticleEffect(pos, vec.origin, 20, 20);
		await s.startSound(-1, 0, state.sfx_wizhit, pos, 1.0, 1.0);
		return;
	case protocol.TE.knightspike:
		r.runParticleEffect(pos, vec.origin, 226, 20);
		await s.startSound(-1, 0, state.sfx_knighthit, pos, 1.0, 1.0);
		return;
	case protocol.TE.spike:
		r.runParticleEffect(pos, vec.origin, 0, 10);
		return;
	case protocol.TE.superspike:
		r.runParticleEffect(pos, vec.origin, 0, 20);
		return;
	case protocol.TE.gunshot:
		r.runParticleEffect(pos, vec.origin, 0, 20);
		return;
	case protocol.TE.explosion:
		r.particleExplosion(pos);
		dl = allocDlight(0);
		dl.origin = [pos[0], pos[1], pos[2]];
		dl.radius = 350.0;
		dl.die = clState.time + 0.5;
		dl.decay = 300.0;
		await s.startSound(-1, 0, state.sfx_r_exp3, pos, 1.0, 1.0);
		return;
	case protocol.TE.tarexplosion:
		r.blobExplosion(pos);
		await s.startSound(-1, 0, state.sfx_r_exp3, pos, 1.0, 1.0);
		return;
	case protocol.TE.lavasplash:
		r.lavaSplash(pos);
		return;
	case protocol.TE.teleport:
		r.teleportSplash(pos);
		return;
	case protocol.TE.explosion2:
		var colorStart = msg.readByte();
		var colorLength = msg.readByte();
		r.particleExplosion2(pos, colorStart, colorLength);
		dl = allocDlight(0);
		dl.origin = [pos[0], pos[1], pos[2]];
		dl.radius = 350.0;
		dl.die = clState.time + 0.5;
		dl.decay = 300.0;
		await s.startSound(-1, 0, state.sfx_r_exp3, pos, 1.0, 1.0);
		return;
	}

	sys.error('CL.ParseTEnt: bad type');
};

export const newTempEntity = function()
{
	var ent = {frame: 0, syncbase: 0.0, skinnum: 0};
	state.temp_entities[state.num_temp_entities++] = ent;
	state.visedicts[state.numvisedicts++] = ent;
	return ent;
};

export const updateTEnts = function()
{
	state.num_temp_entities = 0;
	var i, b, dist = [], yaw, pitch, org = [], d, ent;
	for (i = 0; i <= 23; ++i)
	{
		b = state.beams[i];
		if ((b.model == null) || (b.endtime < clState.time))
			continue;
		if (b.entity === clState.viewentity)
			vec.copy(state.entities[clState.viewentity].origin, b.start);
		dist[0] = b.end[0] - b.start[0];
		dist[1] = b.end[1] - b.start[1];
		dist[2] = b.end[2] - b.start[2];
		if ((dist[0] === 0.0) && (dist[1] === 0.0))
		{
			yaw = 0;
			pitch = dist[2] > 0.0 ? 90 : 270;
		}
		else
		{
			yaw = (Math.atan2(dist[1], dist[0]) * 180.0 / Math.PI) >> 0;
			if (yaw < 0)
				yaw += 360;
			pitch = (Math.atan2(dist[2], Math.sqrt(dist[0] * dist[0] + dist[1] * dist[1])) * 180.0 / Math.PI) >> 0;
			if (pitch < 0)
				pitch += 360;
		}
		org[0] = b.start[0];
		org[1] = b.start[1];
		org[2] = b.start[2];
		d = Math.sqrt(dist[0] * dist[0] + dist[1] * dist[1] + dist[2] * dist[2]);
		if (d !== 0.0)
		{
			dist[0] /= d;
			dist[1] /= d;
			dist[2] /= d;
		}
		for (; d > 0.0; )
		{
			ent = newTempEntity();
			ent.origin = [org[0], org[1], org[2]];
			ent.model = b.model;
			ent.angles = [pitch, yaw, Math.random() * 360.0];
			org[0] += dist[0] * 30.0;
			org[1] += dist[1] * 30.0;
			org[2] += dist[2] * 30.0;
			d -= 30.0;
		}
	}
};