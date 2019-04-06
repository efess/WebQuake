import * as sv from './sv'
import * as cmd from './cmd'
import * as com from './com'
import * as chase from './chase'
import * as sys from './sys'
import * as con from './console'
import * as cl from './cl'
import * as v from './v'
import * as w from './w'
import * as key from './key'
import * as pr from './pr'
import * as mod from './mod'
import * as net from './net'
import * as vid from './vid'
import * as draw from './draw'
import * as scr from './scr'
import * as r from './r'
import * as msg from './msg'
import * as s from './s'
import * as cdAudio from './cdAudio'
import * as sbar from './sbar'
import * as m from './m'
import * as input from './input'
import * as cvar from './cvar'
import * as def from './def'
import * as protocol from './protocol'
import * as ed from './ed'
import * as q from './q'
import * as vec from './vec'
import * as sz from './sz'
import IAssetStore from './interfaces/store/IAssetStore';
import INetworkDriver from './interfaces/net/INetworkDriver';

export let state = {
  time3: 0.0,
  timetotal: 0.0,
  timecount: 0,
  inerror: false,
  realtime: 0.0,
  oldrealtime: 0.0,
  initialized: false,
  frametime: 0.0,
  client: null,
  framecount: 0
} as any

export const cvr = {
} as any

const initState = () => {
  state = {
    time3: 0.0,
    timetotal: 0.0,
    timecount: 0,
    inerror: false,
    realtime: 0.0,
    oldrealtime: 0.0,
    initialized: false,
    frametime: 0.0,
    client: null,
    framecount: 0
  }
}

export const endGame = async function(message: string)
{
  con.dPrint('Host.EndGame: ' + message + '\n');
  if (cl.cls.demonum !== -1)
    cl.nextDemo();
  else
    await cl.disconnect();
  throw 'Host.abortserver';
};

const findMaxClients = function()
{
	var i = com.checkParm('-maxplayers');
	sv.state.svs.maxclients = state.dedicated ? 8 : 1
	if (i != null)
	{
		++i;
		if (i < com.state.argv.length)
		{
			sv.state.svs.maxclients = q.atoi(com.state.argv[i]);
			if (sv.state.svs.maxclients <= 0)
                sv.state.svs.maxclients = 8;
			else if (sv.state.svs.maxclients > 16)
                sv.state.svs.maxclients = 16;
		} 
	}

  sv.state.svs.maxclientslimit = sv.state.svs.maxclients;
  cl.cls.state = cl.ACTIVE.disconnected;
  sv.state.svs.clients = []
	for (i = 0; i < sv.state.svs.maxclientslimit; ++i)
	{
    sv.state.svs.clients[i] = {
      num: i,
      message: {data: new ArrayBuffer(8000), cursize: 0, allowoverflow: true},
      colors: 0,
      old_frags: 0
    };
  }
	if (sv.state.svs.maxclients > 1)
		cvar.setValue('deathmatch', 1);
	else
		cvar.setValue('deathmatch', 0);
};

const clientPrint = function(string)
{
  msg.writeByte(state.client.message, protocol.SVC.print);
  msg.writeString(state.client.message, string);
};

export const broadcastPrint = function(string)
{
  var i, client;
  for (i = 0; i < sv.state.svs.maxclients; ++i)
  {
    client = sv.state.svs.clients[i];
    if ((client.active !== true) || (client.spawned !== true))
      continue;
    msg.writeByte(client.message, protocol.SVC.print);
    msg.writeString(client.message, string);
  }
};

export const dropClient = async function(crash: boolean)
{
  var client = state.client;
  if (crash !== true)
  {
    if (net.canSendMessage(client.netconnection) === true)
    {
      msg.writeByte(client.message, protocol.SVC.disconnect);
      net.sendMessage(client.netconnection, client.message);
    }
    if ((client.edict != null) && (client.spawned === true))
    {
      var saveSelf = pr.state.globals_int[pr.globalvars.self];
      pr.state.globals_int[pr.globalvars.self] = client.edict.num;
      await pr.executeProgram(pr.state.globals_int[pr.globalvars.ClientDisconnect]);
      pr.state.globals_int[pr.globalvars.self] = saveSelf;
    }
    sys.print('Client ' + sv.getClientName(client) + ' removed\n');
  }
  net.close(client.netconnection);
  client.netconnection = null;
  client.active = false;
  sv.setClientName(client, '');
  client.old_frags = -999999;
  --net.state.activeconnections;
  var i, num = client.num;
  for (i = 0; i < sv.state.svs.maxclients; ++i)
  {
    client = sv.state.svs.clients[i];
    if (client.active !== true)
      continue;
    msg.writeByte(client.message, protocol.SVC.updatename);
    msg.writeByte(client.message, num);
    msg.writeByte(client.message, 0);
    msg.writeByte(client.message, protocol.SVC.updatefrags);
    msg.writeByte(client.message, num);
    msg.writeShort(client.message, 0);
    msg.writeByte(client.message, protocol.SVC.updatecolors);
    msg.writeByte(client.message, num);
    msg.writeByte(client.message, 0);
  }
};

const writeConfiguration = function()
{
  com.writeTextFile('config.cfg', key.writeBindings() + cvar.writeVariables());
};

const serverFrame = async function()
{
  pr.state.globals_float[pr.globalvars.frametime] = state.frametime;
  sv.state.server.datagram.cursize = 0;
  await sv.checkForNewClients();
  await sv.runClients();
  if ((sv.state.server.paused !== true) && ((sv.state.svs.maxclients >= 2) || (key.state.dest === key.KEY_DEST.game)))
    await sv.physics();
  await sv.sendClientMessages();
};


export const remoteCommand = function(from, data, password)
{
	if ((state.cvr.rcon_password.string.length === 0) || (password !== state.cvr.rcon_password.string))
	{
		con.print('Bad rcon from ' + from + ':\n' + data + '\n');
		return;
	};
	con.print('Rcon from ' + from + ':\n' + data + '\n');
	cmd.executeString(data);
	return true;
};

const getConsoleCommands = function()
{
	var command;
	for (;;)
	{
		command = sys.getExternalCommand();
		if (command == null)
			return;
		cmd.state.text += command;
	}
};

