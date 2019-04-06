import * as msg from './msg'
import * as con from './console'
import * as cvar from './cvar'
import * as com from './com'
import * as cl from './cl'
import * as protocol from './protocol'

export let state = {
  wait: false,
  alias: [],
  text: '',
  argv: [],
  functions: [],
  client: null
} as any

const initState = () => {
  state = {
    wait: false,
    alias: [],
    text: '',
    argv: [],
    functions: [],
    client: null
  }
}
const wait_f = function()
{
  state.wait = true;
}

const stuffCmds_f = function()
{
  var i, s = false, build = '', c;
  for (i = 0; i < com.state.argv.length; ++i)
  {
    c = com.state.argv[i].charCodeAt(0);
    if (s === true)
    {
      if (c === 43)
      {
        build += ('\n' + com.state.argv[i].substring(1) + ' ');
        continue;
      }
      if (c === 45)
      {
        s = false;
        build += '\n';
        continue;
      }
      build += (com.state.argv[i] + ' ');
      continue;
    }
    if (c === 43)
    {
      s = true;
      build += (com.state.argv[i].substring(1) + ' ');
    }
  }
  if (build.length !== 0){
    state.text = build + '\n' + state.text;
  }
};

const exec_f = async function()
{
  if (state.argv.length !== 2)
  {
    con.print('exec <filename> : execute a script file\n');
    return;
  }
  var f = await com.loadTextFile(state.argv[1]);
  if (f == null)
  {
    con.print('couldn\'t exec ' + state.argv[1] + '\n');
    return;
  }
  con.print('execing ' + state.argv[1] + '\n');
  state.text = f + state.text;
};

const echo_f = function()
{
  var i;
  for (i = 1; i < state.argv.length; ++i)
    con.print(state.argv[i] + ' ');
  con.print('\n');
};

const alias_f = function()
{
  var i;
  if (state.argv.length <= 1)
  {
    con.print('Current alias commands:\n');
    for (i = 0; i < state.alias.length; ++i)
      con.print(state.alias[i].name + ' : ' + state.alias[i].value + '\n');
  }
  var s = state.argv[1], value = '';
  for (i = 0; i < state.alias.length; ++i)
  {
    if (state.alias[i].name === s)
      break;
  }
  var j;
  for (j = 2; j < state.argv.length; ++j)
  {
    value += state.argv[j];
    if (j !== state.argv.length)
      value += ' ';
  }
  state.alias[i] = {name: s, value: value + '\n'};
};


const tokenizeString = function(text: string)
{
  state.argv = [];
  var i, c;
  for (;;)
  {
    for (i = 0; i < text.length; ++i)
    {
      c = text.charCodeAt(i);
      if ((c > 32) || (c === 10))
        break;
    }
    if (state.argv.length === 1)
      state.args = text.substring(i);
    if ((text.charCodeAt(i) === 10) || (i >= text.length))
      return;
    text = com.parse(text);
    if (text == null)
      return;
    state.argv[state.argv.length] = com.state.token;
  }
};

export const completeCommand = function(partial: string)
{
  if (partial.length === 0)
    return;
  var i;
  for (i = 0; i < state.functions.length; ++i)
  {
    if (state.functions[i].name.substring(0, partial.length) === partial)
      return state.functions[i].name;
  }
};

export const executeString = async function(text: string, client: any = undefined)
{
  state.client = client;
  tokenizeString(text);
  if (state.argv.length === 0)
    return;
  var name = state.argv[0].toLowerCase();
  var i;
  for (i = 0; i < state.functions.length; ++i)
  {
    if (state.functions[i].name === name)
    {
      await state.functions[i].command();
      return;
    }
  }
  for (i = 0; i < state.alias.length; ++i)
  {
    if (state.alias[i].name === name)
    {
      state.text = state.alias[i].value + state.text;
      return;
    }
  }
  if (cvar.command() !== true)
    con.print('Unknown command "' + name + '"\n');
};

export const forwardToServer = function()
{
  if (cl.cls.state !== cl.ACTIVE.connected)
  {
    con.print('Can\'t "' + state.argv[0] + '", not connected\n');
    return;
  }
  if (cl.cls.demoplayback === true)
    return;
  var args = String.fromCharCode(protocol.CLC.stringcmd);
  if (state.argv[0].toLowerCase() !== 'cmd')
    args += state.argv[0] + ' ';
  if (state.argv.length >= 2)
    args += state.args;
  else
    args += '\n';
  msg.writeString(cl.cls.message, args);
}

export const addCommand = function(name: string, command: () => any)
{
  var i;
  for (i = 0; i < cvar.vars.length; ++i)
  {
    if (cvar.vars[i].name === name)
    {
      con.print('cmd.addCommand: ' + name + ' already defined as a var\n');
      return;
    }
  }
  for (i = 0; i < state.functions.length; ++i)
  {
    if (state.functions[i].name === name)
    {
      con.print('cmd.addCommand: ' + name + ' already defined\n');
      return;
    }
  }
  state.functions[state.functions.length] = {name: name, command: command};
}

export const init = function()
{
  initState()
  addCommand('stuffcmds', stuffCmds_f);
  addCommand('exec', exec_f);
  addCommand('echo', echo_f);
  addCommand('alias', alias_f);
  addCommand('cmd', forwardToServer);
  addCommand('wait', wait_f);
}

export const execute = async function()
{
  var i, c, line = '', quotes = false;
  while (state.text.length !== 0)
  {
    c = state.text.charCodeAt(0);
    state.text = state.text.substring(1);
    if (c === 34)
    {
      quotes = !quotes;
      line += '\x22';
      continue;
    }
    if (((quotes === false) && (c === 59)) || (c === 10))
    {
      if (line.length === 0)
        continue;
      await executeString(line, null);
      if (state.wait === true)
      {
        state.wait = false;
        return;
      }
      line = '';
      continue;
    }
    line += String.fromCharCode(c);
  }
  state.text = '';
};
