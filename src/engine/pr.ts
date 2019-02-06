import * as con from './console'
import * as sys from './sys'
import * as host from './host'
import * as sv from './sv'
import * as cmd from './cmd'
import * as com from './com'
import * as ed from './ed'
import * as cvar from './cvar'
import * as q from './q'
import * as pf from './pf'
import * as crc from './crc'

const version = 6
const progheader_crc = 5927;

export const state = {
  strings: null,
  globals_int: null,
  globals_float: null,
  depth: null,
  functions: null,
  argc: null,
  edict_size: 0,
  trace: false
} as any

export const ETYPE = {
	ev_void: 0,
	ev_string: 1,
	ev_float: 2,
	ev_vector: 3,
	ev_entity: 4,
	ev_field: 5,
	ev_function: 6,
	ev_pointer: 7
};

const OP = {
	done: 0,
	mul_f: 1, mul_v: 2, mul_fv: 3, mul_vf: 4,
	div_f: 5,
	add_f: 6, add_v: 7,
	sub_f: 8, sub_v: 9,
	eq_f: 10, eq_v: 11, eq_s: 12, eq_e: 13, eq_fnc: 14,
	ne_f: 15, ne_v: 16, ne_s: 17, ne_e: 18, ne_fnc: 19,
	le: 20, ge: 21, lt: 22, gt: 23,
	load_f: 24, load_v: 25, load_s: 26, load_ent: 27, load_fld: 28, load_fnc: 29,
	address: 30,
	store_f: 31, store_v: 32, store_s: 33, store_ent: 34, store_fld: 35, store_fnc: 36,
	storep_f: 37, storep_v: 38, storep_s: 39, storep_ent: 40, storep_fld: 41, storep_fnc: 42,
	ret: 43,
	not_f: 44, not_v: 45, not_s: 46, not_ent: 47, not_fnc: 48,
	jnz: 49, jz: 50,
	call0: 51, call1: 52, call2: 53, call3: 54, call4: 55, call5: 56, call6: 57, call7: 58, call8: 59,
	state: 60,
	jump: 61,
	and: 62, or: 63,
	bitand: 64, bitor: 65
};

export const globalvars = {
	self: 28, // edict
	other: 29, // edict
	world: 30, // edict
	time: 31, // float
	frametime: 32, // float
	force_retouch: 33, // float
	mapname: 34, // string
	deathmatch: 35, // float
	coop: 36, // float
	teamplay: 37, // float
	serverflags: 38, // float
	total_secrets: 39, // float
	total_monsters: 40, // float
	found_secrets: 41, // float
	killed_monsters: 42, // float
	parms: 43, // float[16]
	v_forward: 59, // vec3
	v_forward1: 60,
	v_forward2: 61,
	v_up: 62, // vec3
	v_up1: 63,
	v_up2: 64,
	v_right: 65, // vec3,
	v_right1: 66,
	v_right2: 67,
	trace_allsolid: 68, // float
	trace_startsolid: 69, // float
	trace_fraction: 70, // float
	trace_endpos: 71, // vec3
	trace_endpos1: 72,
	trace_endpos2: 73,
	trace_plane_normal: 74, // vec3
	trace_plane_normal1: 75,
	trace_plane_normal2: 76,
	trace_plane_dist: 77, // float
	trace_ent: 78, // edict
	trace_inopen: 79, // float
	trace_inwater: 80, // float
	msg_entity: 81, // edict
	main: 82, // func
	StartFrame: 83, // func
	PlayerPreThink: 84, // func
	PlayerPostThink: 85, // func
	ClientKill: 86, // func
	ClientConnect: 87, // func
	PutClientInServer: 88, // func
	ClientDisconnect: 89, // func
	SetNewParms: 90, // func
	SetChangeParms: 91 // func
};

