import * as con from './console'
import * as pr from './pr'
import * as sv from './sv'
import * as sys from './sys'
import * as q from './q'
import * as com from './com'
import * as host from './host'
import * as def from './def'
import * as cmd from './cmd'
import * as vec from './vec'

export const clearEdict = function(e)
{
	var i;
	for (i = 0; i < pr.state.entityfields; ++i)
		e.v_int[i] = 0;
	e.free = false;
};

export const alloc = function()
{
	var i, e;
	for (i = sv.state.svs.maxclients + 1; i < sv.state.server.num_edicts; ++i)
	{
		e = sv.state.server.edicts[i];
		if ((e.free === true) && ((e.freetime < 2.0) || ((sv.state.server.time - e.freetime) > 0.5)))
		{
			clearEdict(e);
			return e;
		}
	}
	if (i === def.max_edicts)
		sys.error('ED.Alloc: no free edicts');
	e = sv.state.server.edicts[sv.state.server.num_edicts++];
	clearEdict(e);
	return e;
};

export const free = function(ed)
{
	sv.unlinkEdict(ed);
	ed.free = true;
	ed.v_int[pr.entvars.model] = 0;
	ed.v_float[pr.entvars.takedamage] = 0.0;
	ed.v_float[pr.entvars.modelindex] = 0.0;
	ed.v_float[pr.entvars.colormap] = 0.0;
	ed.v_float[pr.entvars.skin] = 0.0;
	ed.v_float[pr.entvars.frame] = 0.0;
	setVector(ed, pr.entvars.origin, vec.origin);
	setVector(ed, pr.entvars.angles, vec.origin);
	ed.v_float[pr.entvars.nextthink] = -1.0;
	ed.v_float[pr.entvars.solid] = 0.0;
	ed.freetime = sv.state.server.time;
};

export const globalAtOfs = function(ofs)
{
	var i, def;
	for (i = 0; i < pr.state.globaldefs.length; ++i)
	{
		def = pr.state.globaldefs[i];
		if (def.ofs === ofs)
			return def;
	}
};

export const fieldAtOfs = function(ofs)
{
	var i, def;
	for (i = 0; i < pr.state.fielddefs.length; ++i)
	{
		def = pr.state.fielddefs[i];
		if (def.ofs === ofs)
			return def;
	}
};

export const findField = function(name)
{
	var def, i;
	for (i = 0; i < pr.state.fielddefs.length; ++i)
	{
		def = pr.state.fielddefs[i];
		if (pr.getString(def.name) === name)
			return def;
	}
};

export const findGlobal = function(name)
{
	var def, i;
	for (i = 0; i < pr.state.globaldefs.length; ++i)
	{
		def = pr.state.globaldefs[i];
		if (pr.getString(def.name) === name)
			return def;
	}
};

export const findFunction = function(name)
{
	var i;
	for (i = 0; i < pr.state.functions.length; ++i)
	{
		if (pr.getString(pr.state.functions[i].name) === name)
			return i;
	}
};

export const print = function(ed)
{
	if (ed.free === true)
	{
		con.print('FREE\n');
		return;
	}
	con.print('\nEDICT ' + ed.num + ':\n');
	var i, d, name, v, l;
	for (i = 1; i < pr.state.fielddefs.length; ++i)
	{
		d = pr.state.fielddefs[i];
		name = pr.getString(d.name);
		if (name.charCodeAt(name.length - 2) === 95)
			continue;
		v = d.ofs;
		if (ed.v_int[v] === 0)
		{
			if ((d.type & 0x7fff) === 3)
			{
				if ((ed.v_int[v + 1] === 0) && (ed.v_int[v + 2] === 0))
					continue;
			}
			else
				continue;
		}
		for (; name.length <= 14; )
			name += ' ';
		con.print(name + pr.valueString(d.type, ed.v, v) + '\n');
	}
};

