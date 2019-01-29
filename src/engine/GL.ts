import * as sys from './sys'
import * as cmd from './cmd'
import * as cvar from './cvar'
import * as vid from './vid'
import * as com from './com'
import * as con from './console'
import * as mod from './mod'
import * as draw from './draw'
import * as scr from './scr'

export let gl: any = null

export const state = {
  textures: [],
  currenttextures: [],
	programs: []
} as any

export const ortho = [
	0.0, 0.0, 0.0, 0.0,
	0.0, 0.0, 0.0, 0.0,
	0.0, 0.0, 0.00001, 0.0,
	-1.0, 1.0, 0.0, 1.0
]

export const identity = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0]

export const cvr = {

} as any

export const bind = function(target, texnum, flushStream = false)
{
	if (state.currenttextures[target] !== texnum)
	{
		if (flushStream === true)
			streamFlush();
		if (state.activetexture !== target)
		{
			state.activetexture = target;
			gl.activeTexture(gl.TEXTURE0 + target);
		}
		state.currenttextures[target] = texnum;
		gl.bindTexture(gl.TEXTURE_2D, texnum);
	}
};

export const textureMode_f = function()
{
	var i;
	if (cmd.state.argv.length <= 1)
	{
		for (i = 0; i < state.modes.length; ++i)
		{
			if (state.filter_min === state.modes[i][1])
			{
				con.print(state.modes[i][0] + '\n');
				return;
			}
		}
		con.print('current filter is unknown???\n');
		return;
	}
	var name = cmd.state.argv[1].toUpperCase();
	for (i = 0; i < state.modes.length; ++i)
	{
		if (state.modes[i][0] === name)
			break;
	}
	if (i === state.modes.length)
	{
		con.print('bad filter name\n');
		return;
	}
	state.filter_min = state.modes[i][1];
	state.filter_max = state.modes[i][2];
	for (i = 0; i < state.textures.length; ++i)
	{
		bind(0, state.textures[i].texnum);
		gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, state.filter_min);
		gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, state.filter_max);
	}
};

export const set2D = function()
{
	gl.viewport(0, 0, (vid.state.width * scr.state.devicePixelRatio) >> 0, (vid.state.height * scr.state.devicePixelRatio) >> 0);
	unbindProgram();
	var i, program;
	for (i = 0; i < state.programs.length; ++i)
	{
		program = state.programs[i];
		if (program.uOrtho == null)
			continue;
		gl.useProgram(program.program);
		gl.uniformMatrix4fv(program.uOrtho, false, ortho);
	}
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.BLEND);
};

export const resampleTexture = function(data, inwidth, inheight, outwidth, outheight)
{
	var outdata = new ArrayBuffer(outwidth * outheight);
	var out = new Uint8Array(outdata);
	var xstep = inwidth / outwidth, ystep = inheight / outheight;
	var src, dest = 0, y;
	var i, j;
	for (i = 0; i < outheight; ++i)
	{
		src = Math.floor(i * ystep) * inwidth;
		for (j = 0; j < outwidth; ++j)
			out[dest + j] = data[src + Math.floor(j * xstep)];
		dest += outwidth;
	}
	return out;
};