export const entvars = {
	modelindex: 0, // float
	absmin: 1, // vec3
	absmin1: 2,
	absmin2: 3,
	absmax: 4, // vec3
	absmax1: 5,
	absmax2: 6,
	ltime: 7, // float
	movetype: 8, // float
	solid: 9, // float
	origin: 10, // vec3
	origin1: 11,
	origin2: 12,
	oldorigin: 13, // vec3
	oldorigin1: 14,
	oldorigin2: 15,
	velocity: 16, // vec3
	velocity1: 17,
	velocity2: 18,
	angles: 19, // vec3
	angles1: 20,
	angles2: 21,
	avelocity: 22, // vec3
	avelocity1: 23,
	avelocity2: 24,
	punchangle: 25, // vec3
	punchangle1: 26,
	punchangle2: 27,
	classname: 28, // string
	model: 29, // string
	frame: 30, // float
	skin: 31, // float
	effects: 32, // float
	mins: 33, // vec3
	mins1: 34,
	mins2: 35,
	maxs: 36, // vec3
	maxs1: 37,
	maxs2: 38,
	size: 39, // vec3
	size1: 40,
	size2: 41,
	touch: 42, // func
	use: 43, // func
	think: 44, // func
	blocked: 45, // func
	nextthink: 46, // float
	groundentity: 47, // edict
	health: 48, // float
	frags: 49, // float
	weapon: 50, // float
	weaponmodel: 51, // string
	weaponframe: 52, // float
	currentammo: 53, // float
	ammo_shells: 54, // float
	ammo_nails: 55, // float
	ammo_rockets: 56, // float
	ammo_cells: 57, // float
	items: 58, // float
	takedamage: 59, // float
	chain: 60, // edict
	deadflag: 61, // float
	view_ofs: 62, // vec3
	view_ofs1: 63,
	view_ofs2: 64,
	button0: 65, // float
	button1: 66, // float
	button2: 67, // float
	impulse: 68, // float
	fixangle: 69, // float
	v_angle: 70, // vec3
	v_angle1: 71,
	v_angle2: 72,
	idealpitch: 73, // float
	netname: 74, // string
	enemy: 75, // edict
	flags: 76, // float
	colormap: 77, // float
	team: 78, // float
	max_health: 79, // float
	teleport_time: 80, // float
	armortype: 81, // float
	armorvalue: 82, // float
	waterlevel: 83, // float
	watertype: 84, // float
	ideal_yaw: 85, // float
	yaw_speed: 86, // float
	aiment: 87, // edict
	goalentity: 88, // edict
	spawnflags: 89, // float
	target: 90, // string
	targetname: 91, // string
	dmg_take: 92, // float
	dmg_save: 93, // float
	dmg_inflictor: 94, // edict
	owner: 95, // edict
	movedir: 96, // vec3
	movedir1: 97,
	movedir2: 98,
	message: 99, // string
	sounds: 100, // float
	noise: 101, // string
	noise1: 102, // string
	noise2: 103, // string
	noise3: 104 // string
} as any;

// cmds

export const checkEmptyString = async function(s)
{
	var c = s.charCodeAt(0);
	if ((q.isNaN(c) === true) || (c <= 32))
		await runError('Bad string');
};

// edict

export const valueString = function(type, val, ofs)
{
	var val_float = new Float32Array(val);
	var val_int = new Int32Array(val);
	type &= 0x7fff;
	switch (type)
	{
	case ETYPE.ev_string:
		return getString(val_int[ofs]);
	case ETYPE.ev_entity:
		return 'entity ' + val_int[ofs];
	case ETYPE.ev_function:
		return getString(state.functions[val_int[ofs]].name) + '()';
	case ETYPE.ev_field:
		var def = ed.fieldAtOfs(val_int[ofs]);
		if (def != null)
			return '.' + getString(def.name);
		return '.';
	case ETYPE.ev_void:
		return 'void';
	case ETYPE.ev_float:
		return val_float[ofs].toFixed(1);
	case ETYPE.ev_vector:
		return '\'' + val_float[ofs].toFixed(1) +
		' ' + val_float[ofs + 1].toFixed(1) +
		' ' + val_float[ofs + 2].toFixed(1) + '\'';
	case ETYPE.ev_pointer:
		return 'pointer';
	}
	return 'bad type ' + type;
};

