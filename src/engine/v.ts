import * as cl from './cl'
import * as cmd from './cmd'
import * as host from './host'
import * as con from './console'
import * as mod from './mod'
import * as cvar from './cvar'
import * as def from './def'
import * as chase from './chase'
import * as scr from './scr'
import * as q from './q'
import * as r from './r'
import * as s from './s'
import * as vec from './vec'
import * as msg from './msg'

export const cvr = {

} as any

var oldz = 0.0
var dmg_time = 0.0
var dmg_roll = 0.0
var dmg_pitch = 0.0

const cshift_empty = [130.0, 80.0, 50.0, 0.0]
const cshift_water = [130.0, 80.0, 50.0, 128.0]
const cshift_slime = [0.0, 25.0, 5.0, 150.0]
const cshift_lava = [255.0, 80.0, 0.0, 150.0]

export const blend = [0.0, 0.0, 0.0, 0.0]

export const calcRoll = function(angles, velocity)
{
	var right = [];
	vec.angleVectors(angles, null, right, null);
	var side = velocity[0] * right[0] + velocity[1] * right[1] + velocity[2] * right[2];
	var sign = side < 0 ? -1 : 1;
	side = Math.abs(side);
	if (side < cvr.rollspeed.value)
		return side * sign * cvr.rollangle.value / cvr.rollspeed.value;
	return cvr.rollangle.value * sign;
};

export const calcBob = function()
{
	if ((cvr.bobcycle.value <= 0.0)
		|| (cvr.bobcycle.value >= 1.0)
		|| (cvr.bobup.value <= 0.0)
		|| (cvr.bobup.value >= 1.0)
		|| (cvr.bob.value === 0.0))
		return 0.0;

	var cycle = (cl.clState.time - Math.floor(cl.clState.time / cvr.bobcycle.value) * cvr.bobcycle.value) / cvr.bobcycle.value;
	if (cycle < cvr.bobup.value)
		cycle = Math.PI * cycle / cvr.bobup.value;
	else
		cycle = Math.PI + Math.PI * (cycle - cvr.bobup.value) / (1.0 - cvr.bobup.value);
	var bob = Math.sqrt(cl.clState.velocity[0] * cl.clState.velocity[0] + cl.clState.velocity[1] * cl.clState.velocity[1]) * cvr.bob.value;
	bob = bob * 0.3 + bob * 0.7 * Math.sin(cycle);
	if (bob > 4.0)
		bob = 4.0;
	else if (bob < -7.0)
		bob = -7.0;
	return bob;
};

export const startPitchDrift = function()
{
	if (cl.clState.laststop === cl.clState.time)
		return;
	if ((cl.clState.nodrift === true) || (cl.clState.pitchvel === 0.0))
	{
		cl.clState.pitchvel = cvr.centerspeed.value;
		cl.clState.nodrift = false;
		cl.clState.driftmove = 0.0;
	}
};

export const stopPitchDrift = function()
{
	cl.clState.laststop = cl.clState.time;
	cl.clState.nodrift = true;
	cl.clState.pitchvel = 0.0;
};

export const driftPitch = function()
{
	if ((host.state.noclip_anglehack === true) || (cl.clState.onground !== true) || (cl.cls.demoplayback === true))
	{
		cl.clState.driftmove = 0.0;
		cl.clState.pitchvel = 0.0;
		return;
	}

	if (cl.clState.nodrift === true)
	{
		if (Math.abs(cl.clState.cmd.forwardmove) < cl.cvr.forwardspeed.value)
			cl.clState.driftmove = 0.0;
		else
			cl.clState.driftmove += host.state.frametime;
		if (cl.clState.driftmove > cvr.centermove.value)
			startPitchDrift();
		return;
	}

	var delta = cl.clState.idealpitch - cl.clState.viewangles[0];
	if (delta === 0.0)
	{
		cl.clState.pitchvel = 0.0;
		return;
	}

	var move = host.state.frametime * cl.clState.pitchvel;
	cl.clState.pitchvel += host.state.frametime * cvr.centerspeed.value;

	if (delta > 0)
	{
		if (move > delta)
		{
			cl.clState.pitchvel = 0.0;
			move = delta;
		}
		cl.clState.viewangles[0] += move;
	}
	else if (delta < 0)
	{
		if (move > -delta)
		{
			cl.clState.pitchvel = 0.0;
			move = -delta;
		}
		cl.clState.viewangles[0] -= move;
	}
};

