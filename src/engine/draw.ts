import * as com from './com'
import * as vid from './vid'
import * as sys from './sys'
import * as def from './def'
import * as GL from './GL'
import * as w from './w'

export const state = {
  chars: null,
  conback: null
} as any

export const charToConback = function(num, dest)
{
	var source = ((num >> 4) << 10) + ((num & 15) << 3);
	var drawline, x;
	for (drawline = 0; drawline < 8; ++drawline)
	{
		for (x = 0; x < 8; ++x)
		{
			if (state.chars[source + x] !== 0)
				state.conback.data[dest + x] = 0x60 + state.chars[source + x];
		}
		source += 128;
		dest += 320;
	}
};

export const init = async function()
{
	var i;

	state.chars = new Uint8Array(w.getLumpName('CONCHARS'));
	
	var trans = new ArrayBuffer(65536);
	var trans32 = new Uint32Array(trans);
	for (i = 0; i < 16384; ++i)
	{
		if (state.chars[i] !== 0)
			trans32[i] = com.state.littleLong(vid.d_8to24table[state.chars[i]] + 0xff000000);
	}
	const gl = GL.gl
	state.char_texture = gl.createTexture();
	GL.bind(0, state.char_texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 128, 128, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(trans));
	gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	state.conback = {};
	var cb = await com.loadFile('gfx/conback.lmp');
	if (cb == null)
		sys.error('Couldn\'t load gfx/conback.lmp');
	state.conback.width = 320;
	state.conback.height = 200;
	state.conback.data = new Uint8Array(cb, 8, 64000);
	var ver = '(WebQuake build ' + def.webquake_version + ') 1.09';
	for (i = 0; i < ver.length; ++i)
		charToConback(ver.charCodeAt(i), 59829 - ((ver.length - i) << 3));
	state.conback.texnum = GL.loadPicTexture(state.conback);

	state.loading = await cachePic('loading');
	state.loadingElem = document.getElementById('loading');
	state.loadingElem.src = picToDataURL(state.loading);

	document.body.style.backgroundImage = 'url("' + picToDataURL(picFromWad('BACKTILE')) + '")';

	GL.createProgram('Fill',
		['uOrtho'],
		[['aPosition', gl.FLOAT, 2], ['aColor', gl.UNSIGNED_BYTE, 4, true]],
		[]);
	GL.createProgram('Pic',
		['uOrtho'],
		[['aPosition', gl.FLOAT, 2], ['aTexCoord', gl.FLOAT, 2]],
		['tTexture']);
	GL.createProgram('PicTranslate',
		['uOrtho', 'uTop', 'uBottom'],
		[['aPosition', gl.FLOAT, 2], ['aTexCoord', gl.FLOAT, 2]],
		['tTexture', 'tTrans']);
};

export const char = function(x, y, num)
{
	GL.streamDrawTexturedQuad(x, y, 8, 8,
		(num & 15) * 0.0625, (num >> 4) * 0.0625,
		((num & 15) + 1) * 0.0625, ((num >> 4) + 1) * 0.0625);
}

export const character = function(x, y, num)
{
	var program = GL.useProgram('Pic', true);
	GL.bind(program.tTexture, state.char_texture, true);
	char(x, y, num);
};

export const string = function(x, y, str)
{
	var program = GL.useProgram('Pic', true);
	GL.bind(program.tTexture, state.char_texture, true);
	for (var i = 0; i < str.length; ++i)
	{
		char(x, y, str.charCodeAt(i));
		x += 8;
	}
};

export const stringWhite = function(x, y, str)
{
	var program = GL.useProgram('Pic', true);
	GL.bind(program.tTexture, state.char_texture, true);
	for (var i = 0; i < str.length; ++i)
	{
		char(x, y, str.charCodeAt(i) + 128);
		x += 8;
	}
};

