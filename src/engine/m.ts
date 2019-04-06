import * as vid from './vid'
import * as con from './console'
import * as draw from './draw'
import * as com from './com'
import * as host from './host'
import * as s from './s'
import * as GL from './GL'
import * as cl from './cl'
import * as scr from './scr'
import * as sv from './sv'
import * as key from './key'
import * as cmd from './cmd'
import * as cvar from './cvar'
import * as v from './v'
import * as net from './net'

let gl = null
const MENU_STATE =
{
  none: 0,
  main: 1,
  singleplayer: 2,
  load: 3,
  save: 4,
  multiplayer: 5,
  options: 6,
  keys: 7,
  help: 8,
  quit: 9
};

const state = {
  menu: MENU_STATE.none,
  // Single player menu
  singleplayer_cursor: 0,
  singleplayer_items: 3,
  // Main menu
  main_cursor: 0,
  main_items: 5,
  // Load/save menu
  load_cursor: 0,
  max_savegames: 12,
  filenames: [],
  loadable: [],
  removable: [],
  // Multiplayer menu
  multiplayer_cursor: 0,
  multiplayer_cursor_table: [56, 72, 96, 120, 156],
  multiplayer_joinname: '',
  multiplayer_items: 5,
  
  // Options menu
  options_cursor: 0,
  options_items: 11,
  // Keys menu
  keys_cursor: 0,

  // Help menu
  num_help_pages: 6
} as any

const bindnames = [
  ["+attack", "attack"],
  ["impulse 10", "change weapon"],
  ["+jump", "jump / swim up"],
  ["+forward", "walk forward"],
  ["+back", "backpedal"],
  ["+left", "turn left"],
  ["+right", "turn right"],
  ["+speed", "run"],
  ["+moveleft", "step left"],
  ["+moveright", "step right"],
  ["+strafe", "sidestep"],
  ["+lookup", "look up"],
  ["+lookdown", "look down"],
  ["centerview", "center view"],
  ["+mlook", "mouse look"],
  ["+klook", "keyboard look"],
  ["+moveup", "swim up"],
  ["+movedown", "swim down"]
];

const quitMessage =
[
  ['  Are you gonna quit', '  this game just like', '   everything else?', ''],
  [' Milord, methinks that', '   thou art a lowly', ' quitter. Is this true?', ''],
  [' Do I need to bust your', '  face open for trying', '        to quit?', ''],
  [' Man, I oughta smack you', '   for trying to quit!', '     Press Y to get', '      smacked out.'],
  [' Press Y to quit like a', '   big loser in life.', '  Press N to stay proud', '    and successful!'],
  ['   If you press Y to', '  quit, I will summon', '  Satan all over your', '      hard drive!'],
  ['  Um, Asmodeus dislikes', ' his children trying to', ' quit. Press Y to return', '   to your Tinkertoys.'],
  ['  If you quit now, I\'ll', '  throw a blanket-party', '   for you next time!', '']
]

export const drawCharacter = function(cx, line, num)
{
  draw.character(cx + (vid.state.width >> 1) - 160, line + (vid.state.height >> 1) - 100, num);
};

export const print = function(cx, cy, str)
{
  draw.stringWhite(cx + (vid.state.width >> 1) - 160, cy + (vid.state.height >> 1) - 100, str);
};

export const printWhite = function(cx, cy, str)
{
  draw.string(cx + (vid.state.width >> 1) - 160, cy + (vid.state.height >> 1) - 100, str);
};

export const drawPic = function(x, y, pic)
{
  draw.pic(x + (vid.state.width >> 1) - 160, y + (vid.state.height >> 1) - 100, pic);
};

export const drawPicTranslate = function(x, y, pic, top, bottom)
{
  draw.picTranslate(x + (vid.state.width >> 1) - 160, y + (vid.state.height >> 1) - 100, pic, top, bottom);
};

export const drawTextBox = function(x, y, width, lines)
{
  var cx, cy, n;

  cy = y;
  drawPic(x, cy, state.box_tl);
  for (n = 0; n < lines; ++n)
    drawPic(x, cy += 8, state.box_ml);
  drawPic(x, cy + 8, state.box_bl);

  cx = x + 8;
  var p;
  for (; width > 0; )
  {
    cy = y;
    drawPic(cx, y, state.box_tm);
    p = state.box_mm;
    for (n = 0; n < lines; ++n)
    {
      drawPic(cx, cy += 8, p);
      if (n === 0)
        p = state.box_mm2;
    }
    drawPic(cx, cy + 8, state.box_bm);
    width -= 2;
    cx += 16;
  }

  cy = y;
  drawPic(cx, cy, state.box_tr);
  for (n = 0; n < lines; ++n)
    drawPic(cx, cy += 8, state.box_mr);
  drawPic(cx, cy + 8, state.box_br);
};

