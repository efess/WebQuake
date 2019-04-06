import * as cl from './cl'
import * as host from './host'
import * as cmd from './cmd'
import * as vid from './vid'
import * as con from './console'
import * as key from './key'
import * as v from './v'
import * as draw from './draw'
import * as cvar from './cvar'
import * as r from './r'
import * as scr from './scr'
import * as s from './s'
import * as sbar from './sbar'
import * as m from './m'
import * as GL from './GL'

export const state = {
  con_current: 0,
  centertime_off: 0.0,
  centerstring: []
} as any

export const cvr = {
} as any

export const centerPrint = function(str)
{
	state.centerstring = [];
	var i, start = 0, next;
	for (i = 0; i < str.length; ++i)
	{
		if (str.charCodeAt(i) === 10)
			next = i + 1;
		else if ((i - start) >= 40)
			next = i;
		else
			continue;
		state.centerstring[state.centerstring.length] = str.substring(start, i);
		start = next;
	}
	state.centerstring[state.centerstring.length] = str.substring(start, i);
	state.centertime_off = cvr.centertime.value;
	state.centertime_start = cl.clState.time;
}

export const drawCenterString = function()
{
	state.centertime_off -= host.state.frametime;
	if (((state.centertime_off <= 0.0) && (cl.clState.intermission === 0)) || (key.state.dest !== key.KEY_DEST.game))
		return;

	var y;
	if (state.centerstring.length <= 4)
		y = Math.floor(vid.state.height * 0.35);
	else
		y = 48;

	var i;
	if (cl.clState.intermission)
	{
		var remaining = Math.floor(cvr.printspeed.value * (cl.clState.time - state.centertime_start));
		var str, x, j;
		for (i = 0; i < state.centerstring.length; ++i)
		{
			str = state.centerstring[i];
			x = (vid.state.width - (str.length << 3)) >> 1;
			for (j = 0; j < str.length; ++j)
			{
				draw.character(x, y, str.charCodeAt(j));
				if ((remaining--) === 0)
					return;
				x += 8;
			}
			y += 8;
		}
		return;
	}

	for (i = 0; i < state.centerstring.length; ++i)
	{
		draw.string((vid.state.width - (state.centerstring[i].length << 3)) >> 1, y, state.centerstring[i]);
		y += 8;
	}
};

export const calcRefdef = function()
{
	state.recalc_refdef = false;

	if (cvr.viewsize.value < 30)
		cvar.set('viewsize', '30');
	else if (cvr.viewsize.value > 120)
		cvar.set('viewsize', '120');

	var size, full;
	if (cl.clState.intermission !== 0)
	{
		full = true;
		size = 1.0;
		sbar.state.lines = 0;
	}
	else
	{
		size = cvr.viewsize.value;
		if (size >= 120.0)
			sbar.state.lines = 0;
		else if (size >= 110.0)
			sbar.state.lines = 24;
		else
			sbar.state.lines = 48;
		if (size >= 100.0)
		{
			full = true;
			size = 100.0;
		}
		size *= 0.01;
	}

	var vrect = r.state.refdef.vrect;
	vrect.width = Math.floor(vid.state.width * size);
	if (vrect.width < 96)
	{
		size = 96.0 / vrect.width;
		vrect.width = 96;
	}
	vrect.height = Math.floor(vid.state.height * size);
	if (vrect.height > (vid.state.height - sbar.state.lines))
		vrect.height = vid.state.height - sbar.state.lines;
	vrect.x = (vid.state.width - vrect.width) >> 1;
	if (full === true)
		vrect.y = 0;
	else
		vrect.y = (vid.state.height - sbar.state.lines - vrect.height) >> 1;

	if (cvr.fov.value < 10)
		cvar.set('fov', '10');
	else if (cvr.fov.value > 170)
		cvar.set('fov', '170');
	if ((vrect.width * 0.75) <= vrect.height)
	{
		r.state.refdef.fov_x = cvr.fov.value;
		r.state.refdef.fov_y = Math.atan(vrect.height / (vrect.width / Math.tan(cvr.fov.value * Math.PI / 360.0))) * 360.0 / Math.PI;
	}
	else
	{
		r.state.refdef.fov_x = Math.atan(vrect.width / (vrect.height / Math.tan(cvr.fov.value * 0.82 * Math.PI / 360.0))) * 360.0 / Math.PI;
		r.state.refdef.fov_y = cvr.fov.value * 0.82;
	}

	var ymax = 4.0 * Math.tan(r.state.refdef.fov_y * Math.PI / 360.0);
	r.state.perspective[0] = 4.0 / (ymax * r.state.refdef.vrect.width / r.state.refdef.vrect.height);
	r.state.perspective[5] = 4.0 / ymax;
	GL.ortho[0] = 2.0 / vid.state.width;
	GL.ortho[5] = -2.0 / vid.state.height;

	r.state.warpwidth = (vrect.width * state.devicePixelRatio) >> 0;
	r.state.warpheight = (vrect.height * state.devicePixelRatio) >> 0;
	if (r.state.warpwidth > 2048)
		r.state.warpwidth = 2048;
	if (r.state.warpheight > 2048)
		r.state.warpheight = 2048;
	if ((r.state.oldwarpwidth !== r.state.warpwidth) || (r.state.oldwarpheight !== r.state.warpheight))
	{
		const gl = GL.getContext()
		r.state.oldwarpwidth = r.state.warpwidth;
		r.state.oldwarpheight = r.state.warpheight;
		GL.bind(0, r.state.warptexture, false);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, r.state.warpwidth, r.state.warpheight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, r.state.warprenderbuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, r.state.warpwidth, r.state.warpheight);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	}
};