const _frame = async function()
{
  Math.random();

  state.realtime = sys.floatTime();
  state.frametime = state.realtime - state.oldrealtime;
  state.oldrealtime = state.realtime;
  if (cvr.framerate.value > 0)
    cvr.frametime = cvr.framerate.value;
  else
  {
    if (state.frametime > 0.1)
      state.frametime = 0.1;
    else if (state.frametime < 0.001)
      state.frametime = 0.001;
  }

  if (cl.cls.state === cl.ACTIVE.connecting)
  {
    await net.checkForResend();
    if (!state.dedicated){
      scr.updateScreen();
    }
    return;
  }

  var time1, time2, pass1, pass2, pass3, tot;

  await cmd.execute();

  await cl.sendCmd();
  if (sv.state.server.active === true)
    await serverFrame();

  if (cl.cls.state === cl.ACTIVE.connected)
    await cl.readFromServer();

  if (cvr.speeds.value !== 0)
    time1 = sys.floatTime();
  
  if (!state.dedicated) {
    scr.updateScreen();
  }
  if (cvr.speeds.value !== 0)
    time2 = sys.floatTime();

  if (!state.dedicated) {
    if (cl.cls.signon === 4)
    {
      await s.update(r.state.refdef.vieworg, r.state.vpn, r.state.vright, r.state.vup);
      cl.decayLights();
    }
    else
      await s.update(vec.origin, vec.origin, vec.origin, vec.origin);
    cdAudio.update();
  
    if (cvr.speeds.value !== 0)
    {
      pass1 = (time1 - state.time3) * 1000.0;
      state.time3 = sys.floatTime();
      pass2 = (time2 - time1) * 1000.0;
      pass3 = (state.time3 - time2) * 1000.0;
      tot = Math.floor(pass1 + pass2 + pass3);
      con.print((tot <= 99 ? (tot <= 9 ? '  ' : ' ') : '')
        + tot + ' tot '
        + (pass1 < 100.0 ? (pass1 < 10.0 ? '  ' : ' ') : '')
        + Math.floor(pass1) + ' server '
        + (pass2 < 100.0 ? (pass2 < 10.0 ? '  ' : ' ') : '')
        + Math.floor(pass2) + ' gfx '
        + (pass3 < 100.0 ? (pass3 < 10.0 ? '  ' : ' ') : '')
        + Math.floor(pass3) + ' snd\n');
    }
  
    if (state.startdemos === true)
    {
      cl.nextDemo();
      state.startdemos = false;
    }
  }
  getConsoleCommands()
  ++state.framecount;
};

// Commands

export const quit_f = function()
{
  if (key.state.dest !== key.KEY_DEST.console)
  {
    m.menu_Quit_f();
    return;
  }
  sys.quit();
};

const status_f = function()
{
  var print;
  if (cmd.state.client !== true)
  {
    if (sv.state.server.active !== true)
    {
      cmd.forwardToServer();
      return;
    }
    print = con.print;
  }
  else
    print = sv.state.ClientPrint;
  print('host:    ' + net.cvr.hostname.string + '\n');
  print('version: 1.09\n');
  print('map:     ' + pr.getString(pr.state.globals_int[pr.globalvars.mapname]) + '\n');
  print('players: ' + net.state.activeconnections + ' active (' + sv.state.svs.maxclients + ' max)\n\n');
  var i, client, str, frags, hours, minutes, seconds;
  for (i = 0; i < sv.state.svs.maxclients; ++i)
  {
    client = sv.state.svs.clients[i];
    if (client.active !== true)
      continue;
    frags = client.edict.v_float[pr.entvars.frags].toFixed(0);
    if (frags.length === 1)
      frags = '  ' + frags;
    else if (frags.length === 2)
      frags = ' ' + frags;
    seconds = (net.state.time - client.netconnection.connecttime) >> 0;
    minutes = (seconds / 60) >> 0;
    if (minutes !== 0)
    {
      seconds -= minutes * 60;
      hours = (minutes / 60) >> 0;
      if (hours !== 0)
        minutes -= hours * 60;
    }
    else
      hours = 0;
    str = '#' + (i + 1) + ' ';
    if (i <= 8)
      str += ' ';
    str += sv.getClientName(client);
    for (; str.length <= 21; )
      str += ' ';
    str += frags + '  ';
    if (hours <= 9)
      str += ' ';
    str += hours + ':';
    if (minutes <= 9)
      str += '0';
    str += minutes + ':';
    if (seconds <= 9)
      str += '0';
    print(str + seconds + '\n');
    print('   ' + client.netconnection.address + '\n');
  }
};

const god_f = function()
{
  if (cmd.state.client !== true)
  {
    cmd.forwardToServer();
    return;
  }
  if (pr.state.globals_float[pr.globalvars.deathmatch] !== 0)
    return;
  sv.state.player.v_float[pr.entvars.flags] ^= sv.FL.godmode;
  if ((sv.state.player.v_float[pr.entvars.flags] & sv.FL.godmode) === 0)
    clientPrint('godmode OFF\n');
  else
    clientPrint('godmode ON\n');
};

const notarget_f = function()
{
  if (cmd.state.client !== true)
  {
    cmd.forwardToServer();
    return;
  }
  if (pr.state.globals_float[pr.globalvars.deathmatch] !== 0)
    return;
  sv.state.player.v_float[pr.entvars.flags] ^= sv.FL.notarget;
  if ((sv.state.player.v_float[pr.entvars.flags] & sv.FL.notarget) === 0)
    clientPrint('notarget OFF\n');
  else
    clientPrint('notarget ON\n');
};

const noclip_f = function()
{
  if (cmd.state.client !== true)
  {
    cmd.forwardToServer();
    return;
  }
  if (pr.state.globals_float[pr.globalvars.deathmatch] !== 0)
    return;
  if (sv.state.player.v_float[pr.entvars.movetype] !== sv.MOVE_TYPE.noclip)
  {
    state.noclip_anglehack = true;
    sv.state.player.v_float[pr.entvars.movetype] = sv.MOVE_TYPE.noclip;
    clientPrint('noclip ON\n');
    return;
  }
  state.noclip_anglehack = false;
  sv.state.player.v_float[pr.entvars.movetype] = sv.MOVE_TYPE.walk;
  clientPrint('noclip OFF\n');
};