export const toggleMenu_f = function()
{
  state.entersound = true;
  if (key.state.dest === key.KEY_DEST.menu)
  {
    if (state.menu !== MENU_STATE.main)
    {
      menu_Main_f();
      return;
    }
    key.state.dest = key.KEY_DEST.game;
    state.menu = MENU_STATE.none;
    return;
  }
  menu_Main_f();
};



export const menu_Main_f = function()
{
  if (key.state.dest !== key.KEY_DEST.menu)
  {
    state.save_demonum = cl.cls.demonum;
    cl.cls.demonum = -1;
  }
  key.state.dest = key.KEY_DEST.menu;
  state.menu = MENU_STATE.main;
  state.entersound = true;
};

export const main_Draw = function()
{
  drawPic(16, 4, state.qplaque);
  drawPic(160 - (state.ttl_main.width >> 1), 4, state.ttl_main);
  drawPic(72, 32, state.mainmenu);
  drawPic(54, 32 + state.main_cursor * 20, state.menudot[Math.floor(host.state.realtime * 10.0) % 6]);
};

export const main_Key = async function(k)
{
  switch (k)
  {
  case key.KEY.escape:
    key.state.dest = key.KEY_DEST.game;
    state.menu = MENU_STATE.none;
    cl.cls.demonum = state.save_demonum;
    if ((cl.cls.demonum !== -1) && (cl.cls.demoplayback !== true) && (cl.cls.state !== cl.ACTIVE.connected))
      cl.nextDemo();
    return;
  case key.KEY.downarrow:
    await s.localSound(state.sfx_menu1);
    if (++state.main_cursor >= state.main_items)
      state.main_cursor = 0;
    return;
  case key.KEY.uparrow:
    await s.localSound(state.sfx_menu1);
    if (--state.main_cursor < 0)
      state.main_cursor = state.main_items - 1;
    return;
  case key.KEY.enter:
    state.entersound = true;
    switch (state.main_cursor)
    {
    case 0:
      menu_SinglePlayer_f();
      return;
    case 1:
      menu_MultiPlayer_f();
      return;
    case 2:
      menu_Options_f();
      return;
    case 3:
      menu_Help_f();
      return;
    case 4:
      menu_Quit_f();
    }
  }
};


export const menu_SinglePlayer_f = function()
{
  key.state.dest = key.KEY_DEST.menu;
  state.menu = MENU_STATE.singleplayer;
  state.entersound = true;
};

export const singlePlayer_Draw = function()
{
  drawPic(16, 4, state.qplaque);
  drawPic(160 - (state.ttl_sgl.width >> 1), 4, state.ttl_sgl);
  drawPic(72, 32, state.sp_menu);
  drawPic(54, 32 + state.singleplayer_cursor * 20, state.menudot[Math.floor(host.state.realtime * 10.0) % 6]);
};

export const singlePlayer_Key = async function(k)
{
  switch (k)
  {
  case key.KEY.escape:
    menu_Main_f();
    return;
  case key.KEY.downarrow:
    await s.localSound(state.sfx_menu1);
    if (++state.singleplayer_cursor >= state.singleplayer_items)
      state.singleplayer_cursor = 0;
    return;
  case key.KEY.uparrow:
    await s.localSound(state.sfx_menu1);
    if (--state.singleplayer_cursor < 0)
      state.singleplayer_cursor = state.singleplayer_items - 1;
    return;
  case key.KEY.enter:
    state.entersound = true;
    switch (state.singleplayer_cursor)
    {
    case 0:
      if (sv.state.server.active === true)
      {
        if (confirm('Are you sure you want to start a new game?') !== true)
          return;
        cmd.state.text += 'disconnect\n';
      }
      key.state.dest = key.KEY_DEST.game;
      cmd.state.text += 'maxplayers 1\nmap start\n';
      return;
    case 1:
      await menu_Load_f();
      return;
    case 2:
      await menu_Save_f();
    }
  }
};