export const uglyValueString = function(type, val, ofs)
{
	var val_float = new Float32Array(val);
	var val_int = new Int32Array(val);
	type &= 0x7fff;
	switch (type)
	{
	case ETYPE.ev_string:
		return getString(val_int[ofs]);
	case ETYPE.ev_entity:
		return val_int[ofs].toString();
	case ETYPE.ev_function:
		return getString(state.functions[val_int[ofs]].name);
	case ETYPE.ev_field:
		var def = ed.fieldAtOfs(val_int[ofs]);
		if (def != null)
			return getString(def.name);
		return '';
	case ETYPE.ev_void:
		return 'void';
	case ETYPE.ev_float:
		return val_float[ofs].toFixed(6);
	case ETYPE.ev_vector:
		return val_float[ofs].toFixed(6) +
		' ' + val_float[ofs + 1].toFixed(6) +
		' ' + val_float[ofs + 2].toFixed(6);
	}
	return 'bad type ' + type;
};

export const globalString = function(ofs)
{
	var def = ed.globalAtOfs(ofs), line;
	if (def != null)
		line = ofs + '(' + getString(def.name) + ')' + valueString(def.type, state.globals, ofs);
	else
		line = ofs + '(???)';
	for (; line.length <= 20; )
		line += ' ';
	return line;
};

export const globalStringNoContents = function(ofs)
{
	var def = ed.globalAtOfs(ofs), line;
	if (def != null)
		line = ofs + '(' + getString(def.name) + ')';
	else
		line = ofs + '(???)';
	for (; line.length <= 20; )
		line += ' ';
	return line;
};

export const loadProgs = async function()
{
	var progs = await com.loadFile('progs.dat');
	if (progs == null)
		sys.error('PR.LoadProgs: couldn\'t load progs.dat');
	con.dPrint('Programs occupy ' + (progs.byteLength >> 10) + 'K.\n');
	var view = new DataView(progs);

	var i = view.getUint32(0, true);
	if (i !== version)
		sys.error('progs.dat has wrong version number (' + i + ' should be ' + version + ')');
	if (view.getUint32(4, true) !== progheader_crc)
		sys.error('progs.dat system vars have been modified, PR.js is out of date');

	state.crc = crc.block(new Uint8Array(progs));

	state.stack = [];
	state.depth = 0;

	state.localstack = [];
	for (i = 0; i < state.localstack_size; ++i)
		state.localstack[i] = 0;
	state.localstack_used = 0;

	var ofs, num;

	ofs = view.getUint32(8, true);
	num = view.getUint32(12, true);
	state.statements = [];
	for (i = 0; i < num; ++i)
	{
		state.statements[i] = {
			op: view.getUint16(ofs, true),
			a: view.getInt16(ofs + 2, true),
			b: view.getInt16(ofs + 4, true),
			c: view.getInt16(ofs + 6, true)
		};
		ofs += 8;
	}

	ofs = view.getUint32(16, true);
	num = view.getUint32(20, true);
	state.globaldefs = [];
	for (i = 0; i < num; ++i)
	{
		state.globaldefs[i] = {
			type: view.getUint16(ofs, true),
			ofs: view.getUint16(ofs + 2, true),
			name: view.getUint32(ofs + 4, true)
		};
		ofs += 8;
	}

	ofs = view.getUint32(24, true);
	num = view.getUint32(28, true);
	state.fielddefs = [];
	for (i = 0; i < num; ++i)
	{
		state.fielddefs[i] = {
			type: view.getUint16(ofs, true),
			ofs: view.getUint16(ofs + 2, true),
			name: view.getUint32(ofs + 4, true)
		};
		ofs += 8;
	}

	ofs = view.getUint32(32, true);
	num = view.getUint32(36, true);
	state.functions = [];
	for (i = 0; i < num; ++i)
	{
		state.functions[i] = {
			first_statement: view.getInt32(ofs, true),
			parm_start: view.getUint32(ofs + 4, true),
			locals: view.getUint32(ofs + 8, true),
			profile: view.getUint32(ofs + 12, true),
			name: view.getUint32(ofs + 16, true),
			file: view.getUint32(ofs + 20, true),
			numparms: view.getUint32(ofs + 24, true),
			parm_size: [
				view.getUint8(ofs + 28), view.getUint8(ofs + 29),
				view.getUint8(ofs + 30), view.getUint8(ofs + 31),
				view.getUint8(ofs + 32), view.getUint8(ofs + 33),
				view.getUint8(ofs + 34), view.getUint8(ofs + 35)
			]
		};
		ofs += 36;
	}

	ofs = view.getUint32(40, true);
	num = view.getUint32(44, true);
	state.strings = [];
	for (i = 0; i < num; ++i)
		state.strings[i] = view.getUint8(ofs + i);
	state.string_temp = newString('', 128);
	state.netnames = newString('', sv.state.svs.maxclients << 5);

	ofs = view.getUint32(48, true);
	num = view.getUint32(52, true);
	state.globals = new ArrayBuffer(num << 2);
	state.globals_float = new Float32Array(state.globals);
	state.globals_int = new Int32Array(state.globals);
	for (i = 0; i < num; ++i)
		state.globals_int[i] = view.getInt32(ofs + (i << 2), true);

	state.entityfields = view.getUint32(56, true);
	state.edict_size = 96 + (state.entityfields << 2);

	var fields = [
		'ammo_shells1',
		'ammo_nails1',
		'ammo_lava_nails',
		'ammo_rockets1',
		'ammo_multi_rockets',
		'ammo_cells1',
		'ammo_plasma',
		'gravity',
		'items2'
	], field, def;
	for (i = 0; i < fields.length; ++i)
	{
		field = fields[i];
		def = ed.findField(field);
		entvars[field] = (def != null) ? def.ofs : null;
	}
};