export const picFromWad = function(name)
{
	var buf = w.getLumpName(name);
	var p = {} as any;
	var view = new DataView(buf, 0, 8);
	p.width = view.getUint32(0, true);
	p.height = view.getUint32(4, true);
	p.data = new Uint8Array(buf, 8, p.width * p.height);
	p.texnum = GL.loadPicTexture(p);
	return p;
};

export const cachePic = async function(path)
{
	path = 'gfx/' + path + '.lmp';
	var buf = await com.loadFile(path);
	if (buf == null)
		sys.error('Draw.CachePic: failed to load ' + path);
	var dat = {} as any;
	var view = new DataView(buf, 0, 8);
	dat.width = view.getUint32(0, true);
	dat.height = view.getUint32(4, true);
	dat.data = new Uint8Array(buf, 8, dat.width * dat.height);
	dat.texnum = GL.loadPicTexture(dat);
	return dat;
};

export const pic = function(x, y, pic)
{
	var program = GL.useProgram('Pic', true);
	GL.bind(program.tTexture, pic.texnum, true);
	GL.streamDrawTexturedQuad(x, y, pic.width, pic.height, 0.0, 0.0, 1.0, 1.0);
};

export const picTranslate = function(x, y, pic, top, bottom)
{
	const gl = GL.gl
	GL.streamFlush();
	var program = GL.useProgram('PicTranslate');
	GL.bind(program.tTexture, pic.texnum);
	GL.bind(program.tTrans, pic.translate);

	var p = vid.d_8to24table[top];
	var scale = 1.0 / 191.25;
	gl.uniform3f(program.uTop, (p & 0xff) * scale, ((p >> 8) & 0xff) * scale, (p >> 16) * scale);
	p = vid.d_8to24table[bottom];
	gl.uniform3f(program.uBottom, (p & 0xff) * scale, ((p >> 8) & 0xff) * scale, (p >> 16) * scale);

	GL.streamDrawTexturedQuad(x, y, pic.width, pic.height, 0.0, 0.0, 1.0, 1.0);

	GL.streamFlush();
};

export const consoleBackground = function(lines)
{
	var program = GL.useProgram('Pic', true);
	GL.bind(program.tTexture, state.conback.texnum, true);
	GL.streamDrawTexturedQuad(0, lines - vid.state.height, vid.state.width, vid.state.height, 0.0, 0.0, 1.0, 1.0);
};

export const fill = function(x, y, w, h, c)
{
	var program = GL.useProgram('Fill', true);
	var color = vid.d_8to24table[c];
	GL.streamDrawColoredQuad(x, y, w, h, color & 0xff, (color >> 8) & 0xff, color >> 16, 255);
};

export const fadeScreen = function()
{
	var program = GL.useProgram('Fill', true);
	GL.streamDrawColoredQuad(0, 0, vid.state.width, vid.state.height, 0, 0, 0, 204);
};

export const beginDisc = function()
{
	if (state.loadingElem == null)
		return;
	state.loadingElem.style.left = ((vid.state.width - state.loading.width) >> 1) + 'px';
	state.loadingElem.style.top = ((vid.state.height - state.loading.height) >> 1) + 'px';
	state.loadingElem.style.display = 'inline-block';
};

export const endDisc = function()
{
	if (state.loadingElem != null)
		state.loadingElem.style.display = 'none';
};

export const picToDataURL = function(pic)
{
	var canvas = document.createElement('canvas');
	canvas.width = pic.width;
	canvas.height = pic.height;
	var ctx = canvas.getContext('2d');
	var data = ctx.createImageData(pic.width, pic.height);
	var trans = new ArrayBuffer(data.data.length);
	var trans32 = new Uint32Array(trans);
	var i;
	for (i = 0; i < pic.data.length; ++i)
		trans32[i] = com.state.littleLong(vid.d_8to24table[pic.data[i]] + 0xff000000);
	data.data.set(new Uint8Array(trans));
	ctx.putImageData(data, 0, 0);
	return canvas.toDataURL();
};