export const scanSaves = async function()
{
  var searchpaths = com.state.searchpaths, i, j, search = 'Quake.' + com.state.gamedir[0].dir + '/s', f, version, name, j, c;
  com.state.searchpaths = com.state.gamedir;
  for (i = 0; i < state.max_savegames; ++i)
  {
    f = localStorage.getItem(search + i + '.sav');
    if (f != null)
      state.removable[i] = true;
    else
    {
      state.removable[i] = false;
      f = await com.loadTextFile('s' + i + '.sav');
      if (f == null)
      {
        state.filenames[i] = '--- UNUSED SLOT ---';
        state.loadable[i] = false;
        continue;
      }
    }
    for (version = 0; version < f.length; ++version)
    {
      c = f.charCodeAt(version);
      if (c === 10)
      {
        ++version;
        break;
      }
    }
    name = [];
    for (j = 0; j <= 39; ++j)
    {
      c = f.charCodeAt(version + j);
      if (c === 13)
        break;
      if (c === 95)
        name[j] = ' ';
      else
        name[j] = String.fromCharCode(c);
    }
    state.filenames[i] = name.join('');
    state.loadable[i] = true;
  }
  com.state.searchpaths = searchpaths;
};

export const menu_Load_f = async function()
{
  state.entersound = true;
  state.menu = MENU_STATE.load;
  key.state.dest = key.KEY_DEST.menu;
  await scanSaves();
};

export const menu_Save_f = async function()
{
  if ((sv.state.server.active !== true) || (cl.clState.intermission !== 0) || (sv.state.svs.maxclients !== 1))
    return;
  state.entersound = true;
  state.menu = MENU_STATE.save;
  key.state.dest = key.KEY_DEST.menu;
  await scanSaves();
};

export const load_Draw = function()
{
  drawPic(160 - (state.p_load.width >> 1), 4, state.p_load);
  var i;
  for (i = 0; i < state.max_savegames; ++i)
    print(16, 32 + (i << 3), state.filenames[i]);
  drawCharacter(8, 32 + (state.load_cursor << 3), 12 + ((host.state.realtime * 4.0) & 1));
};

export const save_Draw = function()
{
  drawPic(160 - (state.p_save.width >> 1), 4, state.p_save);
  var i;
  for (i = 0; i < state.max_savegames; ++i)
    print(16, 32 + (i << 3), state.filenames[i]);
  drawCharacter(8, 32 + (state.load_cursor << 3), 12 + ((host.state.realtime * 4.0) & 1));
};

export const load_Key = async function(k)
{
  switch (k)
  {
  case key.KEY.escape:
    menu_SinglePlayer_f();
    return;
  case key.KEY.enter:
    await s.localSound(state.sfx_menu2);
    if (state.loadable[state.load_cursor] !== true)
      return;
    state.menu = MENU_STATE.none;
    key.state.dest = key.KEY_DEST.game;
    scr.beginLoadingPlaque();
    cmd.state.text += 'load s' + state.load_cursor + '\n';
    return;
  case key.KEY.uparrow:
  case key.KEY.leftarrow:
    await s.localSound(state.sfx_menu1);
    if (--state.load_cursor < 0)
      state.load_cursor = state.max_savegames - 1;
    return;
  case key.KEY.downarrow:
  case key.KEY.rightarrow:
    await s.localSound(state.sfx_menu1);
    if (++state.load_cursor >= state.max_savegames)
      state.load_cursor = 0;
    return;
  case key.KEY.del:
    if (state.removable[state.load_cursor] !== true)
      return;
    if (confirm('Delete selected game?') !== true)
      return;
    localStorage.removeItem('Quake.' + com.state.gamedir[0].filename + '/s' + state.load_cursor + '.sav');
    await scanSaves();
  }
};

export const save_Key = async function(k)
{
  switch (k)
  {
  case key.KEY.escape:
    menu_SinglePlayer_f();
    return;
  case key.KEY.enter:
    state.menu = MENU_STATE.none;
    key.state.dest = key.KEY_DEST.game;
    cmd.state.text += 'save s' + state.load_cursor + '\n';
    return;
  case key.KEY.uparrow:
  case key.KEY.leftarrow:
    await s.localSound(state.sfx_menu1);
    if (--state.load_cursor < 0)
      state.load_cursor = state.max_savegames - 1;
    return;
  case key.KEY.downarrow:
  case key.KEY.rightarrow:
    await s.localSound(state.sfx_menu1);
    if (++state.load_cursor >= state.max_savegames)
      state.load_cursor = 0;
    return;
  case key.KEY.del:
    if (state.removable[state.load_cursor] !== true)
      return;
    if (confirm('Delete selected game?') !== true)
      return;
    localStorage.removeItem('Quake.' + com.state.gamedir[0].filename + '/s' + state.load_cursor + '.sav');
    await scanSaves();
  }
};

export const menu_MultiPlayer_f = function()
{
  key.state.dest = key.KEY_DEST.menu;
  state.menu = MENU_STATE.multiplayer;
  state.entersound = true;
  state.multiplayer_myname = cl.cvr.name.string;
  state.multiplayer_top = state.multiplayer_oldtop = cl.cvr.color.value >> 4;
  state.multiplayer_bottom = state.multiplayer_oldbottom = cl.cvr.color.value & 15;
};