export const init = function()
{
	cmd.addCommand('edict', ed.printEdict_f);
	cmd.addCommand('edicts', ed.printEdicts);
	cmd.addCommand('edictcount', ed.count);
	cmd.addCommand('profile', profile_f);
	cvar.registerVariable('nomonsters', '0');
	cvar.registerVariable('gamecfg', '0');
	cvar.registerVariable('scratch1', '0');
	cvar.registerVariable('scratch2', '0');
	cvar.registerVariable('scratch3', '0');
	cvar.registerVariable('scratch4', '0');
	cvar.registerVariable('savedgamecfg', '0', true);
	cvar.registerVariable('saved1', '0', true);
	cvar.registerVariable('saved2', '0', true);
	cvar.registerVariable('saved3', '0', true);
	cvar.registerVariable('saved4', '0', true);
};

// exec

const localstack_size = 2048;

const opnames = [
	'DONE',
	'MUL_F', 'MUL_V', 'MUL_FV', 'MUL_VF',
	'DIV',
	'ADD_F', 'ADD_V',
	'SUB_F', 'SUB_V',
	'EQ_F', 'EQ_V', 'EQ_S', 'EQ_E', 'EQ_FNC',
	'NE_F', 'NE_V', 'NE_S', 'NE_E', 'NE_FNC',
	'LE', 'GE', 'LT', 'GT',
	'INDIRECT', 'INDIRECT', 'INDIRECT', 'INDIRECT', 'INDIRECT', 'INDIRECT',
	'ADDRESS',
	'STORE_F', 'STORE_V', 'STORE_S', 'STORE_ENT', 'STORE_FLD', 'STORE_FNC',
	'STOREP_F', 'STOREP_V', 'STOREP_S', 'STOREP_ENT', 'STOREP_FLD', 'STOREP_FNC',
	'RETURN',
	'NOT_F', 'NOT_V', 'NOT_S', 'NOT_ENT', 'NOT_FNC',
	'IF', 'IFNOT',
	'CALL0', 'CALL1', 'CALL2', 'CALL3', 'CALL4', 'CALL5', 'CALL6', 'CALL7', 'CALL8',
	'STATE',
	'GOTO',
	'AND', 'OR',
	'BITAND', 'BITOR'
];