export const printEdicts = function()
{
	if (sv.state.server.active !== true)
		return;
	con.print(sv.state.server.num_edicts + ' entities\n');
	var i;
	for (i = 0; i < sv.state.server.num_edicts; ++i)
		print(sv.state.server.edicts[i]);
};

export const printEdict_f = function()
{
	if (sv.state.server.active !== true)
		return;
	var i = q.atoi(cmd.state.argv[1]);
	if ((i >= 0) && (i < sv.state.server.num_edicts))
	  print(sv.state.server.edicts[i]);
};

export const count = function()
{
	if (sv.state.server.active !== true)
		return;
	var i, ent, active = 0, models = 0, solid = 0, step = 0;
	for (i = 0; i < sv.state.server.num_edicts; ++i)
	{
		ent = sv.state.server.edicts[i];
		if (ent.free === true)
			continue;
		++active;
		if (ent.v_float[pr.entvars.solid] !== 0.0)
			++solid;
		if (ent.v_int[pr.entvars.model] !== 0)
			++models;
		if (ent.v_float[pr.entvars.movetype] === sv.MOVE_TYPE.step)
			++step;
	}
	var num_edicts = sv.state.server.num_edicts;
	con.print('num_edicts:' + (num_edicts <= 9 ? '  ' : (num_edicts <= 99 ? ' ' : '')) + num_edicts + '\n');
	con.print('active    :' + (active <= 9 ? '  ' : (active <= 99 ? ' ' : '')) + active + '\n');
	con.print('view      :' + (models <= 9 ? '  ' : (models <= 99 ? ' ' : '')) + models + '\n');
	con.print('touch     :' + (solid <= 9 ? '  ' : (solid <= 99 ? ' ' : '')) + solid + '\n');
	con.print('step      :' + (step <= 9 ? '  ' : (step <= 99 ? ' ' : '')) + step + '\n');
};

export const parseGlobals = async function(data)
{
	var keyname, key;
	for (;;)
	{
		data = com.parse(data);
		if (com.state.token.charCodeAt(0) === 125)
			return;
		if (data == null)
			sys.error('parseGlobals: EOF without closing brace');
		keyname = com.state.token;
		data = com.parse(data);
		if (data == null)
			sys.error('parseGlobals: EOF without closing brace');
		if (com.state.token.charCodeAt(0) === 125)
			sys.error('parseGlobals: closing brace without data');
		key = findGlobal(keyname);
		if (key == null)
		{
			con.print('\'' + keyname + '\' is not a global\n');
			continue;
		}
		if (parseEpair(pr.state.globals, key, com.state.token) !== true)
			await host.error('parseGlobals: parse error');
	}
};

export const newString = function(string)
{
	var newstring = [], i, c;
	for (i = 0; i < string.length; ++i)
	{
		c = string.charCodeAt(i);
		if ((c === 92) && (i < (string.length - 1)))
		{
			++i;
			newstring[newstring.length] = (string.charCodeAt(i) === 110) ? '\n' : '\\';
		}
		else
			newstring[newstring.length] = String.fromCharCode(c);
	}
	return pr.newString(newstring.join(''), string.length + 1);
};

export const parseEpair = function(base, key, s)
{
	var d_float = new Float32Array(base);
	var d_int = new Int32Array(base);
	var d, v;
	switch (key.type & 0x7fff)
	{
	case pr.ETYPE.ev_string:
		d_int[key.ofs] = newString(s);
		return true;
	case pr.ETYPE.ev_float:
		d_float[key.ofs] = q.atof(s);
		return true;
	case pr.ETYPE.ev_vector:
		v = s.split(' ');
		d_float[key.ofs] = q.atof(v[0]);
		d_float[key.ofs + 1] = q.atof(v[1]);
		d_float[key.ofs + 2] = q.atof(v[2]);
		return true;
	case pr.ETYPE.ev_entity:
		d_int[key.ofs] = q.atoi(s);
		return true;
	case pr.ETYPE.ev_field:
		d = findField(s);
		if (d == null)
		{
			con.print('Can\'t find field ' + s + '\n');
			return;
		}
		d_int[key.ofs] = d.ofs;
		return true;
	case pr.ETYPE.ev_function:
		d = findFunction(s);
		if (d == null)
		{
			con.print('Can\'t find function ' + s + '\n');
			return;
		}
		d_int[key.ofs] = d;
	}
	return true;
};

