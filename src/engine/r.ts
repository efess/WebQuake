import * as cmd from './cmd'
import * as cvar from './cvar'
import * as GL from './GL'
import * as vec from './vec'
import * as cl from './cl'
import * as mod from './mod'
import * as chase from './chase'
import * as v from './v'
import * as scr from './scr'
import * as sys from './sys'
import * as con from './console'
import * as host from './host'
import * as com from './com'
import * as sv from './sv'
import * as pr from './pr'
import * as q from './q'
import * as vid from './vid'
import * as msg from './msg'
import * as def from './def'
import * as draw from './draw'
import * as s from './s'

export const state = {
	// efrag
	// light
	dlightframecount: 0,
	lightstylevalue: new Uint8Array(new ArrayBuffer(64))
} as any

export const cvr = {
} as any

// set on init
// let gl: any = null

// efrag

export const splitEntityOnNode = function(node)
{
	if (node.contents === mod.CONTENTS.solid)
		return;
	if (node.contents < 0)
	{
		state.currententity.leafs[state.currententity.leafs.length] = node.num - 1;
		return;
	}
	var sides = vec.boxOnPlaneSide(state.emins, state.emaxs, node.plane);
	if ((sides & 1) !== 0)
		splitEntityOnNode(node.children[0]);
	if ((sides & 2) !== 0)
		splitEntityOnNode(node.children[1]);
};

// light

export const animateLight = function()
{
  const gl = GL.getContext()
	var j;
	if (cvr.fullbright.value === 0)
	{
		var i = Math.floor(cl.clState.time * 10.0);
		for (j = 0; j < 64; ++j)
		{
			if (cl.state.lightstyle[j].length === 0)
			{
				state.lightstylevalue[j] = 12;
				continue;
			}
			state.lightstylevalue[j] = cl.state.lightstyle[j].charCodeAt(i % cl.state.lightstyle[j].length) - 97;
		}
	}
	else
	{
		for (j = 0; j < 64; ++j)
			state.lightstylevalue[j] = 12;
	}
	GL.bind(0, state.lightstyle_texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, 64, 1, 0, gl.ALPHA, gl.UNSIGNED_BYTE, state.lightstylevalue);
};

export const renderDlights = function()
{
  const gl = GL.getContext()
	if (cvr.flashblend.value === 0)
		return;
	++state.dlightframecount;
	gl.enable(gl.BLEND);
	var program = GL.useProgram('Dlight'), l, a;
	gl.bindBuffer(gl.ARRAY_BUFFER, state.dlightvecs);
	gl.vertexAttribPointer(program.aPosition.location, 3, gl.FLOAT, false, 0, 0);
	for (var i = 0; i <= 31; ++i)
	{
		l = cl.state.dlights[i];
		if ((l.die < cl.clState.time) || (l.radius === 0.0))
      continue;
		if (vec.length([l.origin[0] - state.refdef.vieworg[0], l.origin[1] - state.refdef.vieworg[1], l.origin[2] - state.refdef.vieworg[2]]) < (l.radius * 0.35))
		{
			a = l.radius * 0.0003;
			v.blend[3] += a * (1.0 - v.blend[3]);
			a /= v.blend[3];
			v.blend[0] = v.blend[1] * (1.0 - a) + (255.0 * a);
			v.blend[1] = v.blend[1] * (1.0 - a) + (127.5 * a);
			v.blend[2] *= 1.0 - a;
			continue;
		}
		gl.uniform3fv(program.uOrigin, l.origin);
		gl.uniform1f(program.uRadius, l.radius);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, 18);
	}
	gl.disable(gl.BLEND);
};

export const markLights = function(light, bit, node)
{
	if (node.contents < 0)
		return;
	var normal = node.plane.normal;
	var dist = light.origin[0] * normal[0] + light.origin[1] * normal[1] + light.origin[2] * normal[2] - node.plane.dist;
	if (dist > light.radius)
	{
		markLights(light, bit, node.children[0]);
		return;
	}
	if (dist < -light.radius)
	{
		markLights(light, bit, node.children[1]);
		return;
	}
	var i, surf;
	for (i = 0; i < node.numfaces; ++i)
	{
		surf = cl.clState.worldmodel.faces[node.firstface + i];
		if ((surf.sky === true) || (surf.turbulent === true))
			continue;
		if (surf.dlightframe !== (state.dlightframecount + 1))
		{
			surf.dlightbits = 0;
			surf.dlightframe = state.dlightframecount + 1;
		}
		surf.dlightbits += bit;
	}
	markLights(light, bit, node.children[0]);
	markLights(light, bit, node.children[1]);
};

export const pushDlights = function()
{
  const gl = GL.getContext()
	if (cvr.flashblend.value !== 0)
		return;
	var i;
	for (i = 0; i <= 1023; ++i)
		state.lightmap_modified[i] = false;

	var l, bit = 1, j, ent;
	for (i = 0; i <= 31; ++i)
	{
		l = cl.state.dlights[i];
		if ((l.die >= cl.clState.time) && (l.radius !== 0.0))
		{
			markLights(l, bit, cl.clState.worldmodel.nodes[0]);
			for (j = 0; j < cl.state.numvisedicts; ++j)
			{
				ent = cl.state.visedicts[j];
				if (ent.model == null)
					continue;
				if ((ent.model.type !== mod.TYPE.brush) || (ent.model.submodel !== true))
					continue;
				markLights(l, bit, cl.clState.worldmodel.nodes[ent.model.hulls[0].firstclipnode]);
			}
		}
		bit += bit;
	}

	var surf;
	for (i = 0; i < cl.clState.worldmodel.faces.length; ++i)
	{
		surf = cl.clState.worldmodel.faces[i];
		if (surf.dlightframe === state.dlightframecount)
			removeDynamicLights(surf);
		else if (surf.dlightframe === (state.dlightframecount + 1))
			addDynamicLights(surf);
	}

	GL.bind(0, state.dlightmap_texture);
	for (i = 0; i <= 1023; ++i)
	{
		if (state.lightmap_modified[i] !== true)
			continue;
		for (j = 1023; j >= i; --j)
		{
			if (state.lightmap_modified[j] !== true)
				continue;
			gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, i, 1024, j - i + 1, gl.ALPHA, gl.UNSIGNED_BYTE,
				state.dlightmaps.subarray(i << 10, (j + 1) << 10));
			break;
		}
		break;
	}

	++state.dlightframecount;
};

export const recursiveLightPoint = function(node, start, end)
{
	if (node.contents < 0)
		return -1;

	var normal = node.plane.normal;
	var front = start[0] * normal[0] + start[1] * normal[1] + start[2] * normal[2] - node.plane.dist;
	var back = end[0] * normal[0] + end[1] * normal[1] + end[2] * normal[2] - node.plane.dist;
	var side = front < 0;

	if ((back < 0) === side)
		return recursiveLightPoint(node.children[side === true ? 1 : 0], start, end);

	var frac = front / (front - back);
	var mid = [
		start[0] + (end[0] - start[0]) * frac,
		start[1] + (end[1] - start[1]) * frac,
		start[2] + (end[2] - start[2]) * frac
	];

	var r = recursiveLightPoint(node.children[side === true ? 1 : 0], start, mid);
	if (r >= 0)
		return r;

	if ((back < 0) === side)
		return -1;

	var i, surf, tex, s, t, ds, dt, lightmap, size, maps;
	for (i = 0; i < node.numfaces; ++i)
	{
		surf = cl.clState.worldmodel.faces[node.firstface + i];
		if ((surf.sky === true) || (surf.turbulent === true))
			continue;

		tex = cl.clState.worldmodel.texinfo[surf.texinfo];

		s = vec.dotProduct(mid, tex.vecs[0]) + tex.vecs[0][3];
		t = vec.dotProduct(mid, tex.vecs[1]) + tex.vecs[1][3];
		if ((s < surf.texturemins[0]) || (t < surf.texturemins[1]))
			continue;

		ds = s - surf.texturemins[0];
		dt = t - surf.texturemins[1];
		if ((ds > surf.extents[0]) || (dt > surf.extents[1]))
			continue;

		if (surf.lightofs === 0)
			return 0;

		ds >>= 4;
		dt >>= 4;

		lightmap = surf.lightofs;
		if (lightmap === 0)
			return 0;

		lightmap += dt * ((surf.extents[0] >> 4) + 1) + ds;
		r = 0;
		size = ((surf.extents[0] >> 4) + 1) * ((surf.extents[1] >> 4) + 1);
		for (maps = 0; maps < surf.styles.length; ++maps)
		{
			r += cl.clState.worldmodel.lightdata[lightmap] * state.lightstylevalue[surf.styles[maps]] * 22;
			lightmap += size;
		}
		return r >> 8;
	}
	return recursiveLightPoint(node.children[side !== true ? 1 : 0], mid, end);
};

export const lightPoint = function(p)
{
	if (cl.clState.worldmodel.lightdata == null)
		return 255;
	var r = recursiveLightPoint(cl.clState.worldmodel.nodes[0], p, [p[0], p[1], p[2] - 2048.0]);
	if (r === -1)
		return 0;
	return r;
};

// main

state.visframecount = 0;

state.frustum = [{}, {}, {}, {}];

state.vup = [];
state.vpn = [];
state.vright = [];

state.refdef = {
	vrect: {},
	vieworg: [0.0, 0.0, 0.0],
	viewangles: [0.0, 0.0, 0.0]
};

export const cullBox = function(mins, maxs)
{
	if (vec.boxOnPlaneSide(mins, maxs, state.frustum[0]) === 2)
		return true;
	if (vec.boxOnPlaneSide(mins, maxs, state.frustum[1]) === 2)
		return true;
	if (vec.boxOnPlaneSide(mins, maxs, state.frustum[2]) === 2)
		return true;
	if (vec.boxOnPlaneSide(mins, maxs, state.frustum[3]) === 2)
		return true;
};