export const printStatement = function(s)
{
	var text;
	if (s.op < opnames.length)
	{
		text = opnames[s.op] + ' ';
		for (; text.length <= 9; )
			text += ' ';
	}
	else
		text = '';
	if ((s.op === OP.jnz) || (s.op === OP.jz))
		text += globalString(s.a) + 'branch ' + s.b;
	else if (s.op === OP.jump)
		text += 'branch ' + s.a;
	else if ((s.op >= OP.store_f) && (s.op <= OP.store_fnc))
		text += globalString(s.a) + globalStringNoContents(s.b);
	else
	{
		if (s.a !== 0)
			text += globalString(s.a);
		if (s.b !== 0)
			text += globalString(s.b);
		if (s.c !== 0)
			text += globalStringNoContents(s.c);
	}
	con.print(text + '\n');
};

export const stackTrace = function()
{
	if (state.depth === 0)
	{
		con.print('<NO STACK>\n');
		return;
	}
	state.stack[state.depth] = [state.xstatement, state.xfunction];
	var f, file;
	for (; state.depth >= 0; --state.depth)
	{
		f = state.stack[state.depth][1];
		if (f == null)
		{
			con.print('<NO FUNCTION>\n');
			continue;
		}
		file = getString(f.file);
		for (; file.length <= 11; )
			file += ' ';
		con.print(file + ' : ' + getString(f.name) + '\n');
	}
	state.depth = 0;
};

export const profile_f = function()
{
	if (sv.state.server.active !== true)
		return;
	var num = 0, max, best, i, f, profile;
	for (;;)
	{
		max = 0;
		best = null;
		for (i = 0; i < state.functions.length; ++i)
		{
			f = state.functions[i];
			if (f.profile > max)
			{
				max = f.profile;
				best = f;
			}
		}
		if (best == null)
			return;
		if (num < 10)
		{
			profile = best.profile.toString();
			for (; profile.length <= 6; )
				profile = ' ' + profile;
			con.print(profile + ' ' + getString(best.name) + '\n');
		}
		++num;
		best.profile = 0;
	}
};

export const runError = async function(error)
{
	printStatement(state.statements[state.xstatement]);
	stackTrace();
	con.print(error + '\n');
	await host.error('Program error');
};

const enterFunction = async function(f)
{
	state.stack[state.depth++] = [state.xstatement, state.xfunction];
	var c = f.locals;
	if ((state.localstack_used + c) > state.localstack_size)
		await runError('PR.EnterFunction: locals stack overflow\n');
	var i;
	for (i = 0; i < c; ++i)
		state.localstack[state.localstack_used + i] = state.globals_int[f.parm_start + i];
	state.localstack_used += c;
	var o = f.parm_start, j;
	for (i = 0; i < f.numparms; ++i)
	{
		for (j = 0; j < f.parm_size[i]; ++j)
			state.globals_int[o++] = state.globals_int[4 + i * 3 + j];
	}
	state.xfunction = f;
	return f.first_statement - 1;
};

const leaveFunction = async function()
{
	if (state.depth <= 0)
		sys.error('prog stack underflow');
	var c = state.xfunction.locals;
	state.localstack_used -= c;
	if (state.localstack_used < 0)
		await runError('PR.LeaveFunction: locals stack underflow\n');
	for (--c; c >= 0; --c)
		state.globals_int[state.xfunction.parm_start + c] = state.localstack[state.localstack_used + c];
	state.xfunction = state.stack[--state.depth][1];
	return state.stack[state.depth][0];
};