const fly_f = function()
{
  if (cmd.state.client !== true)
  {
    cmd.forwardToServer();
    return;
  }
  if (pr.state.globals_float[pr.globalvars.deathmatch] !== 0)
    return;
  if (sv.state.player.v_float[pr.entvars.movetype] !== sv.MOVE_TYPE.fly)
  {
    sv.state.player.v_float[pr.entvars.movetype] = sv.MOVE_TYPE.fly;
    clientPrint('flymode ON\n');
    return;
  }
  sv.state.player.v_float[pr.entvars.movetype] = sv.MOVE_TYPE.walk;
  clientPrint('flymode OFF\n');
};

const ping_f = function()
{
  if (cmd.state.client !== true)
  {
    cmd.forwardToServer();
    return;
  }
  clientPrint('Client ping times:\n');
  var i, client, total, j;
  for (i = 0; i < sv.state.svs.maxclients; ++i)
  {
    client = sv.state.svs.clients[i];
    if (client.active !== true)
      continue;
    total = 0;
    for (j = 0; j <= 15; ++j)
      total += client.ping_times[j];
    total = (total * 62.5).toFixed(0);
    if (total.length === 1)
      total = '   ' + total;
    else if (total.length === 2)
      total = '  ' + total;
    else if (total.length === 3)
      total = ' ' + total;
    clientPrint(total + ' ' + sv.getClientName(client) + '\n');
  }
};

const map_f = async function()
{
  if (cmd.state.argv.length <= 1)
  {
    con.print('USAGE: map <map>\n');
    return;
  }
  if (cmd.state.client === true)
    return;
  
  if (!state.dedicated) {
    cl.cls.demonum = -1;
    await cl.disconnect();
  }
  await shutdownServer(false);
  key.state.dest = key.KEY_DEST.game
  if (!state.dedicated) {
    scr.beginLoadingPlaque();
  }
  sv.state.svs.serverflags = 0;
  await sv.spawnServer(cmd.state.argv[1]);
  if (!state.dedicated) {
    if (sv.state.server.active !== true)
      return;
    cl.cls.spawnparms = '';
    var i;
    for (i = 2; i < cmd.state.argv.length; ++i)
      cl.cls.spawnparms += cmd.state.argv[i] + ' ';
    await cmd.executeString('connect local', null);
  }
};

const changelevel_f = async function()
{
  if (cmd.state.argv.length !== 2)
  {
    con.print('changelevel <levelname> : continue game on a new level\n');
    return;
  }
  if ((sv.state.server.active !== true) || (cl.cls.demoplayback === true))
  {
    con.print('Only the server may changelevel\n');
    return;
  }
  await sv.saveSpawnparms();
  await sv.spawnServer(cmd.state.argv[1]);
};

const restart_f = async function()
{
  if ((cl.cls.demoplayback !== true) && (sv.state.server.active === true) && (cmd.state.client !== true))
    await sv.spawnServer(pr.getString(pr.state.globals_int[pr.globalvars.mapname]));
};

const reconnect_f = function()
{
  if (!state.dedicated) {
    scr.beginLoadingPlaque();
  }
  cl.cls.signon = 0;
};

const connect_f = async function()
{
  cl.cls.demonum = -1;
  if (cl.cls.demoplayback === true)
  {
    cl.stopPlayback();
    await cl.disconnect();
  }
  await cl.establishConnection(cmd.state.argv[1]);
  cl.cls.signon = 0;
};

const savegameComment = function()
{
  var text = cl.clState.levelname.replace(/\s/gm, '_');
  var i;
  for (i = cl.clState.levelname.length; i <= 21; ++i)
    text += '_';

  text += 'kills:';
  var kills = cl.clState.stats[def.STAT.monsters].toString();
  if (kills.length === 2)
    text += '_';
  else if (kills.length === 1)
    text += '__';
  text += kills + '/';
  kills = cl.clState.stats[def.STAT.totalmonsters].toString();
  if (kills.length === 2)
    text += '_';
  else if (kills.length === 1)
    text += '__';
  text += kills;

  return text + '____';
};

const savegame_f = function()
{
  if (cmd.state.client === true)
    return;
  if (sv.state.server.active !== true)
  {
    con.print('Not playing a local game.\n');
    return;
  }
  if (cl.clState.intermission !== 0)
  {
    con.print('Can\'t save in intermission.\n');
    return;
  }
  if (sv.state.svs.maxclients !== 1)
  {
    con.print('Can\'t save multiplayer games.\n');
    return;
  }
  if (cmd.state.argv.length !== 2)
  {
    con.print('save <savename> : save a game\n');
    return;
  }
  if (cmd.state.argv[1].indexOf('..') !== -1)
  {
    con.print('Relative pathnames are not allowed.\n');
    return;
  }
  var client = sv.state.svs.clients[0];
  if (client.active === true)
  {
    if (client.edict.v_float[pr.entvars.health] <= 0.0)
    {
      con.print('Can\'t savegame with a dead player\n');
      return;
    }
  }
  var f = ['5\n' + savegameComment() + '\n'];
  var i;
  for (i = 0; i <= 15; ++i)
    f[f.length] = client.spawn_parms[i].toFixed(6) + '\n';
  f[f.length] = state.current_skill + '\n' + pr.getString(pr.state.globals_int[pr.globalvars.mapname]) + '\n' + sv.state.server.time.toFixed(6) + '\n';
  for (i = 0; i <= 63; ++i)
  {
    if (sv.state.server.lightstyles[i].length !== 0)
      f[f.length] = sv.state.server.lightstyles[i] + '\n';
    else
      f[f.length] = 'm\n';
  }
  f[f.length] = '{\n';
  var def, type;
  for (i = 0; i < pr.state.globaldefs.length; ++i)
  {
    def = pr.state.globaldefs[i];
    type = def.type;
    if ((type & 0x8000) === 0)
      continue;
    type &= 0x7fff;
    if ((type !== pr.ETYPE.ev_string) && (type !== pr.ETYPE.ev_float) && (type !== pr.ETYPE.ev_entity))
      continue;
    f[f.length] = '"' + pr.getString(def.name) + '" "' + pr.uglyValueString(type, pr.state.globals, def.ofs) + '"\n';
  }
  f[f.length] = '}\n';
  var ed, j, name, v;
  for (i = 0; i < sv.state.server.num_edicts; ++i)
  {
    ed = sv.state.server.edicts[i];
    if (ed.free === true)
    {
      f[f.length] = '{\n}\n';
      continue;
    }
    f[f.length] = '{\n';
    for (j = 1; j < pr.state.fielddefs.length; ++j)
    {
      def = pr.state.fielddefs[j];
      name = pr.getString(def.name);
      if (name.charCodeAt(name.length - 2) === 95)
        continue;
      type = def.type & 0x7fff;
      v = def.ofs;
      if (ed.v_int[v] === 0)
      {
        if (type === 3)
        {
          if ((ed.v_int[v + 1] === 0) && (ed.v_int[v + 2] === 0))
            continue;
        }
        else
          continue;
      }
      f[f.length] = '"' + name + '" "' + pr.uglyValueString(type, ed.v, def.ofs) + '"\n';
    }
    f[f.length] = '}\n';
  }
  name = com.defaultExtension(cmd.state.argv[1], '.sav');
  con.print('Saving game to ' + name + '...\n');
  if (com.writeTextFile(name, f.join('')) === true)
    con.print('done.\n');
  else
    con.print('ERROR: couldn\'t open.\n');
};

