import * as con from './console'
import * as cmd from './cmd'
import * as host from './host'
import * as q from './q'
import * as sv from './sv'

export const vars = [] as any

export const findVar = function(name)
{
  var i;
  for (i = 0; i < vars.length; ++i)
  {
    if (vars[i].name === name)
      return vars[i];
  }
};

export const completeVariable = function(partial)
{
  if (partial.length === 0)
    return;
  var i;
  for (i = 0; i < vars.length; ++i)
  {
    if (vars[i].name.substring(0, partial.length) === partial)
      return vars[i].name;
  }
};

export const set = function(name, value)
{
  var i, v, changed;
  for (i = 0; i < vars.length; ++i)
  {
    v = vars[i];
    if (v.name !== name)
      continue;
    if (v.string !== value)
      changed = true;
    v.string = value;
    v.value = q.atof(value);
    if ((v.server === true) && (changed === true) && (sv.state.server.active === true))
      host.broadcastPrint('"' + v.name + '" changed to "' + v.string + '"\n');
    return;
  }
  con.print('cvar.set: variable ' + name + ' not found\n');
};

export const setValue = function(name: string, value: any)
{
  set(name, value.toFixed(6));
};

export const registerVariable = function(name: string, value: string, archive: any = undefined, server: any = undefined)
{
  var i;
  for (i = 0; i < vars.length; ++i)
  {
    if (vars[i].name === name)
    {
      con.print('Can\'t register variable ' + name + ', allready defined\n');
      return;
    }
  }
  vars[vars.length] =
  {
    name: name,
    string: value,
    archive: archive,
    server: server,
    value: q.atof(value)
  };
  return vars[vars.length - 1];
};

export const command = function()
{
  var v = findVar(cmd.state.argv[0]);
  if (v == null)
    return;
  if (cmd.state.argv.length <= 1)
  {
    con.print('"' + v.name + '" is "' + v.string + '"\n');
    return true;
  }
  set(v.name, cmd.state.argv[1]);
  return true;
};

export const writeVariables = function()
{
  var f = [], i, v;
  for (i = 0; i < vars.length; ++i)
  {
    v = vars[i];
    if (v.archive === true)
      f[f.length] = v.name + ' "' + v.string + '"\n';
  }
  return f.join('');
};