export const multiPlayer_Draw = function()
{
  drawPic(16, 4, state.qplaque);
  drawPic(160 - (state.p_multi.width >> 1), 4, state.p_multi);

  print(64, 40, 'Join game at:');
  drawTextBox(72, 48, 22, 1);
  print(80, 56, state.multiplayer_joinname.substring(state.multiplayer_joinname.length - 21));

  print(64, 72, 'Your name');
  drawTextBox(160, 64, 16, 1);
  print(168, 72, state.multiplayer_myname);

  print(64, 96, 'Shirt color');
  print(64, 120, 'Pants color');

  drawTextBox(64, 148, 14, 1);
  print(72, 156, 'Accept Changes');

  drawPic(160, 80, state.bigbox);
  drawPicTranslate(172, 88, state.menuplyr,
    (state.multiplayer_top << 4) + (state.multiplayer_top >= 8 ? 4 : 11),
    (state.multiplayer_bottom << 4) + (state.multiplayer_bottom >= 8 ? 4 : 11));

  drawCharacter(56, state.multiplayer_cursor_table[state.multiplayer_cursor], 12 + ((host.state.realtime * 4.0) & 1));

  if (state.multiplayer_cursor === 0)
    drawCharacter(state.multiplayer_joinname.length <= 20 ? 80 + (state.multiplayer_joinname.length << 3) : 248, 56, 10 + ((host.state.realtime * 4.0) & 1));
  else if (state.multiplayer_cursor === 1)
    drawCharacter(168 + (state.multiplayer_myname.length << 3), 72, 10 + ((host.state.realtime * 4.0) & 1));

  const websDriver = net.state.drivers.find(driver => driver.name === "websocket")
  if (websDriver && websDriver.available !== true) {
    printWhite(52, 172, 'No Communications Available');
  }
};

export const multiPlayer_Key = async function(k)
{
  if (k === key.KEY.escape)
    menu_Main_f();

  switch (k)
  {
  case key.KEY.uparrow:
    await s.localSound(state.sfx_menu1);
    if (--state.multiplayer_cursor < 0)
      state.multiplayer_cursor = state.multiplayer_items - 1;
    return;
  case key.KEY.downarrow:
    await s.localSound(state.sfx_menu1);
    if (++state.multiplayer_cursor >= state.multiplayer_items)
      state.multiplayer_cursor = 0;
    return;
  case key.KEY.leftarrow:
    if (state.multiplayer_cursor === 2)
    {
      if (--state.multiplayer_top < 0)
        state.multiplayer_top = 13;
      await s.localSound(state.sfx_menu3);
    }
    else if (state.multiplayer_cursor === 3)
    {
      if (--state.multiplayer_bottom < 0)
        state.multiplayer_bottom = 13;
      await s.localSound(state.sfx_menu3);
    }
    return;
  case key.KEY.rightarrow:
    if (state.multiplayer_cursor === 2)
      (state.multiplayer_top <= 12) ? ++state.multiplayer_top : state.multiplayer_top = 0;
    else if (state.multiplayer_cursor === 3)
      (state.multiplayer_bottom <= 12) ? ++state.multiplayer_bottom : state.multiplayer_bottom = 0;
    else
      return;
    await s.localSound(state.sfx_menu3);
    return;
  case key.KEY.enter:
    switch (state.multiplayer_cursor)
    {
    case 0:
      await s.localSound(state.sfx_menu2);
      const websDriver = net.state.drivers.find(driver => driver.name === "websocket")
      if (websDriver && websDriver.available !== true) {
        return
      }
      key.state.dest = key.KEY_DEST.game;
      state.menu = MENU_STATE.none;
      cmd.state.text += 'connect "';
      if (state.multiplayer_joinname.substring(0, 5) !== 'ws://')
        cmd.state.text += 'ws://';
      cmd.state.text += state.multiplayer_joinname + '"\n';
      return;
    case 2:
      await s.localSound(state.sfx_menu3);
      (state.multiplayer_top <= 12) ? ++state.multiplayer_top : state.multiplayer_top = 0;
      return;
    case 3:
      await s.localSound(state.sfx_menu3);
      (state.multiplayer_bottom <= 12) ? ++state.multiplayer_bottom : state.multiplayer_bottom = 0;
      return;
    case 4:
      if (cl.cvr.name.string !== state.multiplayer_myname)
        cmd.state.text += 'name "' + state.multiplayer_myname + '"\n';
      if ((state.multiplayer_top !== state.multiplayer_oldtop) || (state.multiplayer_bottom !== state.multiplayer_oldbottom))
      {
        state.multiplayer_oldtop = state.multiplayer_top;
        state.multiplayer_oldbottom = state.multiplayer_bottom;
        cmd.state.text += 'color ' + state.multiplayer_top + ' ' + state.multiplayer_bottom + '\n';
      }
      state.entersound = true;
    }
    return;
  case key.KEY.backspace:
    if (state.multiplayer_cursor === 0)
    {
      if (state.multiplayer_joinname.length !== 0)
        state.multiplayer_joinname = state.multiplayer_joinname.substring(0, state.multiplayer_joinname.length - 1);
      return;
    }
    if (state.multiplayer_cursor === 1)
    {
      if (state.multiplayer_myname.length !== 0)
        state.multiplayer_myname = state.multiplayer_myname.substring(0, state.multiplayer_myname.length - 1);
    }
    return;
  }

  if ((k < 32) || (k > 127))
    return;
  if (state.multiplayer_cursor === 0)
  {
    state.multiplayer_joinname += String.fromCharCode(k);
    return;
  }
  if (state.multiplayer_cursor === 1)
  {
    if (state.multiplayer_myname.length <= 14)
      state.multiplayer_myname += String.fromCharCode(k);
  }
};