const loadgame_f = async function()
{
  if (cmd.state.client === true)
    return;
  if (cmd.state.argv.length !== 2)
  {
    con.print('load <savename> : load a game\n');
    return;
  }
  cl.cls.demonum = -1;
  var name = com.defaultExtension(cmd.state.argv[1], '.sav');
  con.print('Loading game from ' + name + '...\n');
  var f = await com.loadTextFile(name);
  if (f == null)
  {
    con.print('ERROR: couldn\'t open.\n');
    return;
  }
  var flines = f.split('\n');

  var i;

  var tfloat = parseFloat(flines[0]);
  if (tfloat !== 5)
  {
    con.print('Savegame is version ' + tfloat + ', not 5\n');
    return;
  }

  var spawn_parms = [];
  for (i = 0; i <= 15; ++i)
    spawn_parms[i] = parseFloat(flines[2 + i]);

  state.current_skill = (parseFloat(flines[18]) + 0.1) >> 0;
  cvar.setValue('skill', state.current_skill);

  var time = parseFloat(flines[20]);
  await cl.disconnect();
  await sv.spawnServer(flines[19]);
  if (sv.state.server.active !== true)
  {
    con.print('Couldn\'t load map\n');
    return;
  }
  sv.state.server.paused = true;
  sv.state.server.loadgame = true;

  for (i = 0; i <= 63; ++i)
    sv.state.server.lightstyles[i] = flines[21 + i];

  var token, keyname, key, i;

  if (flines[85] !== '{')
    sys.error('First token isn\'t a brace');
  for (i = 86; i < flines.length; ++i)
  {
    if (flines[i] === '}')
    {
      ++i;
      break;
    }
    token = flines[i].split('"');
    keyname = token[1];
    key = ed.findGlobal(keyname);
    if (key == null)
    {
      con.print('\'' + keyname + '\' is not a global\n');
      continue;
    }
    if (ed.parseEpair(pr.state.globals, key, token[3]) !== true)
      await error('Host.Loadgame_f: parse error');
  }

  flines[flines.length] = '';
  var entnum = 0, ent, j;
  var data = flines.slice(i).join('\n');
  for (;;)
  {
    data = com.parse(data);
    if (data == null)
      break;
    if (com.state.token.charCodeAt(0) !== 123)
      sys.error('Host.Loadgame_f: found ' + com.state.token + ' when expecting {');
    ent = sv.state.server.edicts[entnum++];
    for (j = 0; j < pr.state.entityfields; ++j)
      ent.v_int[j] = 0;
    ent.free = false;
    data = await ed.parseEdict(data, ent);
    if (ent.free !== true)
      await sv.linkEdict(ent, false);
  }
  sv.state.server.num_edicts = entnum;

  sv.state.server.time = time;
  var client = sv.state.svs.clients[0];
  client.spawn_parms = [];
  for (i = 0; i <= 15; ++i)
    client.spawn_parms[i] = spawn_parms[i];
  await cl.establishConnection('local');
  reconnect_f();
};

const name_f = function()
{
  if (cmd.state.argv.length <= 1)
  {
    con.print('"name" is "' + cl.cvr.name.string + '"\n');
    return; 
  }

  var newName;
  if (cmd.state.argv.length === 2)
    newName = cmd.state.argv[1].substring(0, 15);
  else
    newName = cmd.state.args.substring(0, 15);

  if (cmd.state.client !== true)
  {
    cvar.set('_cl_name', newName);
    if (cl.cls.state === cl.ACTIVE.connected)
      cmd.forwardToServer();
    return;
  }

  var name = sv.getClientName(state.client);
  if ((name.length !== 0) && (name !== 'unconnected') && (name !== newName))
    con.print(name + ' renamed to ' + newName + '\n');
  sv.setClientName(state.client, newName);
  var _msg = sv.state.server.reliable_datagram;
  msg.writeByte(_msg, protocol.SVC.updatename);
  msg.writeByte(_msg, state.client.num);
  msg.writeString(_msg, newName);
};

const version_f = function()
{
  con.print('Version 1.09\n');
  con.print(def.timedate);
};