export const sizeUp_f = function()
{
	cvar.setValue('viewsize', cvr.viewsize.value + 10);
	state.recalc_refdef = true;
};

export const sizeDown_f = function()
{
	cvar.setValue('viewsize', cvr.viewsize.value - 10);
	state.recalc_refdef = true;
};

export const init = async function()
{
  state.con_current = 0
  state.centertime_off = 0.0
  state.centerstring = []
	cvr.fov = cvar.registerVariable('fov', '90');
	cvr.viewsize = cvar.registerVariable('viewsize', '100', true);
	cvr.conspeed = cvar.registerVariable('scr_conspeed', '300');
	cvr.showturtle = cvar.registerVariable('showturtle', '0');
	cvr.showpause = cvar.registerVariable('showpause', '1');
	cvr.centertime = cvar.registerVariable('scr_centertime', '2');
	cvr.printspeed = cvar.registerVariable('scr_printspeed', '8');
	cmd.addCommand('screenshot', screenShot_f);
	cmd.addCommand('sizeup', sizeUp_f);
	cmd.addCommand('sizedown', sizeDown_f);
	state.net = draw.picFromWad('NET');
	state.turtle = draw.picFromWad('TURTLE');
	state.pause = await draw.cachePic('pause');
};

var count = 0;
export const drawTurtle = function()
{
	if (cvr.value === 0)
		return;
	if (host.state.frametime < 0.1)
	{
		count = 0;
		return;
	}
	if (++count >= 3)
		draw.pic(r.state.refdef.vrect.x, r.state.refdef.vrect.y, state.turtle);
};

export const drawNet = function()
{
	if (((host.state.realtime - cl.clState.last_received_message) >= 0.3) && (cl.cls.demoplayback !== true))
		draw.pic(r.state.refdef.vrect.x, r.state.refdef.vrect.y, state.net);
};

export const drawPause = function()
{
	if ((cvr.showpause.value !== 0) && (cl.clState.paused === true))
		draw.pic((vid.state.width - state.pause.width) >> 1, (vid.state.height - 48 - state.pause.height) >> 1, state.pause);
};

export const setUpToDrawConsole = function()
{
	con.state.forcedup = (cl.clState.worldmodel == null) || (cl.cls.signon !== 4);

	if (con.state.forcedup === true)
	{
		state.con_current = 200;
		return;
	}

	var conlines;
	if (key.state.dest === key.KEY_DEST.console)
		conlines = 100;
	else
		conlines = 0;

	if (conlines < state.con_current)
	{
		state.con_current -= cvr.conspeed.value * host.state.frametime;
		if (conlines > state.con_current)
			state.con_current = conlines;
	}
	else if (conlines > state.con_current)
	{
		state.con_current += cvr.conspeed.value * host.state.frametime;
		if (conlines < state.con_current)
			state.con_current = conlines;
	}
};