export const drawSpriteModel = function(e)
{
	var program = GL.useProgram('Sprite', true);
	var num = e.frame;
	if ((num >= e.model.numframes) || (num < 0))
	{
		con.dPrint('R.DrawSpriteModel: no such frame ' + num + '\n');
		num = 0;
	}
	var frame = e.model.frames[num];
	if (frame.group === true)
	{
		var fullinterval, targettime, i, time = cl.clState.time + e.syncbase;
		num = frame.frames.length - 1;
		fullinterval = frame.frames[num].interval;
		targettime = time - Math.floor(time / fullinterval) * fullinterval;
		for (i = 0; i < num; ++i)
		{
			if (frame.frames[i].interval > targettime)
				break;
		}
		frame = frame.frames[i];
	}

	GL.bind(program.tTexture, frame.texturenum, true);
	var r = [], u = []
	if (e.model.oriented === true)
	{
		vec.angleVectors(e.angles, null, r, u);
	}
	else
	{
		r = state.vright;
		u = state.vup;
	}
	var p = e.origin;
	var x1 = frame.origin[0], y1 = frame.origin[1], x2 = x1 + frame.width, y2 = y1 + frame.height;

	GL.streamGetSpace(6);
	GL.streamWriteFloat3(
		p[0] + x1 * r[0] + y1 * u[0],
		p[1] + x1 * r[1] + y1 * u[1],
		p[2] + x1 * r[2] + y1 * u[2]);
	GL.streamWriteFloat2(0.0, 1.0);
	GL.streamWriteFloat3(
		p[0] + x1 * r[0] + y2 * u[0],
		p[1] + x1 * r[1] + y2 * u[1],
		p[2] + x1 * r[2] + y2 * u[2]);
	GL.streamWriteFloat2(0.0, 0.0);
	GL.streamWriteFloat3(
		p[0] + x2 * r[0] + y1 * u[0],
		p[1] + x2 * r[1] + y1 * u[1],
		p[2] + x2 * r[2] + y1 * u[2]);
	GL.streamWriteFloat2(1.0, 1.0);
	GL.streamWriteFloat3(
		p[0] + x2 * r[0] + y1 * u[0],
		p[1] + x2 * r[1] + y1 * u[1],
		p[2] + x2 * r[2] + y1 * u[2]);
	GL.streamWriteFloat2(1.0, 1.0);
	GL.streamWriteFloat3(
		p[0] + x1 * r[0] + y2 * u[0],
		p[1] + x1 * r[1] + y2 * u[1],
		p[2] + x1 * r[2] + y2 * u[2]);
	GL.streamWriteFloat2(0.0, 0.0);
	GL.streamWriteFloat3(
		p[0] + x2 * r[0] + y2 * u[0],
		p[1] + x2 * r[1] + y2 * u[1],
		p[2] + x2 * r[2] + y2 * u[2]);
	GL.streamWriteFloat2(1.0, 0.0);
};

state.avertexnormals = [
	[-0.525731, 0.0, 0.850651],
	[-0.442863, 0.238856, 0.864188],
	[-0.295242, 0.0, 0.955423],
	[-0.309017, 0.5, 0.809017],
	[-0.16246, 0.262866, 0.951056],
	[0.0, 0.0, 1.0],
	[0.0, 0.850651, 0.525731],
	[-0.147621, 0.716567, 0.681718],
	[0.147621, 0.716567, 0.681718],
	[0.0, 0.525731, 0.850651],
	[0.309017, 0.5, 0.809017],
	[0.525731, 0.0, 0.850651],
	[0.295242, 0.0, 0.955423],
	[0.442863, 0.238856, 0.864188],
	[0.16246, 0.262866, 0.951056],
	[-0.681718, 0.147621, 0.716567],
	[-0.809017, 0.309017, 0.5],
	[-0.587785, 0.425325, 0.688191],
	[-0.850651, 0.525731, 0.0],
	[-0.864188, 0.442863, 0.238856],
	[-0.716567, 0.681718, 0.147621],
	[-0.688191, 0.587785, 0.425325],
	[-0.5, 0.809017, 0.309017],
	[-0.238856, 0.864188, 0.442863],
	[-0.425325, 0.688191, 0.587785],
	[-0.716567, 0.681718, -0.147621],
	[-0.5, 0.809017, -0.309017],
	[-0.525731, 0.850651, 0.0],
	[0.0, 0.850651, -0.525731],
	[-0.238856, 0.864188, -0.442863],
	[0.0, 0.955423, -0.295242],
	[-0.262866, 0.951056, -0.16246],
	[0.0, 1.0, 0.0],
	[0.0, 0.955423, 0.295242],
	[-0.262866, 0.951056, 0.16246],
	[0.238856, 0.864188, 0.442863],
	[0.262866, 0.951056, 0.16246],
	[0.5, 0.809017, 0.309017],
	[0.238856, 0.864188, -0.442863],
	[0.262866, 0.951056, -0.16246],
	[0.5, 0.809017, -0.309017],
	[0.850651, 0.525731, 0.0],
	[0.716567, 0.681718, 0.147621],
	[0.716567, 0.681718, -0.147621],
	[0.525731, 0.850651, 0.0],
	[0.425325, 0.688191, 0.587785],
	[0.864188, 0.442863, 0.238856],
	[0.688191, 0.587785, 0.425325],
	[0.809017, 0.309017, 0.5],
	[0.681718, 0.147621, 0.716567],
	[0.587785, 0.425325, 0.688191],
	[0.955423, 0.295242, 0.0],
	[1.0, 0.0, 0.0],
	[0.951056, 0.16246, 0.262866],
	[0.850651, -0.525731, 0.0],
	[0.955423, -0.295242, 0.0],
	[0.864188, -0.442863, 0.238856],
	[0.951056, -0.16246, 0.262866],
	[0.809017, -0.309017, 0.5],
	[0.681718, -0.147621, 0.716567],
	[0.850651, 0.0, 0.525731],
	[0.864188, 0.442863, -0.238856],
	[0.809017, 0.309017, -0.5],
	[0.951056, 0.16246, -0.262866],
	[0.525731, 0.0, -0.850651],
	[0.681718, 0.147621, -0.716567],
	[0.681718, -0.147621, -0.716567],
	[0.850651, 0.0, -0.525731],
	[0.809017, -0.309017, -0.5],
	[0.864188, -0.442863, -0.238856],
	[0.951056, -0.16246, -0.262866],
	[0.147621, 0.716567, -0.681718],
	[0.309017, 0.5, -0.809017],
	[0.425325, 0.688191, -0.587785],
	[0.442863, 0.238856, -0.864188],
	[0.587785, 0.425325, -0.688191],
	[0.688191, 0.587785, -0.425325],
	[-0.147621, 0.716567, -0.681718],
	[-0.309017, 0.5, -0.809017],
	[0.0, 0.525731, -0.850651],
	[-0.525731, 0.0, -0.850651],
	[-0.442863, 0.238856, -0.864188],
	[-0.295242, 0.0, -0.955423],
	[-0.16246, 0.262866, -0.951056],
	[0.0, 0.0, -1.0],
	[0.295242, 0.0, -0.955423],
	[0.16246, 0.262866, -0.951056],
	[-0.442863, -0.238856, -0.864188],
	[-0.309017, -0.5, -0.809017],
	[-0.16246, -0.262866, -0.951056],
	[0.0, -0.850651, -0.525731],
	[-0.147621, -0.716567, -0.681718],
	[0.147621, -0.716567, -0.681718],
	[0.0, -0.525731, -0.850651],
	[0.309017, -0.5, -0.809017],
	[0.442863, -0.238856, -0.864188],
	[0.16246, -0.262866, -0.951056],
	[0.238856, -0.864188, -0.442863],
	[0.5, -0.809017, -0.309017],
	[0.425325, -0.688191, -0.587785],
	[0.716567, -0.681718, -0.147621],
	[0.688191, -0.587785, -0.425325],
	[0.587785, -0.425325, -0.688191],
	[0.0, -0.955423, -0.295242],
	[0.0, -1.0, 0.0],
	[0.262866, -0.951056, -0.16246],
	[0.0, -0.850651, 0.525731],
	[0.0, -0.955423, 0.295242],
	[0.238856, -0.864188, 0.442863],
	[0.262866, -0.951056, 0.16246],
	[0.5, -0.809017, 0.309017],
	[0.716567, -0.681718, 0.147621],
	[0.525731, -0.850651, 0.0],
	[-0.238856, -0.864188, -0.442863],
	[-0.5, -0.809017, -0.309017],
	[-0.262866, -0.951056, -0.16246],
	[-0.850651, -0.525731, 0.0],
	[-0.716567, -0.681718, -0.147621],
	[-0.716567, -0.681718, 0.147621],
	[-0.525731, -0.850651, 0.0],
	[-0.5, -0.809017, 0.309017],
	[-0.238856, -0.864188, 0.442863],
	[-0.262866, -0.951056, 0.16246],
	[-0.864188, -0.442863, 0.238856],
	[-0.809017, -0.309017, 0.5],
	[-0.688191, -0.587785, 0.425325],
	[-0.681718, -0.147621, 0.716567],
	[-0.442863, -0.238856, 0.864188],
	[-0.587785, -0.425325, 0.688191],
	[-0.309017, -0.5, 0.809017],
	[-0.147621, -0.716567, 0.681718],
	[-0.425325, -0.688191, 0.587785],
	[-0.16246, -0.262866, 0.951056],
	[0.442863, -0.238856, 0.864188],
	[0.16246, -0.262866, 0.951056],
	[0.309017, -0.5, 0.809017],
	[0.147621, -0.716567, 0.681718],
	[0.0, -0.525731, 0.850651],
	[0.425325, -0.688191, 0.587785],
	[0.587785, -0.425325, 0.688191],
	[0.688191, -0.587785, 0.425325],
	[-0.955423, 0.295242, 0.0],
	[-0.951056, 0.16246, 0.262866],
	[-1.0, 0.0, 0.0],
	[-0.850651, 0.0, 0.525731],
	[-0.955423, -0.295242, 0.0],
	[-0.951056, -0.16246, 0.262866],
	[-0.864188, 0.442863, -0.238856],
	[-0.951056, 0.16246, -0.262866],
	[-0.809017, 0.309017, -0.5],
	[-0.864188, -0.442863, -0.238856],
	[-0.951056, -0.16246, -0.262866],
	[-0.809017, -0.309017, -0.5],
	[-0.681718, 0.147621, -0.716567],
	[-0.681718, -0.147621, -0.716567],
	[-0.850651, 0.0, -0.525731],
	[-0.688191, 0.587785, -0.425325],
	[-0.587785, 0.425325, -0.688191],
	[-0.425325, 0.688191, -0.587785],
	[-0.425325, -0.688191, -0.587785],
	[-0.587785, -0.425325, -0.688191],
	[-0.688191, -0.587785, -0.425325]
];

