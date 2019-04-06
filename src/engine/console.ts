

import * as cmd from './cmd'
import * as com from './com'
import * as host from './host'
import * as key from './key'
import * as vid from './vid'
import * as cl from './cl'
import * as mod from './mod'
import * as draw from './draw'
import * as sys from './sys'
import * as scr from './scr'
import * as s from './s'
import * as m from './m'
import * as cvar from './cvar'

export const state = {
  backscroll: 0,
  current: 0,
  text: [],
  debuglog: false
} as any

export const cvr = {

} as any

export const toggleConsole_f = function()
{
  scr.endLoadingPlaque();
  if (key.state.dest === key.KEY_DEST.console)
  {
    if (cl.cls.state !== cl.ACTIVE.connected)
    {
      m.menu_Main_f();
      return;
    }
    key.state.dest = key.KEY_DEST.game;
    key.state.edit_line = '';
    key.state.history_line = key.state.lines.length;
    return;
  }
  key.state.dest = key.KEY_DEST.console;
};

const clear_f = function()
{
  state.backscroll = 0;
  state.current = 0;
  state.text = [];
};

export const clearNotify = function()
{
  var i = state.text.length - 4;
  if (i < 0)
    i = 0;
  for (; i < state.text.length; ++i)
    state.text[i].time = 0.0;
};

const messageMode_f = function()
{
  key.state.dest = key.KEY_DEST.message;
  key.state.team_message = false;
};

const messageMode2_f = function()
{
  key.state.dest = key.KEY_DEST.message;
  key.state.team_message = true;
};


const drawInput = function()
{
  if ((key.state.dest !== key.KEY_DEST.console) && (state.forcedup !== true))
    return;
  var text = ']' + key.state.edit_line + String.fromCharCode(10 + ((host.state.realtime * 4.0) & 1));
  var width = (vid.state.width >> 3) - 2;
  if (text.length >= width)
    text = text.substring(1 + text.length - width);
  draw.string(8, state.vislines - 16, text);
};

export const drawNotify = function()
{
  var width = (vid.state.width >> 3) - 2;
  var i = state.text.length - 4, v = 0;
  if (i < 0)
    i = 0;
  for (; i < state.text.length; ++i)
  {
    if ((host.state.realtime - state.text[i].time) > cvr.notifytime.value)
      continue;
    draw.string(8, v, state.text[i].text.substring(0, width));
    v += 8;
  }
  if (key.state.dest === key.KEY_DEST.message)
    draw.string(8, v, 'say: ' + key.state.chat_buffer + String.fromCharCode(10 + ((host.state.realtime * 4.0) & 1)));
};

export const drawConsole = function(lines: number)
{
  if (lines <= 0)
    return;
  lines = Math.floor(lines * vid.state.height * 0.005);
  draw.consoleBackground(lines);
  state.vislines = lines;
  var width = (vid.state.width >> 3) - 2;
  var rows;
  var y = lines - 16;
  var i;
  for (i = state.text.length - 1 - state.backscroll; i >= 0;)
  {
    if (state.text[i].text.length === 0)
      y -= 8;
    else
      y -= Math.ceil(state.text[i].text.length / width) << 3;
    --i;
    if (y <= 0)
      break;
  }
  var j, text;
  for (++i; i < state.text.length - state.backscroll; ++i)
  {
    text = state.text[i].text;
    rows = Math.ceil(text.length / width);
    if (rows === 0)
    {
      y += 8;
      continue;
    }
    for (j = 0; j < rows; ++j)
    {
      draw.string(8, y, text.substr(j * width, width));
      y += 8;
    }
  }
  drawInput();
};

export const dPrint = function(_msg: string)
{
  if (host.cvr.developer.value !== 0)
    print(_msg);
};

export const print = async function(_msg: string)
{
  if (host.state.dedicated) {
    sys.print(_msg)
    return
  }
  if (state.debuglog === true)
  {
    var data = await com.loadTextFile('qconsole.log');
    if (data != null)
    {
      data += _msg;
      if (data.length >= 32768)
        data = data.substring(data.length - 16384);
      com.writeTextFile('qconsole.log', data);
    }
  }

  state.backscroll = 0;

  var mask = 0;
  if (_msg.charCodeAt(0) <= 2)
  {
    mask = 128;
    if (_msg.charCodeAt(0) === 1)
      await s.localSound(state.sfx_talk);
    _msg = _msg.substring(1);
  }
  var i;
  for (i = 0; i < _msg.length; ++i)
  {
    if (state.text[state.current] == null)
      state.text[state.current] = {text: '', time: host.state.realtime};
    if (_msg.charCodeAt(i) === 10)
    {
      if (state.text.length >= 1024)
      {
        state.text = state.text.slice(-512);
        state.current = state.text.length;
      }
      else
        ++state.current;
      continue;
    }
    state.text[state.current].text += String.fromCharCode(_msg.charCodeAt(i) + mask);
  }
};

export const init = function()
{
  state.backscroll = 0
  state.current = 0
  state.text = []
  state.debuglog = (com.checkParm('-condebug') != null);
  if (state.debuglog === true)
    com.writeTextFile('qconsole.log', '');
  print('Console initialized.\n');

  cvr.notifytime = cvar.registerVariable('con_notifytime', '3');
  cmd.addCommand('toggleconsole', toggleConsole_f);
  cmd.addCommand('messagemode', messageMode_f);
  cmd.addCommand('messagemode2', messageMode2_f);
  cmd.addCommand('clear', clear_f);
};