export const upload = function(data, width, height)
{
	var scaled_width = width, scaled_height = height;
	if (((width & (width - 1)) !== 0) || ((height & (height - 1)) !== 0))
	{
		--scaled_width;
		scaled_width |= (scaled_width >> 1);
		scaled_width |= (scaled_width >> 2);
		scaled_width |= (scaled_width >> 4);
		scaled_width |= (scaled_width >> 8);
		scaled_width |= (scaled_width >> 16);
		++scaled_width;
		--scaled_height;
		scaled_height |= (scaled_height >> 1);
		scaled_height |= (scaled_height >> 2);
		scaled_height |= (scaled_height >> 4);
		scaled_height |= (scaled_height >> 8);
		scaled_height |= (scaled_height >> 16);
		++scaled_height;
	}
	if (scaled_width > state.maxtexturesize)
		scaled_width = state.maxtexturesize;
	if (scaled_height > state.maxtexturesize)
		scaled_height = state.maxtexturesize;
	if ((scaled_width !== width) || (scaled_height !== height))
		data = resampleTexture(data, width, height, scaled_width, scaled_height);
	var trans = new ArrayBuffer((scaled_width * scaled_height) << 2)
	var trans32 = new Uint32Array(trans);
	var i;
	for (i = scaled_width * scaled_height - 1; i >= 0; --i)
	{
		trans32[i] = com.state.littleLong(vid.d_8to24table[data[i]] + 0xff000000);
		if (data[i] >= 224)
			trans32[i] &= 0xffffff;
	}
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, scaled_width, scaled_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(trans));
	gl.generateMipmap(gl.TEXTURE_2D);
	gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, state.filter_min);
	gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, state.filter_max);
};
export const loadTexture = function(identifier, width, height, data)
{
	var glt, i;
	if (identifier.length !== 0)
	{
		for (i = 0; i < state.textures.length; ++i)
		{
			glt = state.textures[i];
			if (glt.identifier === identifier)
			{
				if ((width !== glt.width) || (height !== glt.height))
					sys.error('GL.LoadTexture: cache mismatch');
				return glt;
			}
		}
	}

	var scaled_width = width, scaled_height = height;
	if (((width & (width - 1)) !== 0) || ((height & (height - 1)) !== 0))
	{
		--scaled_width ;
		scaled_width |= (scaled_width >> 1);
		scaled_width |= (scaled_width >> 2);
		scaled_width |= (scaled_width >> 4);
		scaled_width |= (scaled_width >> 8);
		scaled_width |= (scaled_width >> 16);
		++scaled_width;
		--scaled_height;
		scaled_height |= (scaled_height >> 1);
		scaled_height |= (scaled_height >> 2);
		scaled_height |= (scaled_height >> 4);
		scaled_height |= (scaled_height >> 8);
		scaled_height |= (scaled_height >> 16);
		++scaled_height;
	}
	if (scaled_width > state.maxtexturesize)
		scaled_width = state.maxtexturesize;
	if (scaled_height > state.maxtexturesize)
		scaled_height = state.maxtexturesize;
	scaled_width >>= cvr.picmip.value;
	if (scaled_width === 0)
		scaled_width = 1;
	scaled_height >>= cvr.picmip.value;
	if (scaled_height === 0)
		scaled_height = 1;
	if ((scaled_width !== width) || (scaled_height !== height))
		data = resampleTexture(data, width, height, scaled_width, scaled_height);

	glt = {texnum: gl.createTexture(), identifier: identifier, width: width, height: height};
	bind(0, glt.texnum);
	upload(data, scaled_width, scaled_height);
	state.textures[state.textures.length] = glt;
	return glt;
};

export const loadPicTexture = function(pic)
{
	var data = pic.data, scaled_width = pic.width, scaled_height = pic.height;
	if (((pic.width & (pic.width - 1)) !== 0) || ((pic.height & (pic.height - 1)) !== 0))
	{
		--scaled_width ;
		scaled_width |= (scaled_width >> 1);
		scaled_width |= (scaled_width >> 2);
		scaled_width |= (scaled_width >> 4);
		scaled_width |= (scaled_width >> 8);
		scaled_width |= (scaled_width >> 16);
		++scaled_width;
		--scaled_height;
		scaled_height |= (scaled_height >> 1);
		scaled_height |= (scaled_height >> 2);
		scaled_height |= (scaled_height >> 4);
		scaled_height |= (scaled_height >> 8);
		scaled_height |= (scaled_height >> 16);
		++scaled_height;
	}
	if (scaled_width > state.maxtexturesize)
		scaled_width = state.maxtexturesize;
	if (scaled_height > state.maxtexturesize)
		scaled_height = state.maxtexturesize;
	if ((scaled_width !== pic.width) || (scaled_height !== pic.height))
		data = resampleTexture(data, pic.width, pic.height, scaled_width, scaled_height);

	var texnum = gl.createTexture();
	bind(0, texnum);
	var trans = new ArrayBuffer((scaled_width * scaled_height) << 2)
	var trans32 = new Uint32Array(trans);
	var i;
	for (i = scaled_width * scaled_height - 1; i >= 0; --i)
	{
		if (data[i] !== 255)
			trans32[i] = com.state.littleLong(vid.d_8to24table[data[i]] + 0xff000000);
	}
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, scaled_width, scaled_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(trans));
	gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	return texnum;
};