export const executeProgram = async function(fnum)
{
	if ((fnum === 0) || (fnum >= state.functions.length))
	{
		if (state.globals_int[globalvars.self] !== 0)
			ed.print(sv.state.server.edicts[state.globals_int[globalvars.self]]);
		await host.error('PR.ExecuteProgram: NULL function');
	}
	var runaway = 100000;
	var exitdepth = state.depth;
	var s = await enterFunction(state.functions[fnum]);
	var st, _ed, ptr, newf;

	for (;;)
	{
		++s;
		st = state.statements[s];
		if (--runaway === 0)
			await runError('runaway loop error');
		++state.xfunction.profile;
		state.xstatement = s;
		if (state.trace === true)
			printStatement(st);
		switch (st.op)
		{
		case OP.add_f:
			state.globals_float[st.c] = state.globals_float[st.a] + state.globals_float[st.b];
			continue;
		case OP.add_v:
			state.globals_float[st.c] = state.globals_float[st.a] + state.globals_float[st.b];
			state.globals_float[st.c + 1] = state.globals_float[st.a + 1] + state.globals_float[st.b + 1];
			state.globals_float[st.c + 2] = state.globals_float[st.a + 2] + state.globals_float[st.b + 2];
			continue;
		case OP.sub_f:
			state.globals_float[st.c] = state.globals_float[st.a] - state.globals_float[st.b];
			continue;
		case OP.sub_v:
			state.globals_float[st.c] = state.globals_float[st.a] - state.globals_float[st.b];
			state.globals_float[st.c + 1] = state.globals_float[st.a + 1] - state.globals_float[st.b + 1];
			state.globals_float[st.c + 2] = state.globals_float[st.a + 2] - state.globals_float[st.b + 2];
			continue;
		case OP.mul_f:
			state.globals_float[st.c] = state.globals_float[st.a] * state.globals_float[st.b];
			continue;
		case OP.mul_v:
			state.globals_float[st.c] = state.globals_float[st.a] * state.globals_float[st.b] +
				state.globals_float[st.a + 1] * state.globals_float[st.b + 1] +
				state.globals_float[st.a + 2] * state.globals_float[st.b + 2];
			continue;
		case OP.mul_fv:
			state.globals_float[st.c] = state.globals_float[st.a] * state.globals_float[st.b];
			state.globals_float[st.c + 1] = state.globals_float[st.a] * state.globals_float[st.b + 1];
			state.globals_float[st.c + 2] = state.globals_float[st.a] * state.globals_float[st.b + 2];
			continue;
		case OP.mul_vf:
			state.globals_float[st.c] = state.globals_float[st.b] * state.globals_float[st.a];
			state.globals_float[st.c + 1] = state.globals_float[st.b] * state.globals_float[st.a + 1];
			state.globals_float[st.c + 2] = state.globals_float[st.b] * state.globals_float[st.a + 2];
			continue;
		case OP.div_f:
			state.globals_float[st.c] = state.globals_float[st.a] / state.globals_float[st.b];
			continue;
		case OP.bitand:
			state.globals_float[st.c] = state.globals_float[st.a] & state.globals_float[st.b];
			continue;
		case OP.bitor:
			state.globals_float[st.c] = state.globals_float[st.a] | state.globals_float[st.b];
			continue;
		case OP.ge:
			state.globals_float[st.c] = (state.globals_float[st.a] >= state.globals_float[st.b]) ? 1.0 : 0.0;
			continue;
		case OP.le:
			state.globals_float[st.c] = (state.globals_float[st.a] <= state.globals_float[st.b]) ? 1.0 : 0.0;
			continue;
		case OP.gt:
			state.globals_float[st.c] = (state.globals_float[st.a] > state.globals_float[st.b]) ? 1.0 : 0.0;
			continue;
		case OP.lt:
			state.globals_float[st.c] = (state.globals_float[st.a] < state.globals_float[st.b]) ? 1.0 : 0.0;
			continue;
		case OP.and:
			state.globals_float[st.c] = ((state.globals_float[st.a] !== 0.0) && (state.globals_float[st.b] !== 0.0)) ? 1.0 : 0.0;
			continue;
		case OP.or:
			state.globals_float[st.c] = ((state.globals_float[st.a] !== 0.0) || (state.globals_float[st.b] !== 0.0)) ? 1.0 : 0.0;
			continue;
		case OP.not_f:
			state.globals_float[st.c] = (state.globals_float[st.a] === 0.0) ? 1.0 : 0.0;
			continue;
		case OP.not_v:
			state.globals_float[st.c] = ((state.globals_float[st.a] === 0.0) &&
				(state.globals_float[st.a + 1] === 0.0) &&
				(state.globals_float[st.a + 2] === 0.0)) ? 1.0 : 0.0;
			continue;
		case OP.not_s:
			if (state.globals_int[st.a] !== 0)
				state.globals_float[st.c] = (state.strings[state.globals_int[st.a]] === 0) ? 1.0 : 0.0;
			else
				state.globals_float[st.c] = 1.0;
			continue;
		case OP.not_fnc:
		case OP.not_ent:
			state.globals_float[st.c] = (state.globals_int[st.a] === 0) ? 1.0 : 0.0;
			continue;
		case OP.eq_f:
			state.globals_float[st.c] = (state.globals_float[st.a] === state.globals_float[st.b]) ? 1.0 : 0.0;
			continue;
		case OP.eq_v:
			state.globals_float[st.c] = ((state.globals_float[st.a] === state.globals_float[st.b])
				&& (state.globals_float[st.a + 1] === state.globals_float[st.b + 1])
				&& (state.globals_float[st.a + 2] === state.globals_float[st.b + 2])) ? 1.0 : 0.0;
			continue;
		case OP.eq_s:
			state.globals_float[st.c] = (getString(state.globals_int[st.a]) === getString(state.globals_int[st.b])) ? 1.0 : 0.0;
			continue;
		case OP.eq_e:
		case OP.eq_fnc:
			state.globals_float[st.c] = (state.globals_int[st.a] === state.globals_int[st.b]) ? 1.0 : 0.0;
			continue;
		case OP.ne_f:
			state.globals_float[st.c] = (state.globals_float[st.a] !== state.globals_float[st.b]) ? 1.0 : 0.0;
			continue;
		case OP.ne_v:
			state.globals_float[st.c] = ((state.globals_float[st.a] !== state.globals_float[st.b])
				|| (state.globals_float[st.a + 1] !== state.globals_float[st.b + 1])
				|| (state.globals_float[st.a + 2] !== state.globals_float[st.b + 2])) ? 1.0 : 0.0;
			continue;
		case OP.ne_s:
			state.globals_float[st.c] = (getString(state.globals_int[st.a]) !== getString(state.globals_int[st.b])) ? 1.0 : 0.0;
			continue;
		case OP.ne_e:
		case OP.ne_fnc:
			state.globals_float[st.c] = (state.globals_int[st.a] !== state.globals_int[st.b]) ? 1.0 : 0.0;
			continue;
		case OP.store_f:
		case OP.store_ent:
		case OP.store_fld:
		case OP.store_s:
		case OP.store_fnc:
			state.globals_int[st.b] = state.globals_int[st.a];
			continue;
		case OP.store_v:
			state.globals_int[st.b] = state.globals_int[st.a];
			state.globals_int[st.b + 1] = state.globals_int[st.a + 1];
			state.globals_int[st.b + 2] = state.globals_int[st.a + 2];
			continue;
		case OP.storep_f:
		case OP.storep_ent:
		case OP.storep_fld:
		case OP.storep_s:
		case OP.storep_fnc:
			ptr = state.globals_int[st.b];
			sv.state.server.edicts[Math.floor(ptr / state.edict_size)].v_int[((ptr % state.edict_size) - 96) >> 2] = state.globals_int[st.a];
			continue;
		case OP.storep_v:
			_ed = sv.state.server.edicts[Math.floor(state.globals_int[st.b] / state.edict_size)];
			ptr = ((state.globals_int[st.b] % state.edict_size) - 96) >> 2;
			_ed.v_int[ptr] = state.globals_int[st.a];
			_ed.v_int[ptr + 1] = state.globals_int[st.a + 1];
			_ed.v_int[ptr + 2] = state.globals_int[st.a + 2];
			continue;
		case OP.address:
			_ed = state.globals_int[st.a];
			if ((_ed === 0) && (sv.state.server.loading !== true))
				await runError('assignment to world entity');
			state.globals_int[st.c] = _ed * state.edict_size + 96 + (state.globals_int[st.b] << 2);
			continue;
		case OP.load_f:
		case OP.load_fld:
		case OP.load_ent:
		case OP.load_s:
		case OP.load_fnc:
			state.globals_int[st.c] = sv.state.server.edicts[state.globals_int[st.a]].v_int[state.globals_int[st.b]];
			continue;
		case OP.load_v:
			_ed = sv.state.server.edicts[state.globals_int[st.a]];
			ptr = state.globals_int[st.b];
			state.globals_int[st.c] = _ed.v_int[ptr];
			state.globals_int[st.c + 1] = _ed.v_int[ptr + 1];
			state.globals_int[st.c + 2] = _ed.v_int[ptr + 2];
			continue;
		case OP.jz:
			if (state.globals_int[st.a] === 0)
				s += st.b - 1;
			continue;
		case OP.jnz:
			if (state.globals_int[st.a] !== 0)
				s += st.b - 1;
			continue;
		case OP.jump:
			s += st.a - 1;
			continue;
		case OP.call0:
		case OP.call1:
		case OP.call2:
		case OP.call3:
		case OP.call4:
		case OP.call5:
		case OP.call6:
		case OP.call7:
		case OP.call8:
			state.argc = st.op - OP.call0;
			if (state.globals_int[st.a] === 0)
				await runError('NULL function');
			newf = state.functions[state.globals_int[st.a]];
			if (newf.first_statement < 0)
			{
				ptr = -newf.first_statement;
				if (ptr >= pf.builtin.length)
					await runError('Bad builtin call number');
				await pf.builtin[ptr]();
				continue;
			}
			s = await enterFunction(newf);
			continue;
		case OP.done:
		case OP.ret:
			state.globals_int[1] = state.globals_int[st.a];
			state.globals_int[2] = state.globals_int[st.a + 1];
			state.globals_int[3] = state.globals_int[st.a + 2];
			s = await leaveFunction();
			if (state.depth === exitdepth)
				return;
			continue;
		case OP.state:
			_ed = sv.state.server.edicts[state.globals_int[globalvars.self]];
			_ed.v_float[entvars.nextthink] = state.globals_float[globalvars.time] + 0.1;
			_ed.v_float[entvars.frame] = state.globals_float[st.a];
			_ed.v_int[entvars.think] = state.globals_int[st.b];
			continue;
		}
		await runError('Bad opcode ' + st.op);
	}
};

export const getString = function(num)
{
	var string = [], c;
	for (; num < state.strings.length; ++num)
	{
		if (state.strings[num] === 0)
			break;
		string[string.length] = String.fromCharCode(state.strings[num]);
	}
	return string.join('');
};

export const newString = function(s, length)
{
	var ofs = state.strings.length;
	var i;
	if (s.length >= length)
	{
		for (i = 0; i < (length - 1); ++i)
			state.strings[state.strings.length] = s.charCodeAt(i);
		state.strings[state.strings.length] = 0;
		return ofs;
	}
	for (i = 0; i < s.length; ++i)
		state.strings[state.strings.length] = s.charCodeAt(i);
	length -= s.length;
	for (i = 0; i < length; ++i)
		state.strings[state.strings.length] = 0;
	return ofs;
};

export const tempString = function(string)
{
	var i;
	if (string.length > 127)
		string = string.substring(0, 127);
	for (i = 0; i < string.length; ++i)
		state.strings[state.string_temp + i] = string.charCodeAt(i);
	state.strings[state.string_temp + string.length] = 0;
};