export const parseDamage = function()
{
	var armor = msg.readByte();
	var blood = msg.readByte();
	var ent = cl.state.entities[cl.clState.viewentity];
	var from = [msg.readCoord() - ent.origin[0], msg.readCoord() - ent.origin[1], msg.readCoord() - ent.origin[2]];
	vec.normalize(from);
	var count = (blood + armor) * 0.5;
	if (count < 10.0)
		count = 10.0;
	cl.clState.faceanimtime = cl.clState.time + 0.2;

	var cshift = cl.clState.cshifts[cl.CSHIFT.damage];
	cshift[3] += 3.0 * count;
	if (cshift[3] < 0.0)
		cshift[3] = 0.0;
	else if (cshift[3] > 150.0)
		cshift[3] = 150.0;

	if (armor > blood)
	{
		cshift[0] = 200.0;
		cshift[1] = cshift[2] = 100.0;
	}
	else if (armor !== 0)
	{
		cshift[0] = 220.0;
		cshift[1] = cshift[2] = 50.0;
	}
	else
	{
		cshift[0] = 255.0;
		cshift[1] = cshift[2] = 0.0;
	}

	var forward = [], right = [];
	vec.angleVectors(ent.angles, forward, right, null);
	dmg_roll = count * (from[0] * right[0] + from[1] * right[1] + from[2] * right[2]) * cvr.kickroll.value;
	dmg_pitch = count * (from[0] * forward[0] + from[1] * forward[1] + from[2] * forward[2]) * cvr.kickpitch.value;
	dmg_time = cvr.kicktime.value;
};

export const cshift_f = function()
{
	var cshift = cshift_empty;
	cshift[0] = q.atoi(cmd.state.argv[1]);
	cshift[1] = q.atoi(cmd.state.argv[2]);
	cshift[2] = q.atoi(cmd.state.argv[3]);
	cshift[3] = q.atoi(cmd.state.argv[4]);
};

export const bonusFlash_f = function()
{
	var cshift = cl.clState.cshifts[cl.CSHIFT.bonus];
	cshift[0] = 215.0;
	cshift[1] = 186.0;
	cshift[2] = 69.0;
	cshift[3] = 50.0;
};

export const setContentsColor = function(contents)
{
	switch (contents)
	{
	case mod.CONTENTS.empty:
	case mod.CONTENTS.solid:
		cl.clState.cshifts[cl.CSHIFT.contents] = cshift_empty;
		return;
	case mod.CONTENTS.lava:
		cl.clState.cshifts[cl.CSHIFT.contents] = cshift_lava;
		return;
	case mod.CONTENTS.slime:
		cl.clState.cshifts[cl.CSHIFT.contents] = cshift_slime;
		return;
	}
	cl.clState.cshifts[cl.CSHIFT.contents] = cshift_water;
};

export const calcBlend = function()
{
	var cshift = cl.clState.cshifts[cl.CSHIFT.powerup];
	if ((cl.clState.items & def.IT.quad) !== 0)
	{
		cshift[0] = 0.0;
		cshift[1] = 0.0;
		cshift[2] = 255.0;
		cshift[3] = 30.0;
	}
	else if ((cl.clState.items & def.IT.suit) !== 0)
	{
		cshift[0] = 0.0;
		cshift[1] = 255.0;
		cshift[2] = 0.0;
		cshift[3] = 20.0;
	}
	else if ((cl.clState.items & def.IT.invisibility) !== 0)
	{
		cshift[0] = 100.0;
		cshift[1] = 100.0;
		cshift[2] = 100.0;
		cshift[3] = 100.0;
	}
	else if ((cl.clState.items & def.IT.invulnerability) !== 0)
	{
		cshift[0] = 255.0;
		cshift[1] = 255.0;
		cshift[2] = 0.0;
		cshift[3] = 30.0;
	}
	else
		cshift[3] = 0.0;

	cl.clState.cshifts[cl.CSHIFT.damage][3] -= host.state.frametime * 150.0;
	if (cl.clState.cshifts[cl.CSHIFT.damage][3] < 0.0)
		cl.clState.cshifts[cl.CSHIFT.damage][3] = 0.0;
	cl.clState.cshifts[cl.CSHIFT.bonus][3] -= host.state.frametime * 100.0;
	if (cl.clState.cshifts[cl.CSHIFT.bonus][3] < 0.0)
		cl.clState.cshifts[cl.CSHIFT.bonus][3] = 0.0;

	if (cvr.cshiftpercent.value === 0)
	{
		blend[0] = blend[1] = blend[2] = blend[3] = 0.0;
		return;
	}

	var r = 0.0, g = 0.0, b = 0.0, a = 0.0, a2, i, cshift;
	for (i = 0; i <= 3; ++i)
	{
		cshift = cl.clState.cshifts[i];
		a2 = cshift[3] * cvr.cshiftpercent.value / 25500.0;
		if (a2 === 0.0)
			continue;
		a = a + a2 * (1.0 - a);
		a2 = a2 / a;
		r = r * (1.0 - a2) + cshift[0] * a2;
		g = g * (1.0 - a2) + cshift[1] * a2;
		b = b * (1.0 - a2) + cshift[2] * a2;
	}
	if (a > 1.0)
		a = 1.0;
	else if (a < 0.0)
		a = 0.0;
	blend[0] = r;
	blend[1] = g;
	blend[2] = b;
	blend[3] = a;
	if (blend[3] > 1.0)
		blend[3] = 1.0;
	else if (blend[3] < 0.0)
		blend[3] = 0.0;
};