// Options menu
export const menu_Options_f = function()
{
  key.state.dest = key.KEY_DEST.menu;
  state.menu = MENU_STATE.options;
  state.entersound = true;
};

export const adjustSliders = async function(dir)
{
  await s.localSound(state.sfx_menu3);
  
  switch (state.options_cursor)
  {
  case 3: // screen size
    scr.cvr.viewsize.value += dir * 10;
    if (scr.cvr.viewsize.value < 30)
      scr.cvr.viewsize.value = 30;
    else if (scr.cvr.viewsize.value > 120)
      scr.cvr.viewsize.value = 120;
    cvar.setValue('viewsize', scr.cvr.viewsize.value);
    return;
  case 4: // gamma
    v.cvr.gamma.value -= dir * 0.05;
    if (v.cvr.gamma.value < 0.5)
      v.cvr.gamma.value = 0.5;
    else if (v.cvr.gamma.value > 1.0)
      v.cvr.gamma.value = 1.0;
    cvar.setValue('gamma', v.cvr.gamma.value);
    return;
  case 5: // mouse speed
    cl.cvr.sensitivity.value += dir * 0.5;
    if (cl.cvr.sensitivity.value < 1.0)
      cl.cvr.sensitivity.value = 1.0;
    else if (cl.cvr.sensitivity.value > 11.0)
      cl.cvr.sensitivity.value = 11.0;
    cvar.setValue('sensitivity', cl.cvr.sensitivity.value);
    return;
  case 6: // music volume
    s.cvr.bgmvolume.value += dir * 0.1;
    if (s.cvr.bgmvolume.value < 0.0)
      s.cvr.bgmvolume.value = 0.0;
    else if (s.cvr.bgmvolume.value > 1.0)
      s.cvr.bgmvolume.value = 1.0;
    cvar.setValue('bgmvolume', s.cvr.bgmvolume.value);
    return;
  case 7: // sfx volume
    s.cvr.volume.value += dir * 0.1;
    if (s.cvr.volume.value < 0.0)
      s.cvr.volume.value = 0.0;
    else if (s.cvr.volume.value > 1.0)
      s.cvr.volume.value = 1.0;
    cvar.setValue('volume', s.cvr.volume.value);
    return;
  case 8: // allways run
    if (cl.cvr.forwardspeed.value > 200.0)
    {
      cvar.setValue('cl_forwardspeed', 200.0);
      cvar.setValue('cl_backspeed', 200.0);
      return;
    }
    cvar.setValue('cl_forwardspeed', 400.0);
    cvar.setValue('cl_backspeed', 400.0);
    return;
  case 9: // invert mouse
    cvar.setValue('m_pitch', -cl.cvr.m_pitch.value);
    return;
  case 10: // lookspring
    cvar.setValue('lookspring', (cl.cvr.lookspring.value !== 0) ? 0 : 1);
    return;
  case 11: // lookstrafe
    cvar.setValue('lookstrafe', (cl.cvr.lookstrafe.value !== 0) ? 0 : 1);
  }
};

export const drawSlider = function(x, y, range)
{
  if (range < 0)
    range = 0;
  else if (range > 1)
    range = 1;
  drawCharacter(x - 8, y, 128);
  drawCharacter(x, y, 129);
  drawCharacter(x + 8, y, 129);
  drawCharacter(x + 16, y, 129);
  drawCharacter(x + 24, y, 129);
  drawCharacter(x + 32, y, 129);
  drawCharacter(x + 40, y, 129);
  drawCharacter(x + 48, y, 129);
  drawCharacter(x + 56, y, 129);
  drawCharacter(x + 64, y, 129);
  drawCharacter(x + 72, y, 129);
  drawCharacter(x + 80, y, 130);
  drawCharacter(x + Math.floor(72 * range), y, 131);
};

