import * as s from './s'
import * as cmd from './cmd'
import * as con from './console'
import * as com from './com'
import * as q from './q'
import * as cvar from './cvar'

const known = [];

const state = {

} as any;
export const play = async function(track, looping)
{
  if ((state.initialized !== true) || (state.enabled !== true))
    return;
  track -= 2;
  if (state.playTrack === track)
  {
    if (state.cd != null)
    {
      state.cd.loop = looping;
      if ((looping === true) && (state.cd.paused === true))
        await state.cd.play();
    }
    return;
  }
  if ((track < 0) || (track >= known.length))
  {
    con.dPrint('CDAudio.Play: Bad track number ' + (track + 2) + '.\n');
    return;
  }
  stop();
  state.playTrack = track;
  state.cd = new Audio(known[track]);
  state.cd.loop = looping;
  state.cd.volume = state.cdvolume;
  await state.cd.play();
};

export const stop = function()
{
  if ((state.initialized !== true) || (state.enabled !== true))
    return;
  if (state.cd != null)
    state.cd.pause();
  state.playTrack = null;
  state.cd = null;
};

export const pause = function()
{
  if ((state.initialized !== true) || (state.enabled !== true))
    return;
  if (state.cd != null)
    state.cd.pause();
};

export const resume = function()
{
  if ((state.initialized !== true) || (state.enabled !== true))
    return;
  if (state.cd != null)
    state.cd.play();
};

export const cd_f = async function()
{
  if ((state.initialized !== true) || (cmd.state.argv.length <= 1))
    return;
  var command = cmd.state.argv[1].toLowerCase();
  switch (command)
  {
  case 'on':
    state.enabled = true;
    return;
  case 'off':
    stop();
    state.enabled = false;
    return;
  case 'play':
    await play(q.atoi(cmd.state.argv[2]), false);
    return;
  case 'loop':
    await play(q.atoi(cmd.state.argv[2]), true);
    return;
  case 'stop':
    stop();
    return;
  case 'pause':
    pause();
    return;
  case 'resume':
    await resume();
    return;
  case 'info':
    con.print(known.length + ' tracks\n');
    if (state.cd != null)
    {
      if (state.cd.paused !== true)
        con.print('Currently ' + (state.cd.loop === true ? 'looping' : 'playing') + ' track ' + (state.playTrack + 2) + '\n');
    }
    con.print('Volume is ' + state.cdvolume + '\n');
    return;
  }
};

export const update = function()
{
  if ((state.initialized !== true) || (state.enabled !== true))
    return;
  if (s.cvr.bgmvolume.value === state.cdvolume)
    return;
  if (s.cvr.bgmvolume.value < 0.0)
    cvar.setValue('bgmvolume', 0.0);
  else if (s.cvr.bgmvolume.value > 1.0)
    cvar.setValue('bgmvolume', 1.0);
  state.cdvolume = s.cvr.bgmvolume.value;
  if (state.cd != null)
    state.cd.volume = state.cdvolume;
};

export const trackExists = async function(trackPath) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('HEAD', trackPath);
    xhr.onload = () => {
      resolve({
        status: xhr.status
      });
    }
    xhr.onerror = (e) => reject(e) 
    xhr.send();
  })
}

export const init = async function()
{
  cmd.addCommand('cd', cd_f);
  if (com.checkParm('-nocdaudio') != null)
    return;
  var i, j, track;
  for (i = 1; i <= 99; ++i)
  {
    track = '/media/quake' + (i <= 9 ? '0' : '') + i + '.ogg';
    for (j = com.state.searchpaths.length - 1; j >= 0; --j)
    {
      const exists = await trackExists(com.state.searchpaths[j].dir + track) as any
      if ((exists.status >= 200) && (exists.status <= 299))
      {
        known[i - 1] = com.state.searchpaths[j].dir + track;
        break;
      }
    }
    if (j < 0)
      break;
  }
  if (known.length === 0)
    return;
  state.initialized = state.enabled = true;
  update();
  con.print('CD Audio Initialized\n');
};