export const drawConsole = function()
{
	if (state.con_current > 0)
	{
		con.drawConsole(state.con_current);
		return;
	}
	if ((key.state.dest === key.KEY_DEST.game) || (key.state.dest === key.KEY_DEST.message))
		con.drawNotify();
};

export const screenShot_f = function()
{
	state.screenshot = true;
};

export const beginLoadingPlaque = function()
{
	s.stopAllSounds();
	if ((cl.cls.state !== cl.ACTIVE.connected) || (cl.cls.signon !== 4))
		return;
	state.centertime_off = 0.0;
	state.con_current = 0;
	state.disabled_for_loading = true;
	state.disabled_time = host.state.realtime + 60.0;
};

export const endLoadingPlaque = function()
{
	state.disabled_for_loading = false;
	con.clearNotify();
};

export const updateScreen = function()
{
  const gl = GL.getContext()
	if (state.disabled_for_loading === true)
	{
		if (host.state.realtime <= state.disabled_time)
			return;
		state.disabled_for_loading = false;
		con.print('load failed.\n');
	}

	var elem = document.documentElement;
	var width = (elem.clientWidth <= 320) ? 320 : elem.clientWidth;
	var height = (elem.clientHeight <= 200) ? 200 : elem.clientHeight;
	var pixelRatio;
	if (window.devicePixelRatio >= 1.0)
		pixelRatio = window.devicePixelRatio;
	else
		pixelRatio = 1.0;
	if ((vid.state.width !== width) || (vid.state.height !== height) || (state.devicePixelRatio !== pixelRatio) || (host.state.framecount === 0))
	{
		vid.state.width = width;
		vid.state.height = height;
		vid.state.mainwindow.width = (width * pixelRatio) >> 0;
		vid.state.mainwindow.height = (height * pixelRatio) >> 0;
		vid.state.mainwindow.style.width = width + 'px';
		vid.state.mainwindow.style.height = height + 'px';
		state.devicePixelRatio = pixelRatio;
		state.recalc_refdef = true;
	}

	if (state.oldfov !== cvr.fov.value)
	{
		state.oldfov = cvr.fov.value;
		state.recalc_refdef = true;
	}
	if (state.oldscreensize !== cvr.viewsize.value)
	{
		state.oldscreensize = cvr.viewsize.value;
		state.recalc_refdef = true;
	}
	if (state.recalc_refdef === true)
		calcRefdef();

	setUpToDrawConsole();
	v.renderView();
	GL.set2D();
	if (r.state.dowarp === true)
		r.warpScreen();
	if (con.state.forcedup !== true)
		r.polyBlend();

	if (cl.cls.state === cl.ACTIVE.connecting)
		drawConsole();
	else if ((cl.clState.intermission === 1) && (key.state.dest === key.KEY_DEST.game))
		sbar.intermissionOverlay();
	else if ((cl.clState.intermission === 2) && (key.state.dest === key.KEY_DEST.game))
	{
		sbar.finaleOverlay();
		drawCenterString();
	}
	else if ((cl.clState.intermission === 3) && (key.state.dest === key.KEY_DEST.game))
		drawCenterString();
	else
	{
		if (v.cvr.crosshair.value !== 0)
		{
			draw.character(r.state.refdef.vrect.x + (r.state.refdef.vrect.width >> 1) + v.cvr.crossx.value,
				r.state.refdef.vrect.y + (r.state.refdef.vrect.height >> 1) + v.cvr.crossy.value, 43);
		}
		drawNet();
		drawTurtle();
		drawPause();
		drawCenterString();
		sbar.drawSbar();
		drawConsole();
		m.drawMenu();
	}

	GL.streamFlush();

	gl.disable(gl.BLEND);

	if (state.screenshot === true)
	{
		state.screenshot = false;
    gl.finish();
		// OPEN is not defined, wtf?
		// oh it's browser API.
		open(vid.state.mainwindow.toDataURL('image/jpeg'));
	}
};