export const options_Draw = function()
{
  drawPic(16, 4, state.qplaque);
  drawPic(160 - (state.p_option.width >> 1), 4, state.p_option);
  
  print(48, 32, 'Customize controls');
  print(88, 40, 'Go to console');
  print(56, 48, 'Reset to defaults');
  
  print(104, 56, 'Screen size');
  drawSlider(220, 56, (scr.cvr.viewsize.value - 30) / 90);
  print(112, 64, 'Brightness');
  drawSlider(220, 64, (1.0 - v.cvr.gamma.value) * 2.0);
  print(104, 72, 'Mouse Speed');
  drawSlider(220, 72, (cl.cvr.sensitivity.value - 1) / 10);
  print(72, 80, 'CD Music Volume');
  drawSlider(220, 80, s.cvr.bgmvolume.value);
  print(96, 88, 'Sound Volume');
  drawSlider(220, 88, s.cvr.volume.value);
  print(112, 96, 'Always Run');
  print(220, 96, (cl.cvr.forwardspeed.value > 200.0) ? 'on' : 'off');
  print(96, 104, 'Invert Mouse');
  print(220, 104, (cl.cvr.m_pitch.value < 0.0) ? 'on' : 'off');
  print(112, 112, 'Lookspring');
  print(220, 112, (cl.cvr.lookspring.value !== 0) ? 'on' : 'off');
  print(112, 120, 'Lookstrafe');
  print(220, 120, (cl.cvr.lookstrafe.value !== 0) ? 'on' : 'off');
  
  drawCharacter(200, 32 + (state.options_cursor << 3), 12 + ((host.state.realtime * 4.0) & 1));
};

export const options_Key = async function(k)
{
  switch (k)
  {
  case key.KEY.escape:
    menu_Main_f();
    return;
  case key.KEY.enter:
    state.entersound = true;
    switch (state.options_cursor)
    {
    case 0:
      menu_Keys_f();
      return;
    case 1:
      state.menu = MENU_STATE.none;
      con.toggleConsole_f();
      return;
    case 2:
      cmd.state.text += 'exec default.cfg\n';
      return;
    default:
      await adjustSliders(1);
    }
    return;
  case key.KEY.uparrow:
    await s.localSound(state.sfx_menu1);
    if (--state.options_cursor < 0)
      state.options_cursor = state.options_items - 1;
    return;
  case key.KEY.downarrow:
    await s.localSound(state.sfx_menu1);
    if (++state.options_cursor >= state.options_items)
      state.options_cursor = 0;
    return;
  case key.KEY.leftarrow:
    await adjustSliders(-1);
    return;
  case key.KEY.rightarrow:
    await adjustSliders(1);
  }
};


// Keys menu

export const menu_Keys_f = function()
{
  key.state.dest = key.KEY_DEST.menu;
  state.menu = MENU_STATE.keys;
  state.entersound = true;
};

export const findKeysForCommand = function(command)
{
  var twokeys = [], i;
  for (i = 0; i < key.state.bindings.length; ++i)
  {
    if (key.state.bindings[i] === command)
    {
      twokeys[twokeys.length] = i;
      if (twokeys.length === 2)
        return twokeys;
    }
  }
  return twokeys;
};

export const unbindCommand = function(command)
{
  var i;
  for (i = 0; i < key.state.bindings.length; ++i)
  {
    if (key.state.bindings[i] === command)
      delete key.state.bindings[i];
  }
};

export const keys_Draw = function()
{
  drawPic(160 - (state.ttl_cstm.width >> 1), 4, state.ttl_cstm);

  if (state.bind_grab === true)
  {
    print(12, 32, 'Press a key or button for this action');
    drawCharacter(130, 48 + (state.keys_cursor << 3), 61);
  }
  else
  {
    print(18, 32, 'Enter to change, backspace to clear');
    drawCharacter(130, 48 + (state.keys_cursor << 3), 12 + ((host.state.realtime * 4.0) & 1));
  }

  var i, y = 48, keys, name;
  for (i = 0; i < bindnames.length; ++i)
  {
    print(16, y, bindnames[i][1]);
    keys = findKeysForCommand(bindnames[i][0]);
    if (keys[0] == null)
      print(140, y, '???');
    else
    {
      name = key.keynumToString(keys[0]);
      if (keys[1] != null)
        name += ' or ' + key.keynumToString(keys[1]);
      print(140, y, name);
    }
    y += 8;
  }
};