export const createProgram = function(identifier, uniforms, attribs, textures)
{
	var p = gl.createProgram();
	var program =
	{
		identifier: identifier,
		program: p,
		attribs: []
	} as any;

	var vsh = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vsh, document.getElementById('vsh' + identifier).innerText);
	gl.compileShader(vsh);
	if (gl.getShaderParameter(vsh, gl.COMPILE_STATUS) !== true)
		sys.error('Error compiling shader: ' + gl.getShaderInfoLog(vsh));

	var fsh = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fsh, document.getElementById('fsh' + identifier).innerText);
	gl.compileShader(fsh);
	if (gl.getShaderParameter(fsh, gl.COMPILE_STATUS) !== true)
		sys.error('Error compiling shader: ' + gl.getShaderInfoLog(fsh));

	gl.attachShader(p, vsh);
	gl.attachShader(p, fsh);

	gl.linkProgram(p);
	if (gl.getProgramParameter(p, gl.LINK_STATUS) !== true)
		sys.error('Error linking program: ' + gl.getProgramInfoLog(p));

	gl.useProgram(p);

	for (var i = 0; i < uniforms.length; ++i)
		program[uniforms[i]] = gl.getUniformLocation(p, uniforms[i]);

	program.vertexSize = 0;
	program.attribBits = 0;
	for (var i = 0; i < attribs.length; ++i)
	{
		var attribParameters = attribs[i];
		var attrib =
		{
			name: attribParameters[0],
			location: gl.getAttribLocation(p, attribParameters[0]),
			type: attribParameters[1],
			components: attribParameters[2],
			normalized: (attribParameters[3] === true),
			offset: program.vertexSize
		};
		program.attribs[i] = attrib;
		program[attrib.name] = attrib;
		if (attrib.type === gl.FLOAT)
			program.vertexSize += attrib.components * 4;
		else if (attrib.type === gl.BYTE || attrib.type === gl.UNSIGNED_BYTE)
			program.vertexSize += 4;
		else
			sys.error('Unknown vertex attribute type');
		program.attribBits |= 1 << attrib.location;
	}

	for (var i = 0; i < textures.length; ++i)
	{
		program[textures[i]] = i;
		gl.uniform1i(gl.getUniformLocation(p, textures[i]), i);
	}

	state.programs[state.programs.length] = program;
	return program;
};

export const useProgram = function(identifier, flushStream = false)
{
	var currentProgram = state.currentProgram;
	if (currentProgram != null)
	{
		if (currentProgram.identifier === identifier)
			return currentProgram;
		if (flushStream === true)
			streamFlush();
	}

	var program = null;
	for (var i = 0; i < state.programs.length; ++i)
	{
		if (state.programs[i].identifier === identifier)
		{
			program = state.programs[i];
			break;
		}
	}
	if (program == null)
		return null;

	var enableAttribs = program.attribBits, disableAttribs = 0;
	if (currentProgram != null)
	{
		enableAttribs &= ~currentProgram.attribBits;
		disableAttribs = currentProgram.attribBits & ~program.attribBits;
	}
	state.currentProgram = program;
	gl.useProgram(program.program);
	for (var attrib = 0; enableAttribs !== 0 || disableAttribs !== 0; ++attrib)
	{
		var mask = 1 << attrib;
		if ((enableAttribs & mask) !== 0)
			gl.enableVertexAttribArray(attrib);
		else if ((disableAttribs & mask) !== 0)
			gl.disableVertexAttribArray(attrib);
		enableAttribs &= ~mask;
		disableAttribs &= ~mask;
	}

	return program;
};

export const unbindProgram = function()
{
	if (state.currentProgram == null)
		return;
	streamFlush();
	var i;
	for (i = 0; i < state.currentProgram.attribs.length; ++i)
		gl.disableVertexAttribArray(state.currentProgram.attribs[i].location);
	state.currentProgram = null;
};


export const rotationMatrix = function(pitch, yaw, roll)
{
	pitch *= Math.PI / -180.0;
	yaw *= Math.PI / 180.0;
	roll *= Math.PI / 180.0;
	var sp = Math.sin(pitch);
	var cp = Math.cos(pitch);
	var sy = Math.sin(yaw);
	var cy = Math.cos(yaw);
	var sr = Math.sin(roll);
	var cr = Math.cos(roll);
	return [
		cy * cp,					sy * cp,					-sp,
		-sy * cr + cy * sp * sr,	cy * cr + sy * sp * sr,		cp * sr,
		-sy * -sr + cy * sp * cr,	cy * -sr + sy * sp * cr,	cp * cr
	];
};

export const streamFlush = function()
{
	if (state.streamArrayVertexCount === 0)
		return;
	var program = state.currentProgram;
	if (program != null)
	{
		gl.bindBuffer(gl.ARRAY_BUFFER, state.streamBuffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, state.streamBufferPosition,
			state.streamArrayBytes.subarray(0, state.streamArrayPosition));
		var attribs = program.attribs;
		for (var i = 0; i < attribs.length; ++i)
		{
			var attrib = attribs[i];
			gl.vertexAttribPointer(attrib.location,
				attrib.components, attrib.type, attrib.normalized,
				program.vertexSize, state.streamBufferPosition + attrib.offset);
		}
		gl.drawArrays(gl.TRIANGLES, 0, state.streamArrayVertexCount);
		state.streamBufferPosition += state.streamArrayPosition;
	}
	state.streamArrayPosition = 0;
	state.streamArrayVertexCount = 0;
}

export const streamGetSpace = function(vertexCount)
{
	var program = state.currentProgram;
	if (program == null)
		return;
	var length = vertexCount * program.vertexSize;
	if ((state.streamBufferPosition + state.streamArrayPosition + length) > state.streamArray.byteLength)
	{
		streamFlush();
		state.streamBufferPosition = 0;
	}
	state.streamArrayVertexCount += vertexCount;
}