export const calcIntermissionRefdef = function()
{
	var ent = cl.state.entities[cl.clState.viewentity];
	r.state.refdef.vieworg[0] = ent.origin[0];
	r.state.refdef.vieworg[1] = ent.origin[1];
	r.state.refdef.vieworg[2] = ent.origin[2];
	r.state.refdef.viewangles[0] = ent.angles[0] + Math.sin(cl.clState.time * cvr.ipitch_cycle.value) * cvr.ipitch_level.value;
	r.state.refdef.viewangles[1] = ent.angles[1] + Math.sin(cl.clState.time * cvr.iyaw_cycle.value) * cvr.iyaw_level.value;
	r.state.refdef.viewangles[2] = ent.angles[2] + Math.sin(cl.clState.time * cvr.iroll_cycle.value) * cvr.iroll_level.value;
	cl.clState.viewent.model = null;
};

export const calcRefdef = function()
{
	driftPitch();

	var ent = cl.state.entities[cl.clState.viewentity];
	ent.angles[1] = cl.clState.viewangles[1];
	ent.angles[0] = -cl.clState.viewangles[0];
	var bob = calcBob();

	r.state.refdef.vieworg[0] = ent.origin[0] + 0.03125;
	r.state.refdef.vieworg[1] = ent.origin[1] + 0.03125;
	r.state.refdef.vieworg[2] = ent.origin[2] + cl.clState.viewheight + bob + 0.03125;

	r.state.refdef.viewangles[0] = cl.clState.viewangles[0];
	r.state.refdef.viewangles[1] = cl.clState.viewangles[1];
	r.state.refdef.viewangles[2] = cl.clState.viewangles[2] + calcRoll(cl.state.entities[cl.clState.viewentity].angles, cl.clState.velocity);

	if (dmg_time > 0.0)
	{
		if (cvr.kicktime.value !== 0.0)
		{
			r.state.refdef.viewangles[2] += (dmg_time / cvr.kicktime.value) * dmg_roll;
			r.state.refdef.viewangles[0] -= (dmg_time / cvr.kicktime.value) * dmg_pitch;
		}
		dmg_time -= host.state.frametime;
	}
	if (cl.clState.stats[def.STAT.health] <= 0)
		r.state.refdef.viewangles[2] = 80.0;

	var ipitch = cvr.idlescale.value * Math.sin(cl.clState.time * cvr.ipitch_cycle.value) * cvr.ipitch_level.value;
	var iyaw = cvr.idlescale.value * Math.sin(cl.clState.time * cvr.iyaw_cycle.value) * cvr.iyaw_level.value;
	var iroll = cvr.idlescale.value * Math.sin(cl.clState.time * cvr.iroll_cycle.value) * cvr.iroll_level.value;
	r.state.refdef.viewangles[0] += ipitch;
	r.state.refdef.viewangles[1] += iyaw;
	r.state.refdef.viewangles[2] += iroll;

	var forward = [], right = [], up = [];
	vec.angleVectors([-ent.angles[0], ent.angles[1], ent.angles[2]], forward, right, up);
	r.state.refdef.vieworg[0] += cvr.ofsx.value * forward[0] + cvr.ofsy.value * right[0] + cvr.ofsz.value * up[0];
	r.state.refdef.vieworg[1] += cvr.ofsx.value * forward[1] + cvr.ofsy.value * right[1] + cvr.ofsz.value * up[1];
	r.state.refdef.vieworg[2] += cvr.ofsx.value * forward[2] + cvr.ofsy.value * right[2] + cvr.ofsz.value * up[2];

	if (r.state.refdef.vieworg[0] < (ent.origin[0] - 14.0))
		r.state.refdef.vieworg[0] = ent.origin[0] - 14.0;
	else if (r.state.refdef.vieworg[0] > (ent.origin[0] + 14.0))
		r.state.refdef.vieworg[0] = ent.origin[0] + 14.0;
	if (r.state.refdef.vieworg[1] < (ent.origin[1] - 14.0))
		r.state.refdef.vieworg[1] = ent.origin[1] - 14.0;
	else if (r.state.refdef.vieworg[1] > (ent.origin[1] + 14.0))
		r.state.refdef.vieworg[1] = ent.origin[1] + 14.0;
	if (r.state.refdef.vieworg[2] < (ent.origin[2] - 22.0))
		r.state.refdef.vieworg[2] = ent.origin[2] - 22.0;
	else if (r.state.refdef.vieworg[2] > (ent.origin[2] + 30.0))
		r.state.refdef.vieworg[2] = ent.origin[2] + 30.0;

	var view = cl.clState.viewent;
	view.angles[0] = -r.state.refdef.viewangles[0] - ipitch;
	view.angles[1] = r.state.refdef.viewangles[1] - iyaw;
	view.angles[2] = cl.clState.viewangles[2] - iroll;
	view.origin[0] = ent.origin[0] + forward[0] * bob * 0.4;
	view.origin[1] = ent.origin[1] + forward[1] * bob * 0.4;
	view.origin[2] = ent.origin[2] + cl.clState.viewheight + forward[2] * bob * 0.4 + bob;
	switch (scr.cvr.viewsize.value)
	{
	case 110:
	case 90:
		view.origin[2] += 1.0;
		break;
	case 100:
		view.origin[2] += 2.0;
		break;
	case 80:
		view.origin[2] += 0.5;
	}
	view.model = cl.clState.model_precache[cl.clState.stats[def.STAT.weapon]];
	view.frame = cl.clState.stats[def.STAT.weaponframe];

	r.state.refdef.viewangles[0] += cl.clState.punchangle[0];
	r.state.refdef.viewangles[1] += cl.clState.punchangle[1];
	r.state.refdef.viewangles[2] += cl.clState.punchangle[2];

	if ((cl.clState.onground === true) && ((ent.origin[2] - oldz) > 0.0))
	{
		var steptime = cl.clState.time - cl.clState.oldtime;
		if (steptime < 0.0)
			steptime = 0.0;
		oldz += steptime * 80.0;
		if (oldz > ent.origin[2])
			oldz = ent.origin[2];
		else if ((ent.origin[2] - oldz) > 12.0)
			oldz = ent.origin[2] - 12.0;
		r.state.refdef.vieworg[2] += oldz - ent.origin[2];
		view.origin[2] += oldz - ent.origin[2];
	}
	else
		oldz = ent.origin[2];
	if (chase.cvr.active.value !== 0)
		chase.update();
};