export const drawAliasModel = function(e)
{
  const gl = GL.getContext()
	var clmodel = e.model;

	if (cullBox(
		[
			e.origin[0] - clmodel.boundingradius,
			e.origin[1] - clmodel.boundingradius,
			e.origin[2] - clmodel.boundingradius
		],
		[
			e.origin[0] + clmodel.boundingradius,
			e.origin[1] + clmodel.boundingradius,
			e.origin[2] + clmodel.boundingradius
		]) === true)
		return;

	var program;
	if ((e.colormap !== 0) && (clmodel.player === true) && (cvr.nocolors.value === 0))
	{
		program = GL.useProgram('Player');
		var top = (cl.clState.scores[e.colormap - 1].colors & 0xf0) + 4;
		var bottom = ((cl.clState.scores[e.colormap - 1].colors & 0xf) << 4) + 4;
		if (top <= 127)
			top += 7;
		if (bottom <= 127)
			bottom += 7;
		top = vid.d_8to24table[top];
		bottom = vid.d_8to24table[bottom];
		gl.uniform3f(program.uTop, top & 0xff, (top >> 8) & 0xff, top >> 16);
		gl.uniform3f(program.uBottom, bottom & 0xff, (bottom >> 8) & 0xff, bottom >> 16);
	}
	else
		program = GL.useProgram('Alias');
	gl.uniform3fv(program.uOrigin, e.origin);
	gl.uniformMatrix3fv(program.uAngles, false, GL.rotationMatrix(e.angles[0], e.angles[1], e.angles[2]));

	var ambientlight = lightPoint(e.origin);
	var shadelight = ambientlight;
	if ((e === cl.clState.viewent) && (ambientlight < 24.0))
		ambientlight = shadelight = 24.0;
	var i, dl, add;
	for (i = 0; i <= 31; ++i)
	{
		dl = cl.state.dlights[i];
		if (dl.die < cl.clState.time)
			continue;
		add = dl.radius - vec.length([e.origin[0] - dl.origin[0], e.origin[1] - dl.origin[1], e.origin[1] - dl.origin[1]]);
		if (add > 0.0)
		{
			ambientlight += add;
			shadelight += add;
		}
	}
	if (ambientlight > 128.0)
		ambientlight = 128.0;
	if ((ambientlight + shadelight) > 192.0)
		shadelight = 192.0 - ambientlight;
	if ((e.num >= 1) && (e.num <= cl.clState.maxclients) && (ambientlight < 8.0))
		ambientlight = shadelight = 8.0;
	gl.uniform1f(program.uAmbientLight, ambientlight * 0.0078125);
	gl.uniform1f(program.uShadeLight, shadelight * 0.0078125);

	var forward = [], right = [], up = [];
	vec.angleVectors(e.angles, forward, right, up);
	gl.uniform3fv(program.uLightVec, [
		vec.dotProduct([-1.0, 0.0, 0.0], forward),
		-vec.dotProduct([-1.0, 0.0, 0.0], right),
		vec.dotProduct([-1.0, 0.0, 0.0], up)
	]);

	state.c_alias_polys += clmodel.numtris;

	var num, fullinterval, targettime, i;
	var time = cl.clState.time + e.syncbase;
	num = e.frame;
	if ((num >= clmodel.numframes) || (num < 0))
	{
		con.dPrint('R.DrawAliasModel: no such frame ' + num + '\n');
		num = 0;
	}
	var frame = clmodel.frames[num];
	if (frame.group === true)
	{	
		num = frame.frames.length - 1;
		fullinterval = frame.frames[num].interval;
		targettime = time - Math.floor(time / fullinterval) * fullinterval;
		for (i = 0; i < num; ++i)
		{
			if (frame.frames[i].interval > targettime)
				break;
		}
		frame = frame.frames[i];
	}
	gl.bindBuffer(gl.ARRAY_BUFFER, clmodel.cmds);
	gl.vertexAttribPointer(program.aPosition.location, 3, gl.FLOAT, false, 24, frame.cmdofs);
	gl.vertexAttribPointer(program.aNormal.location, 3, gl.FLOAT, false, 24, frame.cmdofs + 12);
	gl.vertexAttribPointer(program.aTexCoord.location, 2, gl.FLOAT, false, 0, 0);

	num = e.skinnum;
	if ((num >= clmodel.numskins) || (num < 0))
	{
		con.dPrint('R.DrawAliasModel: no such skin # ' + num + '\n');
		num = 0;
	}
	var skin = clmodel.skins[num];
	if (skin.group === true)
	{	
		num = skin.skins.length - 1;
		fullinterval = skin.skins[num].interval;
		targettime = time - Math.floor(time / fullinterval) * fullinterval;
		for (i = 0; i < num; ++i)
		{
			if (skin.skins[i].interval > targettime)
				break;
		}
		skin = skin.skins[i];
	}
	GL.bind(program.tTexture, skin.texturenum.texnum);
	if (clmodel.player === true)
		GL.bind(program.tPlayer, skin.playertexture);

	gl.drawArrays(gl.TRIANGLES, 0, clmodel.numtris * 3);
};

export const drawEntitiesOnList = function()
{
  const gl = GL.getContext()
	if (cvr.drawentities.value === 0)
		return;
	var vis = (cvr.novis.value !== 0) ? mod.novis : mod.leafPVS(state.viewleaf, cl.clState.worldmodel);
	var i, j, leaf;
	for (i = 0; i < cl.clState.num_statics; ++i)
	{
		state.currententity = cl.state.static_entities[i];
		if (state.currententity.model == null)
			continue;
		for (j = 0; j < state.currententity.leafs.length; ++j)
		{
			leaf = state.currententity.leafs[j];
			if ((leaf < 0) || ((vis[leaf >> 3] & (1 << (leaf & 7))) !== 0))
				break;
		}
		if (j === state.currententity.leafs.length)
			continue;
		switch (state.currententity.model.type)
		{
		case mod.TYPE.alias:
			drawAliasModel(state.currententity);
			continue;
		case mod.TYPE.brush:
			drawBrushModel(state.currententity);
		}
	}
	for (i = 0; i < cl.state.numvisedicts; ++i)
	{
		state.currententity = cl.state.visedicts[i];
		if (state.currententity.model == null)
			continue;
		switch (state.currententity.model.type)
		{
		case mod.TYPE.alias:
			drawAliasModel(state.currententity);
			continue;
		case mod.TYPE.brush:
			drawBrushModel(state.currententity);
		}
	}
	GL.streamFlush();
	gl.depthMask(false);
	gl.enable(gl.BLEND);
	for (i = 0; i < cl.clState.num_statics; ++i)
	{
		state.currententity = cl.state.static_entities[i];
		if (state.currententity.model == null)
			continue;
		if (state.currententity.model.type === mod.TYPE.sprite)
			drawSpriteModel(state.currententity);
	}
	for (i = 0; i < cl.state.numvisedicts; ++i)
	{
		state.currententity = cl.state.visedicts[i];
		if (state.currententity.model == null)
			continue;
		if (state.currententity.model.type === mod.TYPE.sprite)
			drawSpriteModel(state.currententity);
	}
	GL.streamFlush();
	gl.disable(gl.BLEND);
	gl.depthMask(true);
};

export const drawViewModel = function()
{
  const gl = GL.getContext()
	if (cvr.drawviewmodel.value === 0)
		return;
	if (chase.cvr.active.value !== 0)
		return;
	if (cvr.drawentities.value === 0)
		return;
	if ((cl.clState.items & def.IT.invisibility) !== 0)
		return;
	if (cl.clState.stats[def.STAT.health] <= 0)
		return;
	if (cl.clState.viewent.model == null)
		return;

	gl.depthRange(0.0, 0.3);

	var ymax = 4.0 * Math.tan(scr.cvr.fov.value * 0.82 * Math.PI / 360.0);
	state.perspective[0] = 4.0 / (ymax * state.refdef.vrect.width / state.refdef.vrect.height);
	state.perspective[5] = 4.0 / ymax;
	var program = GL.useProgram('Alias');
	gl.uniformMatrix4fv(program.uPerspective, false, state.perspective);

	drawAliasModel(cl.clState.viewent);

	ymax = 4.0 * Math.tan(state.refdef.fov_y * Math.PI / 360.0);
	state.perspective[0] = 4.0 / (ymax * state.refdef.vrect.width / state.refdef.vrect.height);
	state.perspective[5] = 4.0 / ymax;
	program = GL.useProgram('Alias');
	gl.uniformMatrix4fv(program.uPerspective, false, state.perspective);

	gl.depthRange(0.0, 1.0);
};

export const polyBlend = function()
{
	if (cvr.polyblend.value === 0)
		return;
	if (v.blend[3] === 0.0)
		return;
	GL.useProgram('Fill', true);
	var vrect = state.refdef.vrect;
	GL.streamDrawColoredQuad(vrect.x, vrect.y, vrect.width, vrect.height,
		v.blend[0], v.blend[1], v.blend[2], v.blend[3] * 255.0);
};

export const setFrustum = function()
{
	state.frustum[0].normal = vec.rotatePointAroundVector(state.vup, state.vpn, -(90.0 - state.refdef.fov_x * 0.5));
	state.frustum[1].normal = vec.rotatePointAroundVector(state.vup, state.vpn, 90.0 - state.refdef.fov_x * 0.5);
	state.frustum[2].normal = vec.rotatePointAroundVector(state.vright, state.vpn, 90.0 - state.refdef.fov_y * 0.5);
	state.frustum[3].normal = vec.rotatePointAroundVector(state.vright, state.vpn, -(90.0 - state.refdef.fov_y * 0.5));
	var i, out;
	for (i = 0; i <= 3; ++i)
	{
		out = state.frustum[i];
		out.type = 5;
		out.dist = vec.dotProduct(state.refdef.vieworg, out.normal);
		out.signbits = 0;
		if (out.normal[0] < 0.0)
			out.signbits = 1;
		if (out.normal[1] < 0.0)
			out.signbits += 2;
		if (out.normal[2] < 0.0)
			out.signbits += 4;
		if (out.normal[3] < 0.0)
			out.signbits += 8;
	}
};

state.perspective = [
	0.0, 0.0, 0.0, 0.0,
	0.0, 0.0, 0.0, 0.0,
	0.0, 0.0, -65540.0 / 65532.0, -1.0,
	0.0, 0.0, -524288.0 / 65532.0, 0.0
];

export const perspective = function()
{
  const gl = GL.getContext()
	var viewangles = [
		state.refdef.viewangles[0] * Math.PI / 180.0,
		(state.refdef.viewangles[1] - 90.0) * Math.PI / -180.0,
		state.refdef.viewangles[2] * Math.PI / -180.0
	];
	var sp = Math.sin(viewangles[0]);
	var cp = Math.cos(viewangles[0]);
	var sy = Math.sin(viewangles[1]);
	var cy = Math.cos(viewangles[1]);
	var sr = Math.sin(viewangles[2]);
	var cr = Math.cos(viewangles[2]);
	var viewMatrix = [
		cr * cy + sr * sp * sy,		cp * sy,	-sr * cy + cr * sp * sy,
		cr * -sy + sr * sp * cy,	cp * cy,	-sr * -sy + cr * sp * cy,
		sr * cp,					-sp,		cr * cp
	];

	if (v.cvr.gamma.value < 0.5)
		cvar.setValue('gamma', 0.5);
	else if (v.cvr.gamma.value > 1.0)
		cvar.setValue('gamma', 1.0);

	GL.unbindProgram();
  var i, program;
	for (i = 0; i < GL.state.programs.length; ++i)
	{
		program = GL.state.programs[i];
		gl.useProgram(program.program);
		if (program.uViewOrigin != null)
			gl.uniform3fv(program.uViewOrigin, state.refdef.vieworg);
		if (program.uViewAngles != null)
			gl.uniformMatrix3fv(program.uViewAngles, false, viewMatrix);
		if (program.uPerspective != null)
			gl.uniformMatrix4fv(program.uPerspective, false, state.perspective);
		if (program.uGamma != null)
			gl.uniform1f(program.uGamma, v.cvr.gamma.value);
	}
};

export const setupGL = function()
{
  const gl = GL.getContext()
	if (state.dowarp === true)
	{
		gl.bindFramebuffer(gl.FRAMEBUFFER, state.warpbuffer);
		gl.clear(gl.COLOR_BUFFER_BIT + gl.DEPTH_BUFFER_BIT);
		gl.viewport(0, 0, state.warpwidth, state.warpheight);
	}
	else
	{
		var vrect = state.refdef.vrect;
		var pixelRatio = scr.state.devicePixelRatio;
		gl.viewport((vrect.x * pixelRatio) >> 0, ((vid.state.height - vrect.height - vrect.y) * pixelRatio) >> 0, (vrect.width * pixelRatio) >> 0, (vrect.height * pixelRatio) >> 0);
	}
	perspective();
	gl.enable(gl.DEPTH_TEST);
};