const say = function(teamonly: boolean = false)
{
  if (cmd.state.client !== true)
  {
    cmd.forwardToServer();
    return;
  }
  if (cmd.state.argv.length <= 1)
    return;
  var save = state.client;
  var p = cmd.state.args;
  if (p.charCodeAt(0) === 34)
    p = p.substring(1, p.length - 1);
  let text = '\x01' + sv.getClientName(save) + ': ';
  var i = 62 - text.length;
  if (p.length > i)
    p = p.substring(0, i);
  text += p + '\n';
  var client;
  for (i = 0; i < sv.state.svs.maxclients; ++i)
  {
    client = sv.state.svs.clients[i];
    if ((client.active !== true) || (client.spawned !== true))
      continue;
    if ((cvr.teamplay.value !== 0) && (teamonly === true) && (client.v_float[pr.entvars.team] !== save.v_float[pr.entvars.team]))
      continue;
    state.client = client;
    clientPrint(text);
  }
  state.client = save;
  sys.print(text.substring(1));
};

const say_Team_f = function()
{
  say(true);
};

const tell_f = function()
{
  if (cmd.state.client !== true)
  {
    cmd.forwardToServer();
    return;
  }
  if (cmd.state.argv.length <= 2)
    return;
  var text = sv.getClientName(state.client) + ': ';
  var p = cmd.state.args;
  if (p.charCodeAt(0) === 34)
    p = p.substring(1, p.length - 1);
  var i = 62 - text.length;
  if (p.length > i)
     p = p.substring(0, i);
  text += p + '\n';
  var save = state.client, client;
  for (i = 0; i < sv.state.svs.maxclients; ++i)
  {
    client = sv.state.svs.clients[i];
    if ((client.active !== true) || (client.spawned !== true))
      continue;
    if (sv.getClientName(client).toLowerCase() !== cmd.state.argv[1].toLowerCase())
      continue;
    state.client = client;
    clientPrint(text);
    break;
  }
  state.client = save;
};

const color_f = function()
{
  if (cmd.state.argv.length <= 1)
  {
    con.print('"color" is "' + (cl.cvr.color.value >> 4) + ' ' + (cl.cvr.color.value & 15) + '"\ncolor <0-13> [0-13]\n');
    return;
  }

  var top, bottom;
  if (cmd.state.argv.length === 2)
    top = bottom = (q.atoi(cmd.state.argv[1]) & 15) >>> 0;
  else
  {
    top = (q.atoi(cmd.state.argv[1]) & 15) >>> 0;
    bottom = (q.atoi(cmd.state.argv[2]) & 15) >>> 0;
  }
  if (top >= 14)
    top = 13;
  if (bottom >= 14)
    bottom = 13;
  var playercolor = (top << 4) + bottom;

  if (cmd.state.client !== true)
  {
    cvar.setValue('_cl_color', playercolor);
    if (cl.cls.state === cl.ACTIVE.connected)
      cmd.forwardToServer();
    return;
  }

  state.client.colors = playercolor;
  state.client.edict.v_float[pr.entvars.team] = bottom + 1;
  var _msg = sv.state.server.reliable_datagram;
  msg.writeByte(_msg, protocol.SVC.updatecolors);
  msg.writeByte(_msg, state.client.num);
  msg.writeByte(_msg, playercolor);
};

const kill_f = async function()
{
  if (cmd.state.client !== true)
  {
    cmd.forwardToServer();
    return;
  }
  if (sv.state.player.v_float[pr.entvars.health] <= 0.0)
  {
    clientPrint('Can\'t suicide -- allready dead!\n');
    return;
  }
  pr.state.globals_float[pr.globalvars.time] = sv.state.server.time;
  pr.state.globals_int[pr.globalvars.self] = sv.state.player.num;
  await pr.executeProgram(pr.state.globals_int[pr.globalvars.ClientKill]);
};

const pause_f = function()
{
  if (cmd.state.client !== true)
  {
    cmd.forwardToServer();
    return;
  }
  if (cvr.pausable.value === 0)
  {
    clientPrint('Pause not allowed.\n');
    return;
  }
  sv.state.server.paused = !sv.state.server.paused;
  broadcastPrint(sv.getClientName(state.client) + (sv.state.server.paused === true ? ' paused the game\n' : ' unpaused the game\n'));
  msg.writeByte(sv.state.server.reliable_datagram, protocol.SVC.setpause);
  msg.writeByte(sv.state.server.reliable_datagram, sv.state.server.paused === true ? 1 : 0);
};

const preSpawn_f = function()
{
  if (cmd.state.client !== true)
  {
    con.print('prespawn is not valid from the console\n');
    return;
  }
  var client = state.client;
  if (client.spawned === true)
  {
    con.print('prespawn not valid -- allready spawned\n');
    return;
  }
  sz.write(client.message, new Uint8Array(sv.state.server.signon.data), sv.state.server.signon.cursize);
  msg.writeByte(client.message, protocol.SVC.signonnum);
  msg.writeByte(client.message, 2);
  client.sendsignon = true;
};