export const keys_Key = async function(k)
{
  if (state.bind_grab === true)
  {
    await s.localSound(state.sfx_menu1);
    if ((k !== key.KEY.escape) && (k !== 96))
      cmd.state.text = 'bind "' + key.keynumToString(k) + '" "' + bindnames[state.keys_cursor][0] + '"\n' + cmd.state.text;
    state.bind_grab = false;
    return;
  }

  switch (k)
  {
  case key.KEY.escape:
    menu_Options_f();
    return;
  case key.KEY.leftarrow:
  case key.KEY.uparrow:
    await s.localSound(state.sfx_menu1);
    if (--state.keys_cursor < 0)
      state.keys_cursor = bindnames.length - 1;
    return;
  case key.KEY.downarrow:
  case key.KEY.rightarrow:
    await s.localSound(state.sfx_menu1);
    if (++state.keys_cursor >= bindnames.length)
      state.keys_cursor = 0;
    return;
  case key.KEY.enter:
    await s.localSound(state.sfx_menu2);
    if (findKeysForCommand(bindnames[state.keys_cursor][0])[1] != null)
      unbindCommand(bindnames[state.keys_cursor][0]);
    state.bind_grab = true;
    return;
  case key.KEY.backspace:
  case key.KEY.del:
    await s.localSound(state.sfx_menu2);
    unbindCommand(bindnames[state.keys_cursor][0]);
  }
};

// Help menu

export const menu_Help_f = function()
{
  key.state.dest = key.KEY_DEST.menu;
  state.menu = MENU_STATE.help;
  state.entersound = true;
  state.help_page = 0;
};

export const help_Draw = function()
{
  drawPic(0, 0, state.help_pages[state.help_page]);
};

export const help_Key = function(k)
{
  switch (k)
  {
  case key.KEY.escape:
    menu_Main_f();
    return;
  case key.KEY.uparrow:
  case key.KEY.rightarrow:
    state.entersound = true;
    if (++state.help_page >= state.num_help_pages)
      state.help_page = 0;
    return;
  case key.KEY.downarrow:
  case key.KEY.leftarrow:
    state.entersound = true;
    if (--state.help_page < 0)
      state.help_page = state.num_help_pages - 1;
  };
};

// Quit menu

export const menu_Quit_f = function()
{
  if (state.menu === MENU_STATE.quit)
    return;
  state.wasInMenus = (key.state.dest === key.KEY_DEST.menu);
  key.state.dest = key.KEY_DEST.menu;
  state.quit_prevstate = state.menu;
  state.menu = MENU_STATE.quit;
  state.entersound = true;
  state.msgNumber = Math.floor(Math.random() * quitMessage.length);
};

export const quit_Draw = async function()
{
  if (state.wasInMenus === true)
  {
    state.menu = state.quit_prevstate;
    state.recursiveDraw = true;
    drawMenu();
    state.menu = MENU_STATE.quit;
  }
  drawTextBox(56, 76, 24, 4);
  print(64, 84, quitMessage[state.msgNumber][0]);
  print(64, 92, quitMessage[state.msgNumber][1]);
  print(64, 100, quitMessage[state.msgNumber][2]);
  print(64, 108, quitMessage[state.msgNumber][3]);
};

export const quit_Key = function(k)
{
  switch (k)
  {
  case key.KEY.escape:
  case 110:
    if (state.wasInMenus === true)
    {
      state.menu = state.quit_prevstate;
      state.entersound = true;
    }
    else
    {
      key.state.dest = key.KEY_DEST.game;
      state.menu = MENU_STATE.none;
    }
    break;
  case 121:
    key.state.dest = key.KEY_DEST.console;
    host.quit_f();
  }
};