export const renderScene = function()
{
  const gl = GL.getContext()
	if (cl.clState.maxclients >= 2)
		cvar.set('r_fullbright', '0');
	animateLight();
	vec.angleVectors(state.refdef.viewangles, state.vpn, state.vright, state.vup);
	state.viewleaf = mod.pointInLeaf(state.refdef.vieworg, cl.clState.worldmodel);
	v.setContentsColor(state.viewleaf.contents);
	v.calcBlend();
	state.dowarp = (cvr.waterwarp.value !== 0) && (state.viewleaf.contents <= mod.CONTENTS.water);

	setFrustum();
	setupGL();
	markLeaves();
	gl.enable(gl.CULL_FACE);
	drawSkyBox();
	drawViewModel();
	drawWorld();
	drawEntitiesOnList();
	gl.disable(gl.CULL_FACE);
	renderDlights();
	drawParticles();
};

export const renderView = function()
{
  const gl = GL.getContext()
	gl.finish();
	var time1;
	if (cvr.speeds.value !== 0)
		time1 = sys.floatTime();
	state.c_brush_verts = 0;
	state.c_alias_polys = 0;
	gl.clear(gl.COLOR_BUFFER_BIT + gl.DEPTH_BUFFER_BIT);
	renderScene();
	if (cvr.speeds.value !== 0)
	{
		var time2 = Math.floor((sys.floatTime() - time1) * 1000.0);
		var c_brush_polys = state.c_brush_verts / 3;
		var c_alias_polys = state.c_alias_polys;
		var message = ((time2 >= 100) ? '' : ((time2 >= 10) ? ' ' : '  ')) + time2 + ' ms  ';
		message += ((c_brush_polys >= 1000) ? '' : ((c_brush_polys >= 100) ? ' ' : ((c_brush_polys >= 10) ? '  ' : '   '))) + c_brush_polys + ' wpoly ';
		message += ((c_alias_polys >= 1000) ? '' : ((c_alias_polys >= 100) ? ' ' : ((c_alias_polys >= 10) ? '  ' : '   '))) + c_alias_polys + ' epoly\n';
		con.print(message);
	}
};

// mesh

export const makeBrushModelDisplayLists = function(m)
{
  const gl = GL.getContext()
	if (m.cmds != null)
		gl.deleteBuffer(m.cmds);
	var i, j, k;
	var cmds = [];
	var texture, chain, leaf, surf, vert, styles = [0.0, 0.0, 0.0, 0.0];
	var verts = 0;
	m.chains = [];
	for (i = 0; i < m.textures.length; ++i)
	{
		texture = m.textures[i];
		if ((texture.sky === true) || (texture.turbulent === true))
			continue;
		chain = [i, verts, 0];
		for (j = 0; j < m.numfaces; ++j)
		{
			surf = m.faces[m.firstface + j];
			if (surf.texture !== i)
				continue;
			styles[0] = styles[1] = styles[2] = styles[3] = 0.0;
			switch (surf.styles.length)
			{
			case 4:
				styles[3] = surf.styles[3] * 0.015625 + 0.0078125;
			case 3:
				styles[2] = surf.styles[2] * 0.015625 + 0.0078125;
			case 2:
				styles[1] = surf.styles[1] * 0.015625 + 0.0078125;
			case 1:
				styles[0] = surf.styles[0] * 0.015625 + 0.0078125;
			}
			chain[2] += surf.verts.length;
			for (k = 0; k < surf.verts.length; ++k)
			{
				vert = surf.verts[k];
				cmds[cmds.length] = vert[0];
				cmds[cmds.length] = vert[1];
				cmds[cmds.length] = vert[2];
				cmds[cmds.length] = vert[3];
				cmds[cmds.length] = vert[4];
				cmds[cmds.length] = vert[5];
				cmds[cmds.length] = vert[6];
				cmds[cmds.length] = styles[0];
				cmds[cmds.length] = styles[1];
				cmds[cmds.length] = styles[2];
				cmds[cmds.length] = styles[3];
			}
		}
		if (chain[2] !== 0)
		{
			m.chains[m.chains.length] = chain;
			verts += chain[2];
		}
	}
	m.waterchain = verts * 44;
	verts = 0;
	for (i = 0; i < m.textures.length; ++i)
	{
		texture = m.textures[i];
		if (texture.turbulent !== true)
			continue;
		chain = [i, verts, 0];
		for (j = 0; j < m.numfaces; ++j)
		{
			surf = m.faces[m.firstface + j];
			if (surf.texture !== i)
				continue;
			chain[2] += surf.verts.length;
			for (k = 0; k < surf.verts.length; ++k)
			{
				vert = surf.verts[k];
				cmds[cmds.length] = vert[0];
				cmds[cmds.length] = vert[1];
				cmds[cmds.length] = vert[2];
				cmds[cmds.length] = vert[3];
				cmds[cmds.length] = vert[4];
			}
		}
		if (chain[2] !== 0)
		{
			m.chains[m.chains.length] = chain;
			verts += chain[2];
		}
	}
	m.cmds = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, m.cmds);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cmds), gl.STATIC_DRAW);
};

export const makeWorldModelDisplayLists = function(m)
{
	if (m.cmds != null)
		return;
  const gl = GL.getContext()
	var i, j, k, l;
	var cmds = [];
	var texture, leaf, chain, surf, vert, styles = [0.0, 0.0, 0.0, 0.0];
	var verts = 0;
	for (i = 0; i < m.textures.length; ++i)
	{
		texture = m.textures[i];
		if ((texture.sky === true) || (texture.turbulent === true))
			continue;
		for (j = 0; j < m.leafs.length; ++j)
		{
			leaf = m.leafs[j];
			chain = [i, verts, 0];
			for (k = 0; k < leaf.nummarksurfaces; ++k)
			{
				surf = m.faces[m.marksurfaces[leaf.firstmarksurface + k]];
				if (surf.texture !== i)
					continue;
				styles[0] = styles[1] = styles[2] = styles[3] = 0.0;
				switch (surf.styles.length)
				{
				case 4:
					styles[3] = surf.styles[3] * 0.015625 + 0.0078125;
				case 3:
					styles[2] = surf.styles[2] * 0.015625 + 0.0078125;
				case 2:
					styles[1] = surf.styles[1] * 0.015625 + 0.0078125;
				case 1:
					styles[0] = surf.styles[0] * 0.015625 + 0.0078125;
				}
				chain[2] += surf.verts.length;
				for (l = 0; l < surf.verts.length; ++l)
				{
					vert = surf.verts[l];
					cmds[cmds.length] = vert[0];
					cmds[cmds.length] = vert[1];
					cmds[cmds.length] = vert[2];
					cmds[cmds.length] = vert[3];
					cmds[cmds.length] = vert[4];
					cmds[cmds.length] = vert[5];
					cmds[cmds.length] = vert[6];
					cmds[cmds.length] = styles[0];
					cmds[cmds.length] = styles[1];
					cmds[cmds.length] = styles[2];
					cmds[cmds.length] = styles[3];
				}
			}
			if (chain[2] !== 0)
			{
				leaf.cmds[leaf.cmds.length] = chain;
				++leaf.skychain;
				++leaf.waterchain;
				verts += chain[2];
			}
		}
	}
	m.skychain = verts * 44;
	verts = 0;
	for (i = 0; i < m.textures.length; ++i)
	{
		texture = m.textures[i];
		if (texture.sky !== true)
			continue;
		for (j = 0; j < m.leafs.length; ++j)
		{
			leaf = m.leafs[j];
			chain = [verts, 0];
			for (k = 0; k < leaf.nummarksurfaces; ++k)
			{
				surf = m.faces[m.marksurfaces[leaf.firstmarksurface + k]];
				if (surf.texture !== i)
					continue;
				chain[1] += surf.verts.length;
				for (l = 0; l < surf.verts.length; ++l)
				{
					vert = surf.verts[l];
					cmds[cmds.length] = vert[0];
					cmds[cmds.length] = vert[1];
					cmds[cmds.length] = vert[2];
				}
			}
			if (chain[1] !== 0)
			{
				leaf.cmds[leaf.cmds.length] = chain;
				++leaf.waterchain;
				verts += chain[1];
			}
		}
	}
	m.waterchain = m.skychain + verts * 12;
	verts = 0;
	for (i = 0; i < m.textures.length; ++i)
	{
		texture = m.textures[i];
		if (texture.turbulent !== true)
			continue;
		for (j = 0; j < m.leafs.length; ++j)
		{
			leaf = m.leafs[j];
			chain = [i, verts, 0];
			for (k = 0; k < leaf.nummarksurfaces; ++k)
			{
				surf = m.faces[m.marksurfaces[leaf.firstmarksurface + k]];
				if (surf.texture !== i)
					continue;
				chain[2] += surf.verts.length;
				for (l = 0; l < surf.verts.length; ++l)
				{
					vert = surf.verts[l];
					cmds[cmds.length] = vert[0];
					cmds[cmds.length] = vert[1];
					cmds[cmds.length] = vert[2];
					cmds[cmds.length] = vert[3];
					cmds[cmds.length] = vert[4];
				}
			}
			if (chain[2] !== 0)
			{
				leaf.cmds[leaf.cmds.length] = chain;
				verts += chain[2];
			}
		}
	}
	m.cmds = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, m.cmds);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cmds), gl.STATIC_DRAW);
};

// misc

