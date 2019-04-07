import * as com from '../../engine/com'
import * as host from '../../engine/host'
import * as key from '../../engine/key'
import * as vid from '../../engine/vid'
import * as con from '../../engine/console'
import * as q from '../../engine/q'
import * as _assetStore from './assetStore'
import * as loop from './net/loop'
import * as webs from './net/webs'

export const assetStore = _assetStore
export const state = {
  looping: false,
  scantokey: [],
	oldtime: 0.0,
	onQuit: null
} as any

const onbeforeunload = function()
{
	return 'Are you sure you want to quit?';
};

const oncontextmenu = function(e)
{
	e.preventDefault();
};

const onfocus = async function()
{
	var i;
	for (i = 0; i < 256; ++i)
	{
		await key.event(i, false);
		key.state.down[i] = false;
	}
};

const onkeydown = async function(e)
{
	var _key = state.scantokey[e.keyCode];
	if (_key == null)
		return;
	await key.event(_key, true);
	e.preventDefault();
};

const onkeyup = async function(e)
{
	var _key = state.scantokey[e.keyCode];
	if (_key == null)
		return;
	await key.event(_key, false);
	e.preventDefault();
};

const onmousedown = async function(e)
{
	var _key;
	switch (e.which)
	{
	case 1:
		_key = key.KEY.mouse1;
		break;
	case 2:
		_key = key.KEY.mouse3;
		break;
	case 3:
		_key = key.KEY.mouse2;
		break;
	default:
		return;
	}
	await key.event(_key, true)
	e.preventDefault();
};

const onmouseup = async function(e)
{
	var _key;
	switch (e.which)
	{
	case 1:
		_key = key.KEY.mouse1;
		break;
	case 2:
		_key = key.KEY.mouse3;
		break;
	case 3:
		_key = key.KEY.mouse2;
		break;
	default:
		return;
	}
	await key.event(_key, false)
	e.preventDefault();
};

const onmousewheel = async function(e)
{
	var _key = e.wheelDeltaY > 0 ? key.KEY.mwheelup : key.KEY.mwheeldown;
	await key.event(_key, true);
	await key.event(_key, false);
	e.preventDefault();
};

const onunload = function()
{
	host.shutdown();
};

const onwheel = async function(e)
{
	var _key = e.deltaY < 0 ? key.KEY.mwheelup : key.KEY.mwheeldown;
	await key.event(_key, true);
	await key.event(_key, false);
	e.preventDefault();
};