// Menu Subsystem
export const init = async function()
{
  gl = GL.getContext()
  
  cmd.addCommand('togglemenu', toggleMenu_f);
  cmd.addCommand('menu_main', menu_Main_f);
  cmd.addCommand('menu_singleplayer', menu_SinglePlayer_f);
  cmd.addCommand('menu_load', menu_Load_f);
  cmd.addCommand('menu_save', menu_Save_f);
  cmd.addCommand('menu_multiplayer', menu_MultiPlayer_f);
  cmd.addCommand('menu_setup', menu_MultiPlayer_f);
  cmd.addCommand('menu_options', menu_Options_f);
  cmd.addCommand('menu_keys', menu_Keys_f);
  cmd.addCommand('help', menu_Help_f);
  cmd.addCommand('menu_quit', menu_Quit_f);

  state.sfx_menu1 = await s.precacheSound('misc/menu1.wav');
  state.sfx_menu2 = await s.precacheSound('misc/menu2.wav');
  state.sfx_menu3 = await s.precacheSound('misc/menu3.wav');

  state.box_tl = await draw.cachePic('box_tl');
  state.box_ml = await draw.cachePic('box_ml');
  state.box_bl = await draw.cachePic('box_bl');
  state.box_tm = await draw.cachePic('box_tm');
  state.box_mm = await draw.cachePic('box_mm');
  state.box_mm2 = await draw.cachePic('box_mm2');
  state.box_bm = await draw.cachePic('box_bm');
  state.box_tr = await draw.cachePic('box_tr');
  state.box_mr = await draw.cachePic('box_mr');
  state.box_br = await draw.cachePic('box_br');

  state.qplaque = await draw.cachePic('qplaque');

  state.menudot = [
    await draw.cachePic('menudot1'),
    await draw.cachePic('menudot2'),
    await draw.cachePic('menudot3'),
    await draw.cachePic('menudot4'),
    await draw.cachePic('menudot5'),
    await draw.cachePic('menudot6')
  ];

  state.ttl_main = await draw.cachePic('ttl_main');
  state.mainmenu = await draw.cachePic('mainmenu');

  state.ttl_sgl = await draw.cachePic('ttl_sgl');
  state.sp_menu = await draw.cachePic('sp_menu');
  state.p_load = await draw.cachePic('p_load');
  state.p_save = await draw.cachePic('p_save');

  state.p_multi = await draw.cachePic('p_multi');
  state.bigbox = await draw.cachePic('bigbox');
  state.menuplyr = await draw.cachePic('menuplyr');
  var buf = await com.loadFile('gfx/menuplyr.lmp');
  var data = GL.resampleTexture(state.menuplyr.data, state.menuplyr.width, state.menuplyr.height, 64, 64);
  var trans = new Uint8Array(new ArrayBuffer(16384));
  var i, p;
  for (i = 0; i < 4096; ++i)
  {
    p = data[i];
    if ((p >> 4) === 1)
    {
      trans[i << 2] = (p & 15) * 17;
      trans[(i << 2) + 1] = 255;
    }
    else if ((p >> 4) === 6)
    {
      trans[(i << 2) + 2] = (p & 15) * 17;
      trans[(i << 2) + 3] = 255;
    }
  }
  state.menuplyr.translate = gl.createTexture();
  GL.bind(0, state.menuplyr.translate);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 64, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, trans);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  state.p_option = await draw.cachePic('p_option');
  state.ttl_cstm = await draw.cachePic('ttl_cstm');

  state.help_pages = [
    await draw.cachePic('help0'),
    await draw.cachePic('help1'),
    await draw.cachePic('help2'),
    await draw.cachePic('help3'),
    await draw.cachePic('help4'),
    await draw.cachePic('help5')
  ];
};

export const drawMenu = async function()
{
  if ((state.menu === MENU_STATE.none) || (key.state.dest !== key.KEY_DEST.menu))
    return;

  if (state.recursiveDraw !== true)
  {
    if (scr.state.con_current !== 0)
      draw.consoleBackground(vid.state.height);
    else
      draw.fadeScreen();
  }
  else
    state.recursiveDraw = false;
  
  switch (state.menu)
  {
  case MENU_STATE.main:
    main_Draw();
    break;
  case MENU_STATE.singleplayer:
    singlePlayer_Draw();
    break;
  case MENU_STATE.load:
    load_Draw();
    break;
  case MENU_STATE.save:
    save_Draw();
    break;
  case MENU_STATE.multiplayer:
    multiPlayer_Draw();
    break;
  case MENU_STATE.options:
    options_Draw();
    break;
  case MENU_STATE.keys:
    keys_Draw();
    break;
  case MENU_STATE.help:
    help_Draw();
    break;
  case MENU_STATE.quit:
    quit_Draw();
  }
  if (state.entersound === true)
  {
    s.localSound(state.sfx_menu2);
    state.entersound = false;
  }
};

export const keydown = async function(key)
{
  switch (state.menu)
  {
  case MENU_STATE.main:
    await main_Key(key);
    return;
  case MENU_STATE.singleplayer:
    await singlePlayer_Key(key);
    return;
  case MENU_STATE.load:
    await load_Key(key);
    return;
  case MENU_STATE.save:
    await save_Key(key);
    return;
  case MENU_STATE.multiplayer:
    await multiPlayer_Key(key);
    return;
  case MENU_STATE.options:
    await options_Key(key);
    return;
  case MENU_STATE.keys:
    await keys_Key(key);
    return;
  case MENU_STATE.help:
    help_Key(key);
    return;
  case MENU_STATE.quit:
    quit_Key(key);
  }
};