const spawn_f = async function()
{
  if (cmd.state.client !== true)
  {
    con.print('spawn is not valid from the console\n');
    return;
  }
  var client = state.client;
  if (client.spawned === true)
  {
    con.print('Spawn not valid -- allready spawned\n');
    return;
  }

  var i;

  var ent = client.edict;
  if (sv.state.server.loadgame === true)
    sv.state.server.paused = false;
  else
  {
    for (i = 0; i < pr.state.entityfields; ++i)
      ent.v_int[i] = 0;
    ent.v_float[pr.entvars.colormap] = ent.num;
    ent.v_float[pr.entvars.team] = (client.colors & 15) + 1;
    ent.v_int[pr.entvars.netname] = pr.state.netnames + (client.num << 5);
    for (i = 0; i <= 15; ++i)
      pr.state.globals_float[pr.globalvars.parms + i] = client.spawn_parms[i];
    pr.state.globals_float[pr.globalvars.time] = sv.state.server.time;
    pr.state.globals_int[pr.globalvars.self] = ent.num;
    await pr.executeProgram(pr.state.globals_int[pr.globalvars.ClientConnect]);
    if ((sys.floatTime() - client.netconnection.connecttime) <= sv.state.server.time)
      sys.print(sv.getClientName(client) + ' entered the game\n');
    await pr.executeProgram(pr.state.globals_int[pr.globalvars.PutClientInServer]);
  }

  var message = client.message;
  message.cursize = 0;
  msg.writeByte(message, protocol.SVC.time);
  msg.writeFloat(message, sv.state.server.time);
  for (i = 0; i < sv.state.svs.maxclients; ++i)
  {
    client = sv.state.svs.clients[i];
    msg.writeByte(message, protocol.SVC.updatename);
    msg.writeByte(message, i);
    msg.writeString(message, sv.getClientName(client));
    msg.writeByte(message, protocol.SVC.updatefrags);
    msg.writeByte(message, i);
    msg.writeShort(message, client.old_frags);
    msg.writeByte(message, protocol.SVC.updatecolors);
    msg.writeByte(message, i);
    msg.writeByte(message, client.colors);
  }
  for (i = 0; i <= 63; ++i)
  {
    msg.writeByte(message, protocol.SVC.lightstyle);
    msg.writeByte(message, i);
    msg.writeString(message, sv.state.server.lightstyles[i]);
  }
  msg.writeByte(message, protocol.SVC.updatestat);
  msg.writeByte(message, def.STAT.totalsecrets);
  msg.writeLong(message, pr.state.globals_float[pr.globalvars.total_secrets]);
  msg.writeByte(message, protocol.SVC.updatestat);
  msg.writeByte(message, def.STAT.totalmonsters);
  msg.writeLong(message, pr.state.globals_float[pr.globalvars.total_monsters]);
  msg.writeByte(message, protocol.SVC.updatestat);
  msg.writeByte(message, def.STAT.secrets);
  msg.writeLong(message, pr.state.globals_float[pr.globalvars.found_secrets]);
  msg.writeByte(message, protocol.SVC.updatestat);
  msg.writeByte(message, def.STAT.monsters);
  msg.writeLong(message, pr.state.globals_float[pr.globalvars.killed_monsters]);
  msg.writeByte(message, protocol.SVC.setangle);
  msg.writeAngle(message, ent.v_float[pr.entvars.angles]);
  msg.writeAngle(message, ent.v_float[pr.entvars.angles1]);
  msg.writeAngle(message, 0.0);
  sv.writeClientdataToMessage(ent, message);
  msg.writeByte(message, protocol.SVC.signonnum);
  msg.writeByte(message, 3);
  state.client.sendsignon = true;
};

const begin_f = function()
{
  if (cmd.state.client !== true)
  {
    con.print('begin is not valid from the console\n');
    return;
  }
  state.client.spawned = true;
};

const kick_f = async function()
{
  if (cmd.state.client !== true)
  {
    if (sv.state.server.active !== true)
    {
      cmd.forwardToServer();
      return;
    }
  }
  else if (pr.state.globals_float[pr.globalvars.deathmatch] !== 0.0)
    return;
  if (cmd.state.argv.length <= 1)
    return;
  var save = state.client;
  var s = cmd.state.argv[1].toLowerCase();
  var i, byNumber;
  if ((cmd.state.argv.length >= 3) && (s === '#'))
  {
    i = q.atoi(cmd.state.argv[2]) - 1;
    if ((i < 0) || (i >= sv.state.svs.maxclients))
      return;
    if (sv.state.svs.clients[i].active !== true)
      return;
    state.client = sv.state.svs.clients[i];
    byNumber = true;
  }
  else
  {
    for (i = 0; i < sv.state.svs.maxclients; ++i)
    {
      state.client = sv.state.svs.clients[i];
      if (state.client.active !== true)
        continue;
      if (sv.getClientName(state.client).toLowerCase() === s)
        break;
    }
  }
  if (i >= sv.state.svs.maxclients)
  {
    state.client = save;
    return;
  }
  if (state.client === save)
    return;
  var who;
  if (cmd.state.client !== true)
    who = cl.cvr.name.string;
  else
  {
    if (state.client === save)
      return;
    who = sv.getClientName(save);
  }
  var message;
  if (cmd.state.argv.length >= 3)
    message = com.parse(cmd.state.args);
  if (message != null)
  {
    var p = 0;
    if (byNumber === true)
    {
      ++p;
      for (; p < message.length; ++p)
      {
        if (message.charCodeAt(p) !== 32)
          break;
      }
      p += cmd.state.argv[2].length;
    }
    for (; p < message.length; ++p)
    {
      if (message.charCodeAt(p) !== 32)
        break;
    }
    clientPrint('Kicked by ' + who + ': ' + message.substring(p) + '\n');
  }
  else
    clientPrint('Kicked by ' + who + '\n');
  await dropClient(false);
  state.client = save;
};

