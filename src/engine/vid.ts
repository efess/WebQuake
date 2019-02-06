import * as com from './com'
import * as sys from './sys'
import * as GL from './GL'

export const state = {

} as any

export const d_8to24table = new Uint32Array(new ArrayBuffer(1024));

export const setPalette = async function()
{
	var palette = await com.loadFile('gfx/palette.lmp');
	if (palette == null)
		sys.error('Couldn\'t load gfx/palette.lmp');
	var pal = new Uint8Array(palette);
	var i, src = 0;
	for (i = 0; i < 256; ++i)
	{
		d_8to24table[i] = pal[src] + (pal[src + 1] << 8) + (pal[src + 2] << 16);
		src += 3;
	}
};

export const init = async function()
{
	document.getElementById('progress').style.display = 'none';
	GL.init();
	await setPalette();
};