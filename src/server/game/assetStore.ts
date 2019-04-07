import * as q from '../../engine/q'
import * as crc from '../../engine/crc'
import * as com from '../../engine/com'
import * as sys from '../../engine/sys'
import * as con from '../../engine/console'
import * as fs from 'fs'


export const writeFile = (filename: string, data: Uint8Array, len: number) =>
{
  return Promise.reject(new Error('Not Implemented'))
}

export const writeTextFile = (filename, data) =>
{
  return Promise.reject(new Error('Not Implemented'))
}

export const loadFile = async function(filename: string)
{
	var src, i, j, k, search, pak, file, fd;
	for (i = com.state.searchpaths.length - 1; i >= 0; --i)
	{
		search = com.state.searchpaths[i];
		for (j = search.packs.length - 1; j >= 0; --j)
		{
			pak = search.packs[j];
			for (k = 0; k < pak.length; ++k)
			{
				file = pak[k];
				if (file.name !== filename)
					continue;
				if (file.filelen === 0)
					return new ArrayBuffer(0);
				try
				{
					fd = fs.openSync(search.dir + '/pak' + j + '.pak', 'r');
				}
				catch (e)
				{
					break;
				}
				sys.print('PackFile: ' + search.dir + '/pak' + j + '.pak : ' + filename + '\n')
				src = Buffer.alloc(file.filelen);
				fs.readSync(fd, src, 0, file.filelen, file.filepos);
				fs.closeSync(fd);
				break;
			}
		}
		if (src != null)
			break;
		try
		{
			src = fs.readFileSync(search.dir + '/' + filename);
			sys.print('FindFile: ' + search.dir + '/' + filename + '\n');
			break;
		}
		catch (e)
		{
		}
	}
	if (src == null)
	{
		sys.print('FindFile: can\'t find ' + filename + '\n');
		return;
	}
	var size = src.length;
	var dest = new ArrayBuffer(size), view = new DataView(dest);
	var count = size >> 2;
	if (count !== 0)
	{
		if (com.state.bigendien !== true)
		{
			for (i = 0; i < count; ++i)
				view.setUint32(i << 2, src.readUInt32LE(i << 2), true);
		}
		else
		{
			for (i = 0; i < count; ++i)
				view.setUint32(i << 2, src.readUInt32BE(i << 2));
		}
	}
	count <<= 2;
	switch (size & 3)
	{
	case 1:
		view.setUint8(count, src[count]);
		break;
	case 2:
		view.setUint16(count, src.readUInt16LE(count), true);
		break;
	case 3:
		view.setUint16(count, src.readUInt16LE(count), true);
		view.setUint8(count + 2, src[count + 2]);
	}
	return dest;
};

export const loadStorePackFiles = async function(game) 
{
	return Promise.resolve([])
}
export const loadPackFile = async function(dir, packName)
{
	const packfile = dir + '/' + packName
	var fd;
	try
	{
		fd = fs.openSync(packfile, 'r');
	}
	catch (e)
	{
		return;
	}
	var buf = Buffer.alloc(12);
	fs.readSync(fd, buf, 0, 12, 0);
	if (buf.readUInt32LE(0) !== 0x4b434150)
		sys.error(packfile + ' is not a packfile');
	var dirofs = buf.readUInt32LE(4);
	var dirlen = buf.readUInt32LE(8);
	var numpackfiles = dirlen >> 6;
	if (numpackfiles !== 339)
		com.state.modified = true;
	var pack = [];
	if (numpackfiles !== 0)
	{
		buf = Buffer.alloc(dirlen);
		fs.readSync(fd, buf, 0, dirlen, dirofs);
		if (crc.block(buf) !== 32981)
			com.state.modified = true;
		var i;
		for (i = 0; i < numpackfiles; ++i)
		{
			pack[pack.length] =
			{
				name: q.memstr(buf.slice(i << 6, (i << 6) + 56)).toLowerCase(),
				filepos: buf.readUInt32LE((i << 6) + 56),
				filelen: buf.readUInt32LE((i << 6) + 60)
			}
		}
	}
	fs.closeSync(fd);
	con.print('Added packfile ' + packfile + ' (' + numpackfiles + ' files)\n');
	return pack;
};