const give_f = function()
{
  if (cmd.state.client !== true)
  {
    cmd.forwardToServer();
    return;
  }
  if (pr.state.globals_float[pr.globalvars.deathmatch] !== 0)
    return;
  if (cmd.state.argv.length <= 1)
    return;
  var t = cmd.state.argv[1].charCodeAt(0);
  var ent = sv.state.player;

  if ((t >= 48) && (t <= 57))
  {
    if (com.state.hipnotic !== true)
    {
      if (t >= 50)
        ent.v_float[pr.entvars.items] |= def.IT.shotgun << (t - 50);
      return;
    }
    if (t === 54)
    {
      if (cmd.state.argv[1].charCodeAt(1) === 97)
        ent.v_float[pr.entvars.items] |= def.HIT.proximity_gun;
      else
        ent.v_float[pr.entvars.items] |= def.IT.grenade_launcher;
      return;
    }
    if (t === 57)
      ent.v_float[pr.entvars.items] |= def.HIT.laser_cannon;
    else if (t === 48)
      ent.v_float[pr.entvars.items] |= def.HIT.mjolnir;
    else if (t >= 50)
      ent.v_float[pr.entvars.items] |= def.IT.shotgun << (t - 50);
    return;
  }
  var v = q.atoi(cmd.state.argv[2]);
  if (t === 104)
  {
    ent.v_float[pr.entvars.health] = v;
    return;
  }
  if (com.state.rogue !== true)
  {
    switch (t)
    {
    case 115:
      ent.v_float[pr.entvars.ammo_shells] = v;
      return;
    case 110:
      ent.v_float[pr.entvars.ammo_nails] = v;
      return;
    case 114:
      ent.v_float[pr.entvars.ammo_rockets] = v;
      return;
    case 99:
      ent.v_float[pr.entvars.ammo_cells] = v;
    }
    return;
  }
  switch (t)
  {
  case 115:
    if (pr.entvars.ammo_shells1 != null)
      ent.v_float[pr.entvars.ammo_shells1] = v;
    ent.v_float[pr.entvars.ammo_shells] = v;
    return;
  case 110:
    if (pr.entvars.ammo_nails1 != null)
    {
      ent.v_float[pr.entvars.ammo_nails1] = v;
      if (ent.v_float[pr.entvars.weapon] <= def.IT.lightning)
        ent.v_float[pr.entvars.ammo_nails] = v;
    }
    return;
  case 108:
    if (pr.entvars.ammo_lava_nails != null)
    {
      ent.v_float[pr.entvars.ammo_lava_nails] = v;
      if (ent.v_float[pr.entvars.weapon] > def.IT.lightning)
        ent.v_float[pr.entvars.ammo_nails] = v;
    }
    return;
  case 114:
    if (pr.entvars.ammo_rockets1 != null)
    {
      ent.v_float[pr.entvars.ammo_rockets1] = v;
      if (ent.v_float[pr.entvars.weapon] <= def.IT.lightning)
        ent.v_float[pr.entvars.ammo_rockets] = v;
    }
    return;
  case 109:
    if (pr.entvars.ammo_multi_rockets != null)
    {
      ent.v_float[pr.entvars.ammo_multi_rockets] = v;
      if (ent.v_float[pr.entvars.weapon] > def.IT.lightning)
        ent.v_float[pr.entvars.ammo_rockets] = v;
    }
    return;
  case 99:
    if (pr.entvars.ammo_cells1 != null)
    {
      ent.v_float[pr.entvars.ammo_cells1] = v;
      if (ent.v_float[pr.entvars.weapon] <= def.IT.lightning)
        ent.v_float[pr.entvars.ammo_cells] = v;
    }
    return;
  case 112:
    if (pr.entvars.ammo_plasma != null)
    {
      ent.v_float[pr.entvars.ammo_plasma] = v;
      if (ent.v_float[pr.entvars.weapon] > def.IT.lightning)
        ent.v_float[pr.entvars.ammo_cells] = v;
    }
  }
};

const findViewthing = function()
{
  var i, e;
  if (sv.state.server.active === true)
  {
    for (i = 0; i < sv.state.server.num_edicts; ++i)
    {
      e = sv.state.server.edicts[i];
      if (pr.getString(e.v_int[pr.entvars.classname]) === 'viewthing')
        return e;
    }
  }
  con.print('No viewthing on map\n');
};

const viewmodel_f = async function()
{
  if (cmd.state.argv.length !== 2)
    return;
  var ent = findViewthing();
  if (ent == null)
    return;
  var m = await mod.forName(cmd.state.argv[1]);
  if (m == null)
  {
    con.print('Can\'t load ' + cmd.state.argv[1] + '\n');
    return;
  }
  ent.v_float[pr.entvars.frame] = 0.0;
  cl.clState.model_precache[ent.v_float[pr.entvars.modelindex] >> 0] = m;
};

const viewframe_f = function()
{
  var ent = findViewthing();
  if (ent == null)
    return;
  var m = cl.clState.model_precache[ent.v_float[pr.entvars.modelindex] >> 0];
  var f = q.atoi(cmd.state.argv[1]);
  if (f >= m.frames.length)
    f = m.frames.length - 1;
  ent.v_float[pr.entvars.frame] = f;
};

const viewnext_f = function()
{
  var ent = findViewthing();
  if (ent == null)
    return;
  var m = cl.clState.model_precache[ent.v_float[pr.entvars.modelindex] >> 0];
  var f = (ent.v_float[pr.entvars.frame] >> 0) + 1;
  if (f >= m.frames.length)
    f = m.frames.length - 1;
  ent.v_float[pr.entvars.frame] = f;
  con.print('frame ' + f + ': ' + m.frames[f].name + '\n');
};

const viewprev_f = function()
{
  var ent = findViewthing();
  if (ent == null)
    return;
  var m = cl.clState.model_precache[ent.v_float[pr.entvars.modelindex] >> 0];
  var f = (ent.v_float[pr.entvars.frame] >> 0) - 1;
  if (f < 0)
    f = 0;
  ent.v_float[pr.entvars.frame] = f;
  con.print('frame ' + f + ': ' + m.frames[f].name + '\n');
};

const startdemos_f = function()
{
  con.print((cmd.state.argv.length - 1) + ' demo(s) in loop\n');
  cl.cls.demos = [];
  var i;
  for (i = 1; i < cmd.state.argv.length; ++i)
    cl.cls.demos[i - 1] = cmd.state.argv[i];
  if ((cl.cls.demonum !== -1) && (cl.cls.demoplayback !== true))
  {
    cl.cls.demonum = 0;
    if (state.framecount !== 0)
      cl.nextDemo();
    else
      state.startdemos = true;
  }
  else
    cl.cls.demonum = -1;
};

const demos_f = async function()
{
  if (cl.cls.demonum === -1)
    cl.cls.demonum = 1;
  await cl.disconnect();
  cl.nextDemo();
};

const stopdemo_f = async function()
{
  if (cl.cls.demoplayback !== true)
    return;
  cl.stopPlayback();
  await cl.disconnect();
};

