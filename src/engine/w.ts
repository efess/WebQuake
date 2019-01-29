import * as com from './com'
import * as sys from './sys'
import * as q from './q'

var lumps = [];

export const loadWadFile = async function(filename: string)
{
	var base = await com.loadFile(filename);
	if (base == null)
		sys.error('W.LoadWadFile: couldn\'t load ' + filename);
	var view = new DataView(base);
	if (view.getUint32(0, true) !== 0x32444157)
		sys.error('Wad file ' + filename + ' doesn\'t have WAD2 id');
	var numlumps = view.getUint32(4, true);
	var infotableofs = view.getUint32(8, true);
	var i, size, lump;
	for (i = 0; i < numlumps; ++i)
	{
		size = view.getUint32(infotableofs + 4, true);
		lump = new ArrayBuffer(size);
		(new Uint8Array(lump)).set(new Uint8Array(base, view.getUint32(infotableofs, true), size));
		lumps[q.memstr(new Uint8Array(base, infotableofs + 16, 16)).toUpperCase()] = lump;
		infotableofs += 32;
	}
};

export const getLumpName = function(name: string)
{
	var lump = lumps[name];
	if (lump == null)
		sys.error('W.GetLumpName: ' + name + ' not found');
	return lump;
};