export const init = async () =>
{
	if ((document.location.protocol !== 'http:') && (document.location.protocol !== 'https:'))
		error('Protocol is ' + document.location.protocol + ', not http: or https:');
	if (Number.isNaN != null)
		q.state.isNaN = Number.isNaN;
	else
		q.state.isNaN = isNaN;

	var i;

	var cmdline = decodeURIComponent(document.location.search);
	var location = document.location;
	var argv = [location.href.substring(0, location.href.length - location.search.length)];
	if (cmdline.charCodeAt(0) === 63)
	{
		var text = '';
		var quotes = false;
		var c;
		for (i = 1; i < cmdline.length; ++i)
		{
			c = cmdline.charCodeAt(i);
			if ((c < 32) || (c > 127))
				continue;
			if (c === 34)
			{
				quotes = !quotes;
				continue;
			}
			if ((quotes === false) && (c === 32))
			{
				if (text.length === 0)
					continue;
				argv[argv.length] = text;
				text = '';
				continue;
			}
			text += cmdline.charAt(i);
		}
		if (text.length !== 0)
			argv[argv.length] = text;
	}
	com.initArgv(argv);

	var elem = document.documentElement;
	vid.state.width = (elem.clientWidth <= 320) ? 320 : elem.clientWidth;
	vid.state.height = (elem.clientHeight <= 200) ? 200 : elem.clientHeight;

	state.scantokey = [];
	state.scantokey[8] = key.KEY.backspace;
	state.scantokey[9] = key.KEY.tab;
	state.scantokey[13] = key.KEY.enter;
	state.scantokey[16] = key.KEY.shift;
	state.scantokey[17] = key.KEY.ctrl;
	state.scantokey[18] = key.KEY.alt;
	state.scantokey[19] = key.KEY.pause;
	state.scantokey[27] = key.KEY.escape;
	state.scantokey[32] = key.KEY.space;
	state.scantokey[33] = state.scantokey[105] = key.KEY.pgup;
	state.scantokey[34] = state.scantokey[99] = key.KEY.pgdn;
	state.scantokey[35] = state.scantokey[97] = key.KEY.end;
	state.scantokey[36] = state.scantokey[103] = key.KEY.home;
	state.scantokey[37] = state.scantokey[100] = key.KEY.leftarrow;
	state.scantokey[38] = state.scantokey[104] = key.KEY.uparrow;
	state.scantokey[39] = state.scantokey[102] = key.KEY.rightarrow;
	state.scantokey[40] = state.scantokey[98] = key.KEY.downarrow;
	state.scantokey[45] = state.scantokey[96] = key.KEY.ins;
	state.scantokey[46] = state.scantokey[110] = key.KEY.del;
	for (i = 48; i <= 57; ++i)
		state.scantokey[i] = i; // 0-9
	state.scantokey[59] = state.scantokey[186] = 59; // ;
	state.scantokey[61] = state.scantokey[187] = 61; // =
	for (i = 65; i <= 90; ++i)
		state.scantokey[i] = i + 32; // a-z
	state.scantokey[106] = 42; // *
	state.scantokey[107] = 43; // +
	state.scantokey[109] = state.scantokey[173] = state.scantokey[189] = 45; // -
	state.scantokey[111] = state.scantokey[191] = 47; // /
	for (i = 112; i <= 123; ++i)
		state.scantokey[i] = i - 112 + key.KEY.f1; // f1-f12
	state.scantokey[188] = 44; // ,
	state.scantokey[190] = 46; // .
	state.scantokey[192] = 96; // `
	state.scantokey[219] = 91; // [
	state.scantokey[220] = 92; // backslash
	state.scantokey[221] = 93; // ]
	state.scantokey[222] = 39; // '

	state.oldtime = Date.now() * 0.001;

	print('Host.Init\n');
	await host.init(false, assetStore, [loop, webs]);

  const eventNames = Object.keys(events)
	for (i = 0; i < eventNames.length; ++i)
		window[eventNames[i]] = events[eventNames[i]];

	const gameLoop = async () => {
		var timeIn = Date.now();
		try{
			await host.frame();
		} 
		catch(e) {
			if(e && e.message)
			{
				console.log(e && e.message)
			}
		}

		if(!state.looping)
			return;
			
		var putzAroundTime = Math.max((1000.0 / state.maxFps) - (Date.now() - timeIn), 0);
		
		return setTimeout(gameLoop, putzAroundTime);
	}

	state.looping = true;
	gameLoop();
};

const events = {
  onbeforeunload,
  oncontextmenu,
  onfocus,
  onkeydown,
  onkeyup,
  onmousedown,
  onmouseup,
  onmousewheel,
  onunload,
  onwheel
}

export const floatTime = (): number =>
{
	return Date.now() * 0.001 - state.oldtime;
};

export const print = function(text: string)
{
	if (window.console != null)
		console.log(text);
};

export const quit = function()
{
	if (state.looping)
  state.looping = false;
  var i;
  const eventNames = Object.keys(events)
	for (i = 0; i < eventNames.length; ++i)
		window[eventNames[i]] = null;
	host.shutdown();
	document.body.style.cursor = 'auto';
	if (state.hooks && state.hooks.quit) {
		state.hooks.quit()
	}
	// vid.state.mainwindow.style.display = 'none';
	// if (com.cvr.registered.value !== 0)
	// 	document.getElementById('end2').style.display = 'inline';
	// else
	// 	document.getElementById('end1').style.display = 'inline';
	// // throw new Error;
};

export const error = function(text)
{
	if (state.looping)
		state.looping = false;
	var i;
  const eventNames = Object.keys(events)
	for (i = 0; i < eventNames.length; ++i)
		window[eventNames[i]] = null;
	if (host.state.initialized === true)
		host.shutdown();
	document.body.style.cursor = 'auto';
	i = con.state.text.length - 25;
	if (i < 0)
		i = 0;
	if (window.console != null)
	{
		for (; i < con.state.text.length; ++i)
			console.log(con.state.text[i].text);
	}
	alert(text);
	throw new Error(text);
};

export const getExternalCommand = () => {
	return null
}

export const registerHooks = (hooks) => {
	state.hooks = hooks
}