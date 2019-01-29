import * as cmd from './cmd'
import * as con from './console'
import * as sys from './sys'
import * as cvar from './cvar'
import * as draw from './draw'
import * as q from './q'
import * as crc from './crc'

export const state = {
  standard_quake: true,
  argv: [],
  searchpaths: [],
  token: '',
  modified: false
} as any

export const cvr = {

} as any

const getFile = async function(file: string) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.overrideMimeType('text/plain; charset=x-user-defined');
    xhr.open('GET', file);
    xhr.onload = () => {
      resolve({
        status: xhr.status,
        responseText: xhr.responseText
      });
    }
    xhr.onerror = (e) => reject(e) 
    xhr.send();
  });
};

const getFileRange = async function(file, rangeFrom, rangeTo) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.overrideMimeType('text/plain; charset=x-user-defined');
    xhr.open('GET', file);
    xhr.setRequestHeader('Range', 'bytes=' + rangeFrom + '-' + rangeTo);
    xhr.onload = () => {
      resolve({
        status: xhr.status,
        responseText: xhr.responseText
      });
    }
    xhr.onerror = (e) => reject(e)
    xhr.send();
  });
};


const checkRegistered = async function()
{
	var h = await loadFile('gfx/pop.lmp');
	if (h == null)
	{
    con.print('Playing shareware version.\n');
		if (state.modified === true)
			sys.error('You must have the registered version to use modified games');
		return;
	}
	var check = new Uint8Array(h);
	var pop =
	[
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x66, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x66, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x66, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x67, 0x00, 0x00,
		0x00, 0x00, 0x66, 0x65, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x65, 0x66, 0x00,
		0x00, 0x63, 0x65, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x61, 0x65, 0x63,
		0x00, 0x64, 0x65, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x61, 0x65, 0x64,
		0x00, 0x64, 0x65, 0x64, 0x00, 0x00, 0x64, 0x69, 0x69, 0x69, 0x64, 0x00, 0x00, 0x64, 0x65, 0x64,
		0x00, 0x63, 0x65, 0x68, 0x62, 0x00, 0x00, 0x64, 0x68, 0x64, 0x00, 0x00, 0x62, 0x68, 0x65, 0x63,
		0x00, 0x00, 0x65, 0x67, 0x69, 0x63, 0x00, 0x64, 0x67, 0x64, 0x00, 0x63, 0x69, 0x67, 0x65, 0x00,
		0x00, 0x00, 0x62, 0x66, 0x67, 0x69, 0x6A, 0x68, 0x67, 0x68, 0x6A, 0x69, 0x67, 0x66, 0x62, 0x00,
		0x00, 0x00, 0x00, 0x62, 0x65, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x65, 0x62, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x62, 0x63, 0x64, 0x66, 0x64, 0x63, 0x62, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x62, 0x66, 0x62, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x61, 0x66, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x65, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
	];
	var i;
	for (i = 0; i < 256; ++i)
	{
		if (check[i] !== pop[i])
			sys.error('Corrupted data file.');
	}
	cvar.set('registered', '1');
	con.print('Playing registered version.\n');
};

const path_f = function()
{
	con.print('Current search path:\n');
	var i = state.searchpaths.length, j, s;
	for (i = state.searchpaths.length - 1; i >= 0; --i)
	{
		s = state.searchpaths[i];
		for (j = s.pack.length - 1; j >= 0; --j)
			con.print(s.filename + '/' + 'pak' + j + '.pak (' + s.pack[j].length + ' files)\n');
		con.print(s.filename + '\n');
	}
};

export const writeFile = function(filename, data, len)
{
	filename = filename.toLowerCase();
	var dest = [], i;
	for (i = 0; i < len; ++i)
		dest[i] = String.fromCharCode(data[i]);
	try
	{
		localStorage.setItem('Quake.' + state.searchpaths[state.searchpaths.length - 1].filename + '/' + filename, dest.join(''));
	}
	catch (e)
	{
		sys.print('COM.WriteFile: failed on ' + filename + '\n');
		return;
	}
	sys.print('COM.WriteFile: ' + filename + '\n');
	return true;
};

export const loadFile = async function(filename: string)
{
	filename = filename.toLowerCase();
	var i, j, k, search, netpath, pak, file, data;
	draw.beginDisc();
	for (i = state.searchpaths.length - 1; i >= 0; --i)
	{
		search = state.searchpaths[i];
		netpath = search.filename + '/' + filename;
		data = localStorage.getItem('Quake.' + netpath);
		if (data != null)
		{
			sys.print('FindFile: ' + netpath + '\n');
			draw.endDisc();
			return q.strmem(data);
		}
		for (j = search.pack.length - 1; j >= 0; --j)
		{
			pak = search.pack[j];
			for (k = 0; k < pak.length; ++k)
			{
				file = pak[k];
				if (file.name !== filename)
					continue;
				if (file.filelen === 0)
				{
					draw.endDisc();
					return new ArrayBuffer(0);
        }
        const gotFile = await getFileRange(search.filename + '/pak' + j + '.pak', file.filepos, (file.filepos + file.filelen - 1)) as any
				
				if ((gotFile.status >= 200) && (gotFile.status <= 299) && (gotFile.responseText.length === file.filelen))
				{
					sys.print('PackFile: ' + search.filename + '/pak' + j + '.pak : ' + filename + '\n')
					draw.endDisc();
					return q.strmem(gotFile.responseText);
				}
				break;
			}
    }
    const gotFile = await getFile(netpath) as any;
		if ((gotFile.status >= 200) && (gotFile.status <= 299))
		{
			sys.print('FindFile: ' + netpath + '\n');
			draw.endDisc();
			return q.strmem(gotFile.responseText);
		}
	}
	sys.print('FindFile: can\'t find ' + filename + '\n');
	draw.endDisc();
};

const loadPackFile = async function(packfile)
{
  const gotHeader = await getFileRange(packfile, 0, 11) as any;
	if ((gotHeader.status <= 199) || (gotHeader.status >= 300) || (gotHeader.responseText.length !== 12))
		return;
	var header = new DataView(q.strmem(gotHeader.responseText));
	if (header.getUint32(0, true) !== 0x4b434150)
		sys.error(packfile + ' is not a packfile');
	var dirofs = header.getUint32(4, true);
	var dirlen = header.getUint32(8, true);
	var numpackfiles = dirlen >> 6;
	if (numpackfiles !== 339)
		state.modified = true;
	var pack = [];
	if (numpackfiles !== 0)
	{
    const fileInfo = await getFileRange(packfile, dirofs, (dirofs + dirlen - 1)) as any
		if ((fileInfo.status <= 199) || (fileInfo.status >= 300) || (fileInfo.responseText.length !== dirlen))
			return;
		var info = q.strmem(fileInfo.responseText);
		if (crc.block(new Uint8Array(info)) !== 32981)
			state.modified = true;
		var i;
		for (i = 0; i < numpackfiles; ++i)
		{
			pack[pack.length] =
			{
				name: q.memstr(new Uint8Array(info, i << 6, 56)).toLowerCase(),
				filepos: (new DataView(info)).getUint32((i << 6) + 56, true),
				filelen: (new DataView(info)).getUint32((i << 6) + 60, true)
			}
		}
	}
	con.print('Added packfile ' + packfile + ' (' + numpackfiles + ' files)\n');
	return pack;
};

const addGameDirectory = async function(dir)
{
	var search = {filename: dir, pack: []};
	var pak, i = 0;
	for (;;)
	{
		pak = await loadPackFile(dir + '/' + 'pak' + i + '.pak');
		if (pak == null)
			break;
		search.pack[search.pack.length] = pak;
		++i;
	}
	state.searchpaths[state.searchpaths.length] = search;
};

const initFilesystem = async function()
{
	var i, search;
	
	i = checkParm('-basedir');
	if (i != null)
		search = state.argv[i + 1];
	if (search != null)
		await addGameDirectory(search);
	else
		await addGameDirectory('id1');
		
	if (state.rogue === true)
		await addGameDirectory('rogue');
	else if (state.hipnotic === true)
		await addGameDirectory('hipnotic');
		
	i = checkParm('-game');
	if (i != null)
	{
		search = state.argv[i + 1];
		if (search != null)
		{
			state.modified = true;
			addGameDirectory(search);
		}
	}

	state.gamedir = [state.searchpaths[state.searchpaths.length - 1]];
};

export const checkParm = function(parm)
{
	var i;
	for (i = 1; i < state.argv.length; ++i)
	{
		if (state.argv[i] === parm)
			return i;
	}
};

export const writeTextFile = function(filename, data)
{
	filename = filename.toLowerCase();
	try
	{
		localStorage.setItem('Quake.' + state.searchpaths[state.searchpaths.length - 1].filename + '/' + filename, data);
	}
	catch (e)
	{
		sys.print('COM.WriteTextFile: failed on ' + filename + '\n');
		return;
	}
	sys.print('COM.WriteTextFile: ' + filename + '\n');
	return true;
};

export const defaultExtension = function(path, extension)
{
	var i, src;
	for (i = path.length - 1; i >= 0; --i)
	{
		src = path.charCodeAt(i);
		if (src === 47)
			break;
		if (src === 46)
			return path;
	}
	return path + extension;
};

export const loadTextFile = async function(filename: string)
{
	var buf = await loadFile(filename);
	if (buf == null)
		return;
	var bufview = new Uint8Array(buf);
	var f = [];
	var i;
	for (i = 0; i < bufview.length; ++i)
	{
		if (bufview[i] !== 13)
			f[f.length] = String.fromCharCode(bufview[i]);
	}
	return f.join('');
};

export const initArgv = function(argv)
{
	state.cmdline = (argv.join(' ') + ' ').substring(0, 256);
	var i;
	for (i = 0; i < argv.length; ++i)
		state.argv[i] = argv[i];	
	if (checkParm('-safe') != null)
	{
		state.argv[state.argv.length] = '-nosound';
		state.argv[state.argv.length] = '-nocdaudio';
		state.argv[state.argv.length] = '-nomouse';
	}
	if (checkParm('-rogue') != null)
	{
		state.rogue = true;
		state.standard_quake = false;
	}
	else if (checkParm('-hipnotic') != null)
	{
		state.hipnotic = true;
		state.standard_quake = false;
	}
};

export const parse = function(data)
{
	state.token = '';
	var i = 0, c;
	if (data.length === 0)
		return;
		
	var skipwhite = true;
	for (;;)
	{
		if (skipwhite !== true)
			break;
		skipwhite = false;
		for (;;)
		{
			if (i >= data.length)
				return;
			c = data.charCodeAt(i);
			if (c > 32)
				break;
			++i;
		}
		if ((c === 47) && (data.charCodeAt(i + 1) == 47))
		{
			for (;;)
			{
				if ((i >= data.length) || (data.charCodeAt(i) === 10))
					break;
				++i;
			}
			skipwhite = true;
		}
	}

	if (c === 34)
	{
		++i;
		for (;;)
		{
			c = data.charCodeAt(i);
			++i;
			if ((i >= data.length) || (c === 34))
				return data.substring(i);
			state.token += String.fromCharCode(c);
		}
	}

	for (;;)
	{
		if ((i >= data.length) || (c <= 32))
			break;
		state.token += String.fromCharCode(c);
		++i;
		c = data.charCodeAt(i);
	}

	return data.substring(i);
};

export const init = async function()
{
if ((document.location.protocol !== 'http:') && (document.location.protocol !== 'https:'))
		sys.error('Protocol is ' + document.location.protocol + ', not http: or https:');

	var swaptest = new ArrayBuffer(2);
	var swaptestview = new Uint8Array(swaptest);
	swaptestview[0] = 1;
	swaptestview[1] = 0;
	if ((new Uint16Array(swaptest))[0] === 1)
		state.littleLong = (function(l) {return l;});
	else
		state.littleLong = (function(l) {return (l >>> 24) + ((l & 0xff0000) >>> 8) + (((l & 0xff00) << 8) >>> 0) + ((l << 24) >>> 0);});

	cvr.registered = cvar.registerVariable('registered', '0');
	cvar.registerVariable('cmdline', state.cmdline, false, true);
	cmd.addCommand('path', path_f);
	await initFilesystem();
	await checkRegistered();
};