export const parseEdict = async function(data, ent)
{
	var i, init, anglehack, keyname, n, key;
	if (ent !== sv.state.server.edicts[0])
	{
		for (i = 0; i < pr.state.entityfields; ++i)
			ent.v_int[i] = 0;
	}
	for (;;)
	{
		data = com.parse(data);
		if (com.state.token.charCodeAt(0) === 125)
			break;
		if (data == null)
			sys.error('parseEdict: EOF without closing brace');
		if (com.state.token === 'angle')
		{
			com.state.token = 'angles';
			anglehack = true;
		}
		else
		{
			anglehack = false;
			if (com.state.token === 'light')
      com.state.token = 'light_lev';
		}
		for (n = com.state.token.length; n > 0; --n)
		{
			if (com.state.token.charCodeAt(n - 1) !== 32)
				break;
		}
		keyname = com.state.token.substring(0, n);
		data = com.parse(data);
		if (data == null)
			sys.error('parseEdict: EOF without closing brace');
		if (com.state.token.charCodeAt(0) === 125)
			sys.error('parseEdict: closing brace without data');
		init = true;
		if (keyname.charCodeAt(0) === 95)
			continue;
		key = findField(keyname);
		if (key == null)
		{
			con.print('\'' + keyname + '\' is not a field\n');
			continue;
		}
		if (anglehack == true)
      com.state.token = '0 ' + com.state.token + ' 0';
		if (parseEpair(ent.v, key, com.state.token) !== true)
			await host.error('parseEdict: parse error');
	}
	if (init !== true)
		ent.free = true;
	return data;
};

export const loadFromFile = async function(data)
{
	var ent, spawnflags, inhibit = 0, func;
	pr.state.globals_float[pr.globalvars.time] = sv.state.server.time;

	for (;;)
	{
		data = com.parse(data);
		if (data == null)
			break;
		if (com.state.token.charCodeAt(0) !== 123)
			sys.error('ED.LoadFromFile: found ' + com.state.token + ' when expecting {');

		if (ent == null)
			ent = sv.state.server.edicts[0];
		else
			ent = alloc();
		data = await parseEdict(data, ent);

		spawnflags = ent.v_float[pr.entvars.spawnflags] >> 0;
		if (host.cvr.deathmatch.value !== 0)
		{
			if ((spawnflags & 2048) !== 0)
			{
				free(ent);
				++inhibit;
				continue;
			}
		}
		else if (((host.state.current_skill === 0) && ((spawnflags & 256) !== 0))
			|| ((host.state.current_skill === 1) && ((spawnflags & 512) !== 0))
			|| ((host.state.current_skill >= 2) && ((spawnflags & 1024) !== 0)))
		{
			free(ent);
			++inhibit;
			continue;
		}

		if (ent.v_int[pr.entvars.classname] === 0)
		{
			con.print('No classname for:\n');
			print(ent);
			free(ent);
			continue;
		}

		func = findFunction(pr.getString(ent.v_int[pr.entvars.classname]));
		if (func == null)
		{
			con.print('No spawn function for:\n');
			print(ent);
			free(ent);
			continue;
		}

		pr.state.globals_int[pr.globalvars.self] = ent.num;
		await pr.executeProgram(func);
	}

	con.dPrint(inhibit + ' entities inhibited\n');
};

export const vector = function(e, o)
{
	return [e.v_float[o], e.v_float[o + 1], e.v_float[o + 2]];
};

export const setVector = function(e, o, v)
{
	e.v_float[o] = v[0];
	e.v_float[o + 1] = v[1];
	e.v_float[o + 2] = v[2];
};