export const renderView = function()
{
	if (con.state.forcedup === true)
		return;
	if (cl.clState.maxclients >= 2)
	{
		cvar.set('scr_ofsx', '0');
		cvar.set('scr_ofsy', '0');
		cvar.set('scr_ofsz', '0');
	}
	if (cl.clState.intermission !== 0)
		calcIntermissionRefdef();
	else if (cl.clState.paused !== true)
		calcRefdef();
	r.pushDlights();
	r.renderView();
};

export const init = function()
{
	cmd.addCommand('v_cshift', cshift_f);
	cmd.addCommand('bf', bonusFlash_f);
	cmd.addCommand('centerview', startPitchDrift);
	cvr.centermove = cvar.registerVariable('v_centermove', '0.15');
	cvr.centerspeed = cvar.registerVariable('v_centerspeed', '500');
	cvr.iyaw_cycle = cvar.registerVariable('v_iyaw_cycle', '2');
	cvr.iroll_cycle = cvar.registerVariable('v_iroll_cycle', '0.5');
	cvr.ipitch_cycle = cvar.registerVariable('v_ipitch_cycle', '1');
	cvr.iyaw_level = cvar.registerVariable('v_iyaw_level', '0.3');
	cvr.iroll_level = cvar.registerVariable('v_iroll_level', '0.1');
	cvr.ipitch_level = cvar.registerVariable('v_ipitch_level', '0.3');
	cvr.idlescale = cvar.registerVariable('v_idlescale', '0');
	cvr.crosshair = cvar.registerVariable('crosshair', '0', true);
	cvr.crossx = cvar.registerVariable('cl_crossx', '0');
	cvr.crossy = cvar.registerVariable('cl_crossy', '0');
	cvr.cshiftpercent = cvar.registerVariable('gl_cshiftpercent', '100');
	cvr.ofsx = cvar.registerVariable('scr_ofsx', '0');
	cvr.ofsy = cvar.registerVariable('scr_ofsy', '0');
	cvr.ofsz = cvar.registerVariable('scr_ofsz', '0');
	cvr.rollspeed = cvar.registerVariable('cl_rollspeed', '200');
	cvr.rollangle = cvar.registerVariable('cl_rollangle', '2.0');
	cvr.bob = cvar.registerVariable('cl_bob', '0.02');
	cvr.bobcycle = cvar.registerVariable('cl_bobcycle', '0.6');
	cvr.bobup = cvar.registerVariable('cl_bobup', '0.5');
	cvr.kicktime = cvar.registerVariable('v_kicktime', '0.5');
	cvr.kickroll = cvar.registerVariable('v_kickroll', '0.6');
	cvr.kickpitch = cvar.registerVariable('v_kickpitch', '0.6');
	cvr.gamma = cvar.registerVariable('gamma', '1', true);
};