const initCommands = () => {
  cmd.addCommand('status', status_f);
  cmd.addCommand('quit', quit_f);
  cmd.addCommand('god', god_f);
  cmd.addCommand('notarget', notarget_f);
  cmd.addCommand('fly', fly_f);
  cmd.addCommand('map', map_f);
  cmd.addCommand('restart', restart_f);
  cmd.addCommand('changelevel', changelevel_f);
  cmd.addCommand('connect', connect_f);
  cmd.addCommand('reconnect', reconnect_f);
  cmd.addCommand('name', name_f);
  cmd.addCommand('noclip', noclip_f);
  cmd.addCommand('version', version_f);
  cmd.addCommand('say', say);
  cmd.addCommand('say_team', say_Team_f);
  cmd.addCommand('tell', tell_f);
  cmd.addCommand('color', color_f);
  cmd.addCommand('kill', kill_f);
  cmd.addCommand('pause', pause_f);
  cmd.addCommand('spawn', spawn_f);
  cmd.addCommand('begin', begin_f);
  cmd.addCommand('prespawn', preSpawn_f);
  cmd.addCommand('kick', kick_f);
  cmd.addCommand('ping', ping_f);
  cmd.addCommand('load', loadgame_f);
  cmd.addCommand('save', savegame_f);
  cmd.addCommand('give', give_f);
  cmd.addCommand('startdemos', startdemos_f);
  cmd.addCommand('demos', demos_f);
  cmd.addCommand('stopdemo', stopdemo_f);
  cmd.addCommand('viewmodel', viewmodel_f);
  cmd.addCommand('viewframe', viewframe_f);
  cmd.addCommand('viewnext', viewnext_f);
  cmd.addCommand('viewprev', viewprev_f);
  cmd.addCommand('mcache', mod.print);
}

export const error = async function(error: string)
{
  if (state.inerror === true) {
    sys.error('Host.Error: recursively entered');
  }
  state.inerror = true;
  if (!state.dedicated) {
    scr.endLoadingPlaque();
  }
  con.print('Host.Error: ' + error + '\n');
  if (sv.state.server.active === true)
    await shutdownServer(false);
  await cl.disconnect();
  cl.cls.demonum = -1;
  state.inerror = false;
  throw new Error('Host.abortserver');
};

const initLocal = () => {
  initCommands();
  cvr.framerate = cvar.registerVariable('host_framerate', '0');
  cvr.speeds = cvar.registerVariable('host_speeds', '0');
  cvr.ticrate = cvar.registerVariable('sys_ticrate', '0.05');
  cvr.serverprofile = cvar.registerVariable('serverprofile', '0');
  cvr.fraglimit = cvar.registerVariable('fraglimit', '0', false, true);
  cvr.timelimit = cvar.registerVariable('timelimit', '0', false, true);
  cvr.teamplay = cvar.registerVariable('teamplay', '0', false, true);
  cvr.samelevel = cvar.registerVariable('samelevel', '0');
  cvr.noexit = cvar.registerVariable('noexit', '0', false, true);
  cvr.skill = cvar.registerVariable('skill', '1');
  cvr.developer = cvar.registerVariable('developer', '0');
  cvr.deathmatch = cvar.registerVariable('deathmatch', '0');
  cvr.coop = cvar.registerVariable('coop', '0');
  cvr.pausable = cvar.registerVariable('pausable', '1');
  cvr.temp1 = cvar.registerVariable('temp1', '0');
  cvr.rcon_password = cvar.registerVariable('rcon_password', 'abcd');
  findMaxClients();
}

export const init = async function(
  dedicated: boolean,
  assetStore: IAssetStore,
  netDrivers: INetworkDriver[])
{
  initState()
  state.dedicated = dedicated
  state.oldrealtime = sys.floatTime();
  sv.init();
  cvar.init()
  cmd.init();
  v.init();
  chase.init();
  await com.init(assetStore);
  initLocal();
  await w.loadWadFile('gfx.wad');
  key.init();
  con.init();
  pr.init();
  mod.init();
  net.init(netDrivers);
  con.print(def.timedate);
  if (!dedicated) {
    await vid.init();
    await draw.init();
    await scr.init();
    r.init();
    await s.init();
    await m.init();
    await cdAudio.init();
    await sbar.init();
    await cl.init();
    input.init();
  }
  cmd.state.text = 'exec quake.rc\n' + cmd.state.text;
  state.initialized = true;
  sys.print('========Quake Initialized=========\n');
};

export const frame = async function()
{
  if (cvr.serverprofile.value === 0)
  {
    await _frame();
    return;
  }
  var time1 = sys.floatTime();
  await _frame();
  state.timetotal += sys.floatTime() - time1;
  if (++state.timecount <= 999)
    return;
  var m = (state.timetotal * 1000.0 / state.timecount) >> 0;
  state.timecount = 0;
  state.timetotal = 0.0;
  var i, c = 0;
  for (i = 0; i < sv.state.svs.maxclients; ++i)
  {
    if (sv.state.svs.clients[i].active === true)
      ++c;
  }
  con.print('serverprofile: ' + (c <= 9 ? ' ' : '') + c + ' clients ' + (m <= 9 ? ' ' : '') + m + ' msec\n');
};

export const shutdown = function()
{
  if (state.isdown === true)
  {
    sys.print('recursive shutdown\n');
    return;
  }
  state.isdown = true;
  writeConfiguration();
  cdAudio.stop();
  net.shutdown();
  s.stopAllSounds();
  input.shutdown();
};

export const shutdownServer = async function(crash: boolean = false)
{
  if (sv.state.server.active !== true)
    return;
  sv.state.server.active = false;
  if (cl.cls.state === cl.ACTIVE.connected)
    await cl.disconnect();
  var start = sys.floatTime(), count, i;
  do
  {
    count = 0;
    for (i = 0; i < sv.state.svs.maxclients; ++i)
    {
      state.client = sv.state.svs.clients[i];
      if ((state.client.active !== true) || (state.client.message.cursize === 0))
        continue;
      if (net.canSendMessage(state.client.netconnection) === true)
      {
        net.sendMessage(state.client.netconnection, state.client.message);
        state.client.message.cursize = 0;
        continue;
      }
      net.getMessage(state.client.netconnection);
      ++count;
    }
    if ((sys.floatTime() - start) > 3.0)
      break;
  } while (count !== 0);
  var buf = {data: new ArrayBuffer(4), cursize: 1};
  (new Uint8Array(buf.data))[0] = protocol.SVC.disconnect;
  count = net.sendToAll(buf);
  if (count !== 0)
    con.print('Host.ShutdownServer: NET.SendToAll failed for ' + count + ' clients\n');
  for (i = 0; i < sv.state.svs.maxclients; ++i)
  {
    state.client = sv.state.svs.clients[i];
    if (state.client.active === true)
      await dropClient(crash);
  }
};