export const streamWriteFloat = function(x)
{
	state.streamArrayView.setFloat32(state.streamArrayPosition, x, true);
	state.streamArrayPosition += 4;
}

export const streamWriteFloat2 = function(x, y)
{
	var view = state.streamArrayView;
	var position = state.streamArrayPosition;
	view.setFloat32(position, x, true);
	view.setFloat32(position + 4, y, true);
	state.streamArrayPosition += 8;
}

export const streamWriteFloat3 = function(x, y, z)
{
	var view = state.streamArrayView;
	var position = state.streamArrayPosition;
	view.setFloat32(position, x, true);
	view.setFloat32(position + 4, y, true);
	view.setFloat32(position + 8, z, true);
	state.streamArrayPosition += 12;
}

export const streamWriteFloat4 = function(x, y, z, w)
{
	var view = state.streamArrayView;
	var position = state.streamArrayPosition;
	view.setFloat32(position, x, true);
	view.setFloat32(position + 4, y, true);
	view.setFloat32(position + 8, z, true);
	view.setFloat32(position + 12, w, true);
	state.streamArrayPosition += 16;
}

export const streamWriteUByte4 = function(x, y, z, w)
{
	var view = state.streamArrayView;
	var position = state.streamArrayPosition;
	view.setUint8(position, x);
	view.setUint8(position + 1, y);
	view.setUint8(position + 2, z);
	view.setUint8(position + 3, w);
	state.streamArrayPosition += 4;
}

export const streamDrawTexturedQuad = function(x, y, w, h, u, v, u2, v2)
{
	var x2 = x + w, y2 = y + h;
	streamGetSpace(6);
	streamWriteFloat4(x, y, u, v);
	streamWriteFloat4(x, y2, u, v2);
	streamWriteFloat4(x2, y, u2, v);
	streamWriteFloat4(x2, y, u2, v);
	streamWriteFloat4(x, y2, u, v2);
	streamWriteFloat4(x2, y2, u2, v2);
}

export const streamDrawColoredQuad = function(x, y, w, h, r, g, b, a)
{
	var x2 = x + w, y2 = y + h;
	streamGetSpace(6);
	streamWriteFloat2(x, y);
	streamWriteUByte4(r, g, b, a);
	streamWriteFloat2(x, y2);
	streamWriteUByte4(r, g, b, a);
	streamWriteFloat2(x2, y);
	streamWriteUByte4(r, g, b, a);
	streamWriteFloat2(x2, y);
	streamWriteUByte4(r, g, b, a);
	streamWriteFloat2(x, y2);
	streamWriteUByte4(r, g, b, a);
	streamWriteFloat2(x2, y2);
	streamWriteUByte4(r, g, b, a);
}

export const init = function()
{
	vid.state.mainwindow = document.getElementById('mainwindow');
	try
	{
		gl = vid.state.mainwindow.getContext('webgl') || vid.state.mainwindow.getContext('experimental-webgl');
	}
	catch (e) {}
	if (gl == null)
		sys.error('Unable to initialize WebGL. Your browser may not support it.');

	state.maxtexturesize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

	gl.clearColor(0.0, 0.0, 0.0, 0.0);
	gl.cullFace(gl.FRONT);
	gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);

	state.modes = [
		['GL_NEAREST', gl.NEAREST, gl.NEAREST],
		['GL_LINEAR', gl.LINEAR, gl.LINEAR],
		['GL_NEAREST_MIPMAP_NEAREST', gl.NEAREST_MIPMAP_NEAREST, gl.NEAREST],
		['GL_LINEAR_MIPMAP_NEAREST', gl.LINEAR_MIPMAP_NEAREST, gl.LINEAR],
		['GL_NEAREST_MIPMAP_LINEAR', gl.NEAREST_MIPMAP_LINEAR, gl.NEAREST],
		['GL_LINEAR_MIPMAP_LINEAR', gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR]
	];
	state.filter_min = gl.LINEAR_MIPMAP_NEAREST;
	state.filter_max = gl.LINEAR;

	cvr.picmip = cvar.registerVariable('gl_picmip', '0');
	cmd.addCommand('gl_texturemode', textureMode_f);

	state.streamArray = new ArrayBuffer(8192); // Increasing even a little bit ruins all performance on Mali.
	state.streamArrayBytes = new Uint8Array(state.streamArray);
	state.streamArrayPosition = 0;
	state.streamArrayVertexCount = 0;
	state.streamArrayView = new DataView(state.streamArray);
	state.streamBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, state.streamBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, state.streamArray.byteLength, gl.DYNAMIC_DRAW);
	state.streamBufferPosition = 0;

	vid.state.mainwindow.style.display = 'inline-block';
};