export const initTextures = function()
{
  const gl = GL.getContext()
	var data = new Uint8Array(new ArrayBuffer(256));
	var i, j;
	for (i = 0; i < 8; ++i)
	{
		for (j = 0; j < 8; ++j)
		{
			data[(i << 4) + j] = data[136 + (i << 4) + j] = 255;
			data[8 + (i << 4) + j] = data[128 + (i << 4) + j] = 0;
		}
	}
	state.notexture_mip = {name: 'notexture', width: 16, height: 16, texturenum: gl.createTexture()};
	GL.bind(0, state.notexture_mip.texturenum);
	GL.upload(data, 16, 16);

	state.solidskytexture = gl.createTexture();
	GL.bind(0, state.solidskytexture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	state.alphaskytexture = gl.createTexture();
	GL.bind(0, state.alphaskytexture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	state.lightmap_texture = gl.createTexture();
	GL.bind(0, state.lightmap_texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	state.dlightmap_texture = gl.createTexture();
	GL.bind(0, state.dlightmap_texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	state.lightstyle_texture = gl.createTexture();
	GL.bind(0, state.lightstyle_texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

	state.fullbright_texture = gl.createTexture();
	GL.bind(0, state.fullbright_texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 0, 0]));
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

	state.null_texture = gl.createTexture();
	GL.bind(0, state.null_texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
};

export const init = function()
{
  const gl = GL.getContext()
	initTextures();

	cmd.addCommand('timerefresh', timeRefresh_f);
	cmd.addCommand('pointfile', readPointFile_f);

	cvr.waterwarp = cvar.registerVariable('r_waterwarp', '1');
	cvr.fullbright = cvar.registerVariable('r_fullbright', '0');
	cvr.drawentities = cvar.registerVariable('r_drawentities', '1');
	cvr.drawviewmodel = cvar.registerVariable('r_drawviewmodel', '1');
	cvr.novis = cvar.registerVariable('r_novis', '0');
	cvr.speeds = cvar.registerVariable('r_speeds', '0');
	cvr.polyblend = cvar.registerVariable('gl_polyblend', '1');
	cvr.flashblend = cvar.registerVariable('gl_flashblend', '0');
	cvr.nocolors = cvar.registerVariable('gl_nocolors', '0');

	initParticles();

	GL.createProgram('Alias',
		['uOrigin', 'uAngles', 'uViewOrigin', 'uViewAngles', 'uPerspective', 'uLightVec', 'uGamma', 'uAmbientLight', 'uShadeLight'],
		[['aPosition', gl.FLOAT, 3], ['aNormal', gl.FLOAT, 3], ['aTexCoord', gl.FLOAT, 2]],
		['tTexture']);
	GL.createProgram('Brush',
		['uOrigin', 'uAngles', 'uViewOrigin', 'uViewAngles', 'uPerspective', 'uGamma'],
		[['aPosition', gl.FLOAT, 3], ['aTexCoord', gl.FLOAT, 4], ['aLightStyle', gl.FLOAT, 4]],
		['tTexture', 'tLightmap', 'tDlight', 'tLightStyle']);
	GL.createProgram('Dlight',
		['uOrigin', 'uViewOrigin', 'uViewAngles', 'uPerspective', 'uRadius', 'uGamma'],
		[['aPosition', gl.FLOAT, 3]],
		[]);
	GL.createProgram('Player',
		['uOrigin', 'uAngles', 'uViewOrigin', 'uViewAngles', 'uPerspective', 'uLightVec', 'uGamma', 'uAmbientLight', 'uShadeLight', 'uTop', 'uBottom'],
		[['aPosition', gl.FLOAT, 3], ['aNormal', gl.FLOAT, 3], ['aTexCoord', gl.FLOAT, 2]],
		['tTexture', 'tPlayer']);
	GL.createProgram('Sprite',
		['uViewOrigin', 'uViewAngles', 'uPerspective', 'uGamma'],
		[['aPosition', gl.FLOAT, 3], ['aTexCoord', gl.FLOAT, 2]],
		['tTexture']);
	GL.createProgram('Turbulent',
		['uOrigin', 'uAngles', 'uViewOrigin', 'uViewAngles', 'uPerspective', 'uGamma', 'uTime'],
		[['aPosition', gl.FLOAT, 3], ['aTexCoord', gl.FLOAT, 2]],
		['tTexture']);
	GL.createProgram('Warp',
		['uOrtho', 'uTime'],
		[['aPosition', gl.FLOAT, 2], ['aTexCoord', gl.FLOAT, 2]],
		['tTexture']);

	state.warpbuffer = gl.createFramebuffer();
	state.warptexture = gl.createTexture();
	GL.bind(0, state.warptexture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.warprenderbuffer = gl.createRenderbuffer();
	gl.bindRenderbuffer(gl.RENDERBUFFER, state.warprenderbuffer);
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, 0, 0);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.warpbuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, state.warptexture, 0);
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, state.warprenderbuffer);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	state.dlightvecs = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, state.dlightvecs);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
		0.0, -1.0, 0.0,
		0.0, 0.0, 1.0,
		-0.382683, 0.0, 0.92388,
		-0.707107, 0.0, 0.707107,
		-0.92388, 0.0, 0.382683,
		-1.0, 0.0, 0.0,
		-0.92388, 0.0, -0.382683,
		-0.707107, 0.0, -0.707107,
		-0.382683, 0.0, -0.92388,
		0.0, 0.0, -1.0,
		0.382683, 0.0, -0.92388,
		0.707107, 0.0, -0.707107,
		0.92388, 0.0, -0.382683,
		1.0, 0.0, 0.0,
		0.92388, 0.0, 0.382683,
		0.707107, 0.0, 0.707107,
		0.382683, 0.0, 0.92388,
		0.0, 0.0, 1.0
	]), gl.STATIC_DRAW);

	makeSky();
};

export const newMap = function()
{
  const gl = GL.getContext()
	var i;
	for (i = 0; i < 64; ++i)
		state.lightstylevalue[i] = 12;

	clearParticles();
	buildLightmaps();

	for (i = 0; i <= 1048575; ++i)
		state.dlightmaps[i] = 0;
	GL.bind(0, state.dlightmap_texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, 1024, 1024, 0, gl.ALPHA, gl.UNSIGNED_BYTE, null);
};

export const timeRefresh_f = function()
{
  const gl = GL.getContext()
	gl.finish();
	var i;
	var start = sys.floatTime();
	for (i = 0; i <= 127; ++i)
	{
		state.refdef.viewangles[1] = i * 2.8125;
		renderView();
	}
	gl.finish();
	var time = sys.floatTime() - start;
	con.print(time.toFixed(6) + ' seconds (' + (128.0 / time).toFixed(6) + ' fps)\n');
};

// part

const PTYPE = {
	tracer: 0,
	grav: 1,
	slowgrav: 2,
	fire: 3,
	explode: 4,
	explode2: 5,
	blob: 6,
	blob2: 7
};

state.ramp1 = [0x6f, 0x6d, 0x6b, 0x69, 0x67, 0x65, 0x63, 0x61];
state.ramp2 = [0x6f, 0x6e, 0x6d, 0x6c, 0x6b, 0x6a, 0x68, 0x66];
state.ramp3 = [0x6d, 0x6b, 6, 5, 4, 3];

export const initParticles = function()
{
  const gl = GL.getContext()
	var i = com.checkParm('-particles');
	if (i != null)
	{
		state.numparticles = q.atoi(com.state.argv[i + 1]);
		if (state.numparticles < 512)
			state.numparticles = 512;
	}
	else
		state.numparticles = 2048;

	state.avelocities = [];
	for (i = 0; i <= 161; ++i)
		state.avelocities[i] = [Math.random() * 2.56, Math.random() * 2.56, Math.random() * 2.56];

	GL.createProgram('Particle',
		['uViewOrigin', 'uViewAngles', 'uPerspective', 'uGamma'],
		[['aOrigin', gl.FLOAT, 3], ['aCoord', gl.FLOAT, 2], ['aScale', gl.FLOAT, 1], ['aColor', gl.UNSIGNED_BYTE, 3, true]],
		[]);
};

export const entityParticles = function(ent)
{
	var allocated = allocParticles(162), i;
	var angle, sp, sy, cp, cy, forward = [];
	for (i = 0; i < allocated.length; ++i)
	{
		angle = cl.clState.time * state.avelocities[i][0];
		sp = Math.sin(angle);
		cp = Math.cos(angle);
		angle = cl.clState.time * state.avelocities[i][1];
		sy = Math.sin(angle);
		cy = Math.cos(angle);

		state.particles[allocated[i]] = {
			die: cl.clState.time + 0.01,
			color: 0x6f,
			ramp: 0.0,
			type: PTYPE.explode,
			org: [
				ent.origin[0] + state.avertexnormals[i][0] * 64.0 + cp * cy * 16.0,
				ent.origin[1] + state.avertexnormals[i][1] * 64.0 + cp * sy * 16.0,
				ent.origin[2] + state.avertexnormals[i][2] * 64.0 + sp * -16.0
			],
			vel: [0.0, 0.0, 0.0]
		};
	}
};

export const clearParticles = function()
{
	var i;
	state.particles = [];
	for (i = 0; i < state.numparticles; ++i)
		state.particles[i] = {die: -1.0};
};

export const readPointFile_f = async function()
{
	if (sv.state.server.active !== true)
		return;
	var name = 'maps/' + pr.getString(pr.state.globals_int[pr.globalvars.mapname]) + '.pts';
	var f = await com.loadTextFile(name);
	if (f == null)
	{
		con.print('couldn\'t open ' + name + '\n');
		return;
	}
	con.print('Reading ' + name + '...\n');
	var flines = f.split('\n');
	var c, org, p;
	for (c = 0; c < flines.length; )
	{
		org = flines[c].split(' ');
		if (org.length !== 3)
			break;
		++c;
		p = allocParticles(1);
		if (p.length === 0)
		{
			con.print('Not enough free particles\n');
			break;
		}
		state.particles[p[0]] = {
			die: 99999.0,
			color: -c & 15,
			type: PTYPE.tracer,
			vel: [0.0, 0.0, 0.0],
			org: [q.atof(org[0]), q.atof(org[1]), q.atof(org[2])]
		};
	}
	con.print(c + ' points read\n');
};

export const parseParticleEffect = function()
{
	var org = [msg.readCoord(), msg.readCoord(), msg.readCoord()];
	var dir = [msg.readChar() * 0.0625, msg.readChar() * 0.0625, msg.readChar() * 0.0625];
	var msgcount = msg.readByte();
	var color = msg.readByte();
	if (msgcount === 255)
		particleExplosion(org);
	else
		runParticleEffect(org, dir, color, msgcount);
};

export const particleExplosion = function(org)
{
	var allocated = allocParticles(1024), i;
	for (i = 0; i < allocated.length; ++i)
	{
		state.particles[allocated[i]] = {
			die: cl.clState.time + 5.0,
			color: state.ramp1[0],
			ramp: Math.floor(Math.random() * 4.0),
			type: ((i & 1) !== 0) ? PTYPE.explode : PTYPE.explode2,
			org: [
				org[0] + Math.random() * 32.0 - 16.0,
				org[1] + Math.random() * 32.0 - 16.0,
				org[2] + Math.random() * 32.0 - 16.0
			],
			vel: [Math.random() * 512.0 - 256.0, Math.random() * 512.0 - 256.0, Math.random() * 512.0 - 256.0]
		};
	}
};

export const particleExplosion2 = function(org, colorStart, colorLength)
{
	var allocated = allocParticles(512), i, colorMod = 0;
	for (i = 0; i < allocated.length; ++i)
	{
		state.particles[allocated[i]] = {
			die: cl.clState.time + 0.3,
			color: colorStart + (colorMod++ % colorLength),
			type: PTYPE.blob,
			org: [
				org[0] + Math.random() * 32.0 - 16.0,
				org[1] + Math.random() * 32.0 - 16.0,
				org[2] + Math.random() * 32.0 - 16.0
			],
			vel: [Math.random() * 512.0 - 256.0, Math.random() * 512.0 - 256.0, Math.random() * 512.0 - 256.0]
		};
	}
};

export const blobExplosion = function(org)
{
	var allocated = allocParticles(1024), i, p;
	for (i = 0; i < allocated.length; ++i)
	{
		p = state.particles[allocated[i]];
		p.die = cl.clState.time + 1.0 + Math.random() * 0.4;
		if ((i & 1) !== 0)
		{
			p.type = PTYPE.blob;
			p.color = 66 + Math.floor(Math.random() * 7.0);
		}
		else
		{
			p.type = PTYPE.blob2;
			p.color = 150 + Math.floor(Math.random() * 7.0);
		}
		p.org = [
			org[0] + Math.random() * 32.0 - 16.0,
			org[1] + Math.random() * 32.0 - 16.0,
			org[2] + Math.random() * 32.0 - 16.0
		];
		p.vel = [Math.random() * 512.0 - 256.0, Math.random() * 512.0 - 256.0, Math.random() * 512.0 - 256.0];
	}
};

export const runParticleEffect = function(org, dir, color, count)
{
	var allocated = allocParticles(count), i;
	for (i = 0; i < allocated.length; ++i)
	{
		state.particles[allocated[i]] = {
			die: cl.clState.time + 0.6 * Math.random(),
			color: (color & 0xf8) + Math.floor(Math.random() * 8.0),
			type: PTYPE.slowgrav,
			org: [
				org[0] + Math.random() * 16.0 - 8.0,
				org[1] + Math.random() * 16.0 - 8.0,
				org[2] + Math.random() * 16.0 - 8.0
			],
			vel: [dir[0] * 15.0, dir[1] * 15.0, dir[2] * 15.0]
		};
	}
};

export const lavaSplash = function(org)
{
	var allocated = allocParticles(1024), i, j, k = 0, p;
	var dir = [], vel;
	for (i = -16; i <= 15; ++i)
	{
		for (j = -16; j <= 15; ++j)
		{
			if (k >= allocated.length)
				return;
			p = state.particles[allocated[k++]];
			p.die = cl.clState.time + 2.0 + Math.random() * 0.64;
			p.color = 224 + Math.floor(Math.random() * 8.0);
			p.type = PTYPE.slowgrav;
			dir[0] = (j + Math.random) * 8.0;
			dir[1] = (i + Math.random) * 8.0;
			dir[2] = 256.0;
			p.org = [org[0] + dir[0], org[1] + dir[1], org[2] + Math.random() * 64.0];
			vec.normalize(dir);
			vel = 50.0 + Math.random() * 64.0;
			p.vel = [dir[0] * vel, dir[1] * vel, dir[2] * vel];
		}
	}
};

export const teleportSplash = function(org)
{
	var allocated = allocParticles(896), i, j, k, l = 0, p;
	var dir = [], vel;
	for (i = -16; i <= 15; i += 4)
	{
		for (j = -16; j <= 15; j += 4)
		{
			for (k = -24; k <= 31; k += 4)
			{
				if (l >= allocated.length)
					return;
				p = state.particles[allocated[l++]];
				p.die = cl.clState.time + 0.2 + Math.random() * 0.16;
				p.color = 7 + Math.floor(Math.random() * 8.0);
				p.type = PTYPE.slowgrav;
				dir[0] = j * 8.0;
				dir[1] = i * 8.0;
				dir[2] = k * 8.0;
				p.org = [
					org[0] + i + Math.random() * 4.0,
					org[1] + j + Math.random() * 4.0,
					org[2] + k + Math.random() * 4.0
				];
				vec.normalize(dir);
				vel = 50.0 + Math.random() * 64.0;
				p.vel = [dir[0] * vel, dir[1] * vel, dir[2] * vel];
			}
		}
	}
};

state.tracercount = 0;
export const rocketTrail = function(start, end, type)
{
	var _vec = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
	var len = Math.sqrt(_vec[0] * _vec[0] + _vec[1] * _vec[1] + _vec[2] * _vec[2]);
	if (len === 0.0)
		return;
	_vec = [_vec[0] / len, _vec[1] / len, _vec[2] / len];

	var allocated;
	if (type === 4)
		allocated = allocParticles(Math.floor(len / 6.0));
	else
		allocated = allocParticles(Math.floor(len / 3.0));

	var i, p;
	for (i = 0; i < allocated.length; ++i)
	{
		p = state.particles[allocated[i]];
		p.vel = [0.0, 0.0, 0.0];
		p.die = cl.clState.time + 2.0;
		switch (type)
		{
		case 0:
		case 1:
			p.ramp = Math.floor(Math.random() * 4.0) + (type << 1);
			p.color = state.ramp3[p.ramp];
			p.type = PTYPE.fire;
			p.org = [
				start[0] + Math.random() * 6.0 - 3.0,
				start[1] + Math.random() * 6.0 - 3.0,
				start[2] + Math.random() * 6.0 - 3.0
			];
			break;
		case 2:
			p.type = PTYPE.grav;
			p.color = 67 + Math.floor(Math.random() * 4.0);
			p.org = [
				start[0] + Math.random() * 6.0 - 3.0,
				start[1] + Math.random() * 6.0 - 3.0,
				start[2] + Math.random() * 6.0 - 3.0
			];
			break;
		case 3:
		case 5:
			p.die = cl.clState.time + 0.5;
			p.type = PTYPE.tracer;
			if (type === 3)
				p.color = 52 + ((state.tracercount++ & 4) << 1);
			else
				p.color = 230 + ((state.tracercount++ & 4) << 1);
			p.org = [start[0], start[1], start[2]];
			if ((state.tracercount & 1) !== 0)
			{
				p.vel[0] = 30.0 * _vec[1];
				p.vel[2] = -30.0 * _vec[0];
			}
			else
			{
				p.vel[0] = -30.0 * _vec[1];
				p.vel[2] = 30.0 * _vec[0];
			}
			break;
		case 4:
			p.type = PTYPE.grav;
			p.color = 67 + Math.floor(Math.random() * 4.0);
			p.org = [
				start[0] + Math.random() * 6.0 - 3.0,
				start[1] + Math.random() * 6.0 - 3.0,
				start[2] + Math.random() * 6.0 - 3.0
			];
			break;
		case 6:
			p.color = 152 + Math.floor(Math.random() * 4.0);
			p.type = PTYPE.tracer;
			p.die = cl.clState.time + 0.3;
			p.org = [
				start[0] + Math.random() * 16.0 - 8.0,
				start[1] + Math.random() * 16.0 - 8.0,
				start[2] + Math.random() * 16.0 - 8.0
			];
		}
		start[0] += _vec[0];
		start[1] += _vec[1];
		start[2] += _vec[2];
	}
};

export const drawParticles = function()
{
  const gl = GL.getContext()
	GL.streamFlush();

	var program = GL.useProgram('Particle');
	gl.depthMask(false);
	gl.enable(gl.BLEND);

	var frametime = cl.clState.time - cl.clState.oldtime;
	var grav = frametime * sv.cvr.gravity.value * 0.05;
	var dvel = frametime * 4.0;
	var scale;

	var coords = [-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0];
	for (var i = 0; i < state.numparticles; ++i)
	{
		var p = state.particles[i];
		if (p.die < cl.clState.time)
			continue;

		var color = vid.d_8to24table[p.color];
		scale = (p.org[0] - state.refdef.vieworg[0]) * state.vpn[0]
			+ (p.org[1] - state.refdef.vieworg[1]) * state.vpn[1]
			+ (p.org[2] - state.refdef.vieworg[2]) * state.vpn[2];
		if (scale < 20.0)
			scale = 0.375;
		else
			scale = 0.375 + scale * 0.0015;

		GL.streamGetSpace(6);
		for (var j = 0; j < 6; ++j)
		{
			GL.streamWriteFloat3(p.org[0], p.org[1], p.org[2]);
			GL.streamWriteFloat2(coords[j * 2], coords[j * 2 + 1]);
			GL.streamWriteFloat(scale);
			GL.streamWriteUByte4(color & 0xff, (color >> 8) & 0xff, color >> 16, 255);
		}

		p.org[0] += p.vel[0] * frametime;
		p.org[1] += p.vel[1] * frametime;
		p.org[2] += p.vel[2] * frametime;

		switch (p.type)
		{
		case PTYPE.fire:
			p.ramp += frametime * 5.0;
			if (p.ramp >= 6.0)
				p.die = -1.0;
			else
				p.color = state.ramp3[Math.floor(p.ramp)];
			p.vel[2] += grav;
			continue;
		case PTYPE.explode:
			p.ramp += frametime * 10.0;
			if (p.ramp >= 8.0)
				p.die = -1.0;
			else
				p.color = state.ramp1[Math.floor(p.ramp)];
			p.vel[0] += p.vel[0] * dvel;
			p.vel[1] += p.vel[1] * dvel;
			p.vel[2] += p.vel[2] * dvel - grav;
			continue;
		case PTYPE.explode2:
			p.ramp += frametime * 15.0;
			if (p.ramp >= 8.0)
				p.die = -1.0;
			else
				p.color = state.ramp2[Math.floor(p.ramp)];
			p.vel[0] -= p.vel[0] * frametime;
			p.vel[1] -= p.vel[1] * frametime;
			p.vel[2] -= p.vel[2] * frametime + grav;
			continue;
		case PTYPE.blob:
			p.vel[0] += p.vel[0] * dvel;
			p.vel[1] += p.vel[1] * dvel;
			p.vel[2] += p.vel[2] * dvel - grav;
			continue;
		case PTYPE.blob2:
			p.vel[0] += p.vel[0] * dvel;
			p.vel[1] += p.vel[1] * dvel;
			p.vel[2] -= grav;
			continue;
		case PTYPE.grav:
		case PTYPE.slowgrav:
			p.vel[2] -= grav;
		}
	}

	GL.streamFlush();

	gl.disable(gl.BLEND);
	gl.depthMask(true);
};

export const allocParticles = function(count)
{
	var allocated = [], i;
	for (i = 0; i < state.numparticles; ++i)
	{
		if (count === 0)
			return allocated;
		if (state.particles[i].die < cl.clState.time)
		{
			allocated[allocated.length] = i;
			--count;
		}
	}
	return allocated;
};

// surf

state.lightmap_modified = [];
state.lightmaps = new Uint8Array(new ArrayBuffer(4194304));
state.dlightmaps = new Uint8Array(new ArrayBuffer(1048576));

export const addDynamicLights = function(surf)
{
	var smax = (surf.extents[0] >> 4) + 1;
	var tmax = (surf.extents[1] >> 4) + 1;
	var size = smax * tmax;
	var tex = cl.clState.worldmodel.texinfo[surf.texinfo];
	var i, light, s, t;
	var dist, rad, minlight, impact = [], local = [], sd, td;

	var blocklights = [];
	for (i = 0; i < size; ++i)
		blocklights[i] = 0;

	for (i = 0; i <= 31; ++i)
	{
		if (((surf.dlightbits >>> i) & 1) === 0)
			continue;
		light = cl.state.dlights[i];
		dist = vec.dotProduct(light.origin, surf.plane.normal) - surf.plane.dist;
		rad = light.radius - Math.abs(dist);
		minlight = light.minlight;
		if (rad < minlight)
			continue;
		minlight = rad - minlight;
		impact[0] = light.origin[0] - surf.plane.normal[0] * dist;
		impact[1] = light.origin[1] - surf.plane.normal[1] * dist;
		impact[2] = light.origin[2] - surf.plane.normal[2] * dist;
		local[0] = vec.dotProduct(impact, tex.vecs[0]) + tex.vecs[0][3] - surf.texturemins[0];
		local[1] = vec.dotProduct(impact, tex.vecs[1]) + tex.vecs[1][3] - surf.texturemins[1];
		for (t = 0; t < tmax; ++t)
		{
			td = local[1] - (t << 4);
			if (td < 0.0)
				td = -td;
			td = Math.floor(td);
			for (s = 0; s < smax; ++s)
			{
				sd = local[0] - (s << 4);
				if (sd < 0)
					sd = -sd;
				sd = Math.floor(sd);
				if (sd > td)
					dist = sd + (td >> 1);
				else
					dist = td + (sd >> 1);
				if (dist < minlight)
					blocklights[t * smax + s] += Math.floor((rad - dist) * 256.0);
			}
		}
	}

	i = 0;
	var dest, bl;
	for (t = 0; t < tmax; ++t)
	{
		state.lightmap_modified[surf.light_t + t] = true;
		dest = ((surf.light_t + t) << 10) + surf.light_s;
		for (s = 0; s < smax; ++s)
		{
			bl = blocklights[i++] >> 7;
			if (bl > 255)
				bl = 255;
			state.dlightmaps[dest + s] = bl;
		}
	}
};

export const removeDynamicLights = function(surf)
{
	var smax = (surf.extents[0] >> 4) + 1;
	var tmax = (surf.extents[1] >> 4) + 1;
	var dest, s, t;
	for (t = 0; t < tmax; ++t)
	{
		state.lightmap_modified[surf.light_t + t] = true;
		dest = ((surf.light_t + t) << 10) + surf.light_s;
		for (s = 0; s < smax; ++s)
			state.dlightmaps[dest + s] = 0;
	}
};

export const buildLightMap = function(surf)
{
	var dest;
	var smax = (surf.extents[0] >> 4) + 1;
	var tmax = (surf.extents[1] >> 4) + 1;
	var i, j;
	var lightmap = surf.lightofs;
	var maps;
	for (maps = 0; maps < surf.styles.length; ++maps)
	{
		dest = (surf.light_t << 12) + (surf.light_s << 2) + maps;
		for (i = 0; i < tmax; ++i)
		{
			for (j = 0; j < smax; ++j)
				state.lightmaps[dest + (j << 2)] = state.currentmodel.lightdata[lightmap + j];
			lightmap += smax;
			dest += 4096;
		}
	}
	for (; maps <= 3; ++maps)
	{
		dest = (surf.light_t << 12) + (surf.light_s << 2) + maps;
		for (i = 0; i < tmax; ++i)
		{
			for (j = 0; j < smax; ++j)
				state.lightmaps[dest + (j << 2)] = 0;
			dest += 4096;
		}
	}
};

export const textureAnimation = function(base)
{
	var frame = 0;
	if (base.anim_base != null)
	{
		frame = base.anim_frame;
		base = state.currententity.model.textures[base.anim_base];
	}
	var anims = base.anims;
	if (anims == null)
		return base;
	if ((state.currententity.frame !== 0) && (base.alternate_anims.length !== 0))
		anims = base.alternate_anims;
	return state.currententity.model.textures[anims[(Math.floor(cl.clState.time * 5.0) + frame) % anims.length]];
};

export const drawBrushModel = function(e)
{
  const gl = GL.getContext()
	var clmodel = e.model;

	if (clmodel.submodel === true)
	{
		if (cullBox(
			[
				e.origin[0] + clmodel.mins[0],
				e.origin[1] + clmodel.mins[1],
				e.origin[2] + clmodel.mins[2]
			],
			[
				e.origin[0] + clmodel.maxs[0],
				e.origin[1] + clmodel.maxs[1],
				e.origin[2] + clmodel.maxs[2]
			]) === true)
			return;
	}
	else
	{
		if (cullBox(
			[
				e.origin[0] - clmodel.radius,
				e.origin[1] - clmodel.radius,
				e.origin[2] - clmodel.radius
			],
			[
				e.origin[0] + clmodel.radius,
				e.origin[1] + clmodel.radius,
				e.origin[2] + clmodel.radius
			]) === true)
			return;
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, clmodel.cmds);
	var viewMatrix = GL.rotationMatrix(e.angles[0], e.angles[1], e.angles[2]);

	var program = GL.useProgram('Brush');
	gl.uniform3fv(program.uOrigin, e.origin);
	gl.uniformMatrix3fv(program.uAngles, false, viewMatrix);
	gl.vertexAttribPointer(program.aPosition.location, 3, gl.FLOAT, false, 44, 0);
	gl.vertexAttribPointer(program.aTexCoord.location, 4, gl.FLOAT, false, 44, 12);
	gl.vertexAttribPointer(program.aLightStyle.location, 4, gl.FLOAT, false, 44, 28);
	if ((cvr.fullbright.value !== 0) || (clmodel.lightdata == null))
		GL.bind(program.tLightmap, state.fullbright_texture);
	else
		GL.bind(program.tLightmap, state.lightmap_texture);
	GL.bind(program.tDlight, ((cvr.flashblend.value === 0) && (clmodel.submodel === true)) ? state.dlightmap_texture : state.null_texture);
	GL.bind(program.tLightStyle, state.lightstyle_texture);
	var i, chain, texture;
	for (i = 0; i < clmodel.chains.length; ++i)
	{
		chain = clmodel.chains[i];
		texture = textureAnimation(clmodel.textures[chain[0]]);
		if (texture.turbulent === true)
			continue;
		state.c_brush_verts += chain[2];
		GL.bind(program.tTexture, texture.texturenum);
		gl.drawArrays(gl.TRIANGLES, chain[1], chain[2]);
	}

	program = GL.useProgram('Turbulent');
	gl.uniform3f(program.uOrigin, 0.0, 0.0, 0.0);
	gl.uniformMatrix3fv(program.uAngles, false, viewMatrix);
	gl.uniform1f(program.uTime, host.state.realtime % (Math.PI * 2.0));
	gl.vertexAttribPointer(program.aPosition.location, 3, gl.FLOAT, false, 20, e.model.waterchain);
	gl.vertexAttribPointer(program.aTexCoord.location, 2, gl.FLOAT, false, 20, e.model.waterchain + 12);
	for (i = 0; i < clmodel.chains.length; ++i)
	{
		chain = clmodel.chains[i];
		texture = clmodel.textures[chain[0]];
		if (texture.turbulent !== true)
			continue;
		state.c_brush_verts += chain[2];
		GL.bind(program.tTexture, texture.texturenum);
		gl.drawArrays(gl.TRIANGLES, chain[1], chain[2]);
	}
};

export const recursiveWorldNode = function(node)
{
	if (node.contents === mod.CONTENTS.solid)
		return;
	if (node.contents < 0)
	{
		if (node.markvisframe !== state.visframecount)
			return;
		node.visframe = state.visframecount;
		if (node.skychain !== node.waterchain)
			state.drawsky = true;
		return;
	}
	recursiveWorldNode(node.children[0]);
	recursiveWorldNode(node.children[1]);
};

export const drawWorld = function()
{
  const gl = GL.getContext()
	var clmodel = cl.clState.worldmodel;
	state.currententity = cl.state.entities[0];
	gl.bindBuffer(gl.ARRAY_BUFFER, clmodel.cmds);

	var program = GL.useProgram('Brush');
	gl.uniform3f(program.uOrigin, 0.0, 0.0, 0.0);
	gl.uniformMatrix3fv(program.uAngles, false, GL.identity);
	gl.vertexAttribPointer(program.aPosition.location, 3, gl.FLOAT, false, 44, 0);
	gl.vertexAttribPointer(program.aTexCoord.location, 4, gl.FLOAT, false, 44, 12);
	gl.vertexAttribPointer(program.aLightStyle.location, 4, gl.FLOAT, false, 44, 28);
	if ((cvr.fullbright.value !== 0) || (clmodel.lightdata == null))
		GL.bind(program.tLightmap, state.fullbright_texture);
	else
		GL.bind(program.tLightmap, state.lightmap_texture);
	if (cvr.flashblend.value === 0)
		GL.bind(program.tDlight, state.dlightmap_texture);
	else
		GL.bind(program.tDlight, state.null_texture);
	GL.bind(program.tLightStyle, state.lightstyle_texture);
	var i, j, leaf, cmds;
	for (i = 0; i < clmodel.leafs.length; ++i)
	{
		leaf = clmodel.leafs[i];
		if ((leaf.visframe !== state.visframecount) || (leaf.skychain === 0))
			continue;
		if (cullBox(leaf.mins, leaf.maxs) === true)
			continue;
		for (j = 0; j < leaf.skychain; ++j)
		{
			cmds = leaf.cmds[j];
			state.c_brush_verts += cmds[2];
			GL.bind(program.tTexture, textureAnimation(clmodel.textures[cmds[0]]).texturenum);
			gl.drawArrays(gl.TRIANGLES, cmds[1], cmds[2]);
		}
	}

	program = GL.useProgram('Turbulent');
	gl.uniform3f(program.uOrigin, 0.0, 0.0, 0.0);
	gl.uniformMatrix3fv(program.uAngles, false, GL.identity);
	gl.uniform1f(program.uTime, host.state.realtime % (Math.PI * 2.0));
	gl.vertexAttribPointer(program.aPosition.location, 3, gl.FLOAT, false, 20, clmodel.waterchain);
	gl.vertexAttribPointer(program.aTexCoord.location, 2, gl.FLOAT, false, 20, clmodel.waterchain + 12);
	for (i = 0; i < clmodel.leafs.length; ++i)
	{
		leaf = clmodel.leafs[i];
		if ((leaf.visframe !== state.visframecount) || (leaf.waterchain === leaf.cmds.length))
			continue;
		if (cullBox(leaf.mins, leaf.maxs) === true)
			continue;
		for (j = leaf.waterchain; j < leaf.cmds.length; ++j)
		{
			cmds = leaf.cmds[j];
			state.c_brush_verts += cmds[2];
			GL.bind(program.tTexture, clmodel.textures[cmds[0]].texturenum);
			gl.drawArrays(gl.TRIANGLES, cmds[1], cmds[2]);
		}
	}
};

export const markLeaves = function()
{
	if ((state.oldviewleaf === state.viewleaf) && (cvr.novis.value === 0))
		return;
	++state.visframecount;
	state.oldviewleaf = state.viewleaf;
	var vis = (cvr.novis.value !== 0) ? mod.novis : mod.leafPVS(state.viewleaf, cl.clState.worldmodel);
	var i, node;
	for (i = 0; i < cl.clState.worldmodel.leafs.length; ++i)
	{
		if ((vis[i >> 3] & (1 << (i & 7))) === 0)
			continue;
		for (node = cl.clState.worldmodel.leafs[i + 1]; node != null; node = node.parent)
		{
			if (node.markvisframe === state.visframecount)
				break;
			node.markvisframe = state.visframecount;
		}
	}
	do
	{
		if (cvr.novis.value !== 0)
			break;
		var p = [state.refdef.vieworg[0], state.refdef.vieworg[1], state.refdef.vieworg[2]];
		var leaf;
		if (state.viewleaf.contents <= mod.CONTENTS.water)
		{
			leaf = mod.pointInLeaf([state.refdef.vieworg[0], state.refdef.vieworg[1], state.refdef.vieworg[2] + 16.0], cl.clState.worldmodel);
			if (leaf.contents <= mod.CONTENTS.water)
				break;
		}
		else
		{
			leaf = mod.pointInLeaf([state.refdef.vieworg[0], state.refdef.vieworg[1], state.refdef.vieworg[2] - 16.0], cl.clState.worldmodel);
			if (leaf.contents > mod.CONTENTS.water)
				break;
		}
		if (leaf === state.viewleaf)
			break;
		vis = mod.leafPVS(leaf, cl.clState.worldmodel);
		for (i = 0; i < cl.clState.worldmodel.leafs.length; ++i)
		{
			if ((vis[i >> 3] & (1 << (i & 7))) === 0)
				continue;
			for (node = cl.clState.worldmodel.leafs[i + 1]; node != null; node = node.parent)
			{
				if (node.markvisframe === state.visframecount)
					break;
				node.markvisframe = state.visframecount;
			}
		}
	} while (false);
	state.drawsky = false;
	recursiveWorldNode(cl.clState.worldmodel.nodes[0]);
};

export const allocBlock = function(surf)
{
	var w = (surf.extents[0] >> 4) + 1, h = (surf.extents[1] >> 4) + 1;
	var x, y, i, j, best = 1024, best2;
	for (i = 0; i < (1024 - w); ++i)
	{
		best2 = 0;
		for (j = 0; j < w; ++j)
		{
			if (state.allocated[i + j] >= best)
				break;
			if (state.allocated[i + j] > best2)
				best2 = state.allocated[i + j];
		}
		if (j === w)
		{
			x = i;
			y = best = best2;
		}
	}
	best += h;
	if (best > 1024)
		sys.error('AllocBlock: full');
	for (i = 0; i < w; ++i)
		state.allocated[x + i] = best;
	surf.light_s = x;
	surf.light_t = y;
};

// Based on Quake 2 polygon generation algorithm by Toji - http://blog.tojicode.com/2010/06/quake-2-bsp-quite-possibly-worst-format.html
export const buildSurfaceDisplayList = function(fa)
{
	fa.verts = [];
	if (fa.numedges <= 2)
		return;
	var i, index, _vec, vert, s, t;
	var texinfo = state.currentmodel.texinfo[fa.texinfo];
	var texture = state.currentmodel.textures[texinfo.texture];
	for (i = 0; i < fa.numedges; ++i)
	{
		index = state.currentmodel.surfedges[fa.firstedge + i];
		if (index > 0)
			_vec = state.currentmodel.vertexes[state.currentmodel.edges[index][0]];
		else
			_vec = state.currentmodel.vertexes[state.currentmodel.edges[-index][1]];
		vert = [_vec[0], _vec[1], _vec[2]];
		if (fa.sky !== true)
		{
			s = vec.dotProduct(_vec, texinfo.vecs[0]) + texinfo.vecs[0][3];
			t = vec.dotProduct(_vec, texinfo.vecs[1]) + texinfo.vecs[1][3];
			vert[3] = s / texture.width;
			vert[4] = t / texture.height;
			if (fa.turbulent !== true)
			{
				vert[5] = (s - fa.texturemins[0] + (fa.light_s << 4) + 8.0) / 16384.0;
				vert[6] = (t - fa.texturemins[1] + (fa.light_t << 4) + 8.0) / 16384.0;
			}
		}
		if (i >= 3)
		{
			fa.verts[fa.verts.length] = fa.verts[0];
			fa.verts[fa.verts.length] = fa.verts[fa.verts.length - 2];
		}
		fa.verts[fa.verts.length] = vert;
	}
};

export const buildLightmaps = function()
{
  const gl = GL.getContext()
	var i, j;

	state.allocated = [];
	for (i = 0; i < 1024; ++i)
		state.allocated[i] = 0;

	var surf;
	for (i = 1; i < cl.clState.model_precache.length; ++i)
	{
		state.currentmodel = cl.clState.model_precache[i];
		if (state.currentmodel.type !== mod.TYPE.brush)
			continue;
		if (state.currentmodel.name.charCodeAt(0) !== 42)
		{
			for (j = 0; j < state.currentmodel.faces.length; ++j)
			{
				surf = state.currentmodel.faces[j];
				if ((surf.sky !== true) && (surf.turbulent !== true))
				{
					allocBlock(surf);
					if (state.currentmodel.lightdata != null)
						buildLightMap(surf);
				}
				buildSurfaceDisplayList(surf);
			}
		}
		if (i === 1)
			makeWorldModelDisplayLists(state.currentmodel);
		else
			makeBrushModelDisplayLists(state.currentmodel);
	}

	GL.bind(0, state.lightmap_texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1024, 1024, 0, gl.RGBA, gl.UNSIGNED_BYTE, state.lightmaps);
};

// scan

export const warpScreen = function()
{
  const gl = GL.getContext()
	GL.streamFlush();
	gl.finish();
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	var program = GL.useProgram('Warp');
	GL.bind(program.tTexture, state.warptexture);
	gl.uniform1f(program.uTime, host.state.realtime % (Math.PI * 2.0));
	var vrect = state.refdef.vrect;
	GL.streamDrawTexturedQuad(vrect.x, vrect.y, vrect.width, vrect.height, 0.0, 1.0, 1.0, 0.0);
	GL.streamFlush();
};

// warp

export const makeSky = function()
{
  const gl = GL.getContext()
	var sin = [0.0, 0.19509, 0.382683, 0.55557, 0.707107, 0.831470, 0.92388, 0.980785, 1.0];
	var vecs = [], i, j;

	for (i = 0; i < 7; i += 2)
	{
		vecs = vecs.concat(
		[
			0.0, 0.0, 1.0,
			sin[i + 2] * 0.19509, sin[6 - i] * 0.19509, 0.980785,
			sin[i] * 0.19509, sin[8 - i] * 0.19509, 0.980785
		]);
		for (j = 0; j < 7; ++j)
		{
			vecs = vecs.concat(
			[
				sin[i] * sin[8 - j], sin[8 - i] * sin[8 - j], sin[j],
				sin[i] * sin[7 - j], sin[8 - i] * sin[7 - j], sin[j + 1],
				sin[i + 2] * sin[7 - j], sin[6 - i] * sin[7 - j], sin[j + 1],

				sin[i] * sin[8 - j], sin[8 - i] * sin[8 - j], sin[j],
				sin[i + 2] * sin[7 - j], sin[6 - i] * sin[7 - j], sin[j + 1],
				sin[i + 2] * sin[8 - j], sin[6 - i] * sin[8 - j], sin[j]
			]);
		}
	}

	GL.createProgram('Sky',
		['uViewAngles', 'uPerspective', 'uScale', 'uGamma', 'uTime'],
		[['aPosition', gl.FLOAT, 3]],
		['tSolid', 'tAlpha']);
	GL.createProgram('SkyChain',
		['uViewOrigin', 'uViewAngles', 'uPerspective'],
		[['aPosition', gl.FLOAT, 3]],
		[]);

	state.skyvecs = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, state.skyvecs);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vecs), gl.STATIC_DRAW);
};

export const drawSkyBox = function()
{
  const gl = GL.getContext()
	if (state.drawsky !== true)
		return;

	gl.colorMask(false, false, false, false);
	var clmodel = cl.clState.worldmodel;
	var program = GL.useProgram('SkyChain', false);
	gl.bindBuffer(gl.ARRAY_BUFFER, clmodel.cmds);
	gl.vertexAttribPointer(program.aPosition.location, 3, gl.FLOAT, false, 12, clmodel.skychain);
	var i, j, leaf, cmds;
	for (i = 0; i < clmodel.leafs.length; ++i)
	{
		leaf = clmodel.leafs[i];
		if ((leaf.visframe !== state.visframecount) || (leaf.skychain === leaf.waterchain))
			continue;
		if (cullBox(leaf.mins, leaf.maxs) === true)
			continue;
		for (j = leaf.skychain; j < leaf.waterchain; ++j)
		{
			cmds = leaf.cmds[j];
			gl.drawArrays(gl.TRIANGLES, cmds[0], cmds[1]);
		}
	}
	gl.colorMask(true, true, true, true);

	gl.depthFunc(gl.GREATER);
	gl.depthMask(false);
	gl.disable(gl.CULL_FACE);

	program = GL.useProgram('Sky', false);
	gl.uniform2f(program.uTime, (host.state.realtime * 0.125) % 1.0, (host.state.realtime * 0.03125) % 1.0);
	GL.bind(program.tSolid, state.solidskytexture, false);
	GL.bind(program.tAlpha, state.alphaskytexture, false);
	gl.bindBuffer(gl.ARRAY_BUFFER, state.skyvecs);
	gl.vertexAttribPointer(program.aPosition.location, 3, gl.FLOAT, false, 12, 0);

	gl.uniform3f(program.uScale, 2.0, -2.0, 1.0);
	gl.drawArrays(gl.TRIANGLES, 0, 180);
	gl.uniform3f(program.uScale, 2.0, -2.0, -1.0);
	gl.drawArrays(gl.TRIANGLES, 0, 180);

	gl.uniform3f(program.uScale, 2.0, 2.0, 1.0);
	gl.drawArrays(gl.TRIANGLES, 0, 180);
	gl.uniform3f(program.uScale, 2.0, 2.0, -1.0);
	gl.drawArrays(gl.TRIANGLES, 0, 180);

	gl.uniform3f(program.uScale, -2.0, -2.0, 1.0);
	gl.drawArrays(gl.TRIANGLES, 0, 180);
	gl.uniform3f(program.uScale, -2.0, -2.0, -1.0);
	gl.drawArrays(gl.TRIANGLES, 0, 180);

	gl.uniform3f(program.uScale, -2.0, 2.0, 1.0);
	gl.drawArrays(gl.TRIANGLES, 0, 180);
	gl.uniform3f(program.uScale, -2.0, 2.0, -1.0);
	gl.drawArrays(gl.TRIANGLES, 0, 180);

	gl.enable(gl.CULL_FACE);
	gl.depthMask(true);
	gl.depthFunc(gl.LESS);
};

export const initSky = function(src)
{
  const gl = GL.getContext()
	var i, j, p;
	var trans = new ArrayBuffer(65536);
	var trans32 = new Uint32Array(trans);

	for (i = 0; i < 128; ++i)
	{
		for (j = 0; j < 128; ++j)
			trans32[(i << 7) + j] = com.state.littleLong(vid.d_8to24table[src[(i << 8) + j + 128]] + 0xff000000);
	}
	if (gl) {
		GL.bind(0, state.solidskytexture, false);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 128, 128, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(trans));
		gl.generateMipmap(gl.TEXTURE_2D);
	
		for (i = 0; i < 128; ++i)
		{
			for (j = 0; j < 128; ++j)
			{
				p = (i << 8) + j;
				if (src[p] !== 0)
					trans32[(i << 7) + j] = com.state.littleLong(vid.d_8to24table[src[p]] + 0xff000000);
				else
					trans32[(i << 7) + j] = 0;
			}
		}
		GL.bind(0, state.alphaskytexture, false);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 128, 128, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(trans));
		gl.generateMipmap(gl.TEXTURE_2D);
	}
};