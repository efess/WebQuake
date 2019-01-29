import * as sys from './sys'
import * as con from './console'

export const getSpace = function(buf, length)
{
	if ((buf.cursize + length) > buf.data.byteLength)
	{
		if (buf.allowoverflow !== true)
			sys.error('SZ.GetSpace: overflow without allowoverflow set');
		if (length > buf.byteLength)
			sys.error('SZ.GetSpace: ' + length + ' is > full buffer size');
		buf.overflowed = true;
		con.print('SZ.GetSpace: overflow\n');
		buf.cursize = 0;
	}
	var cursize = buf.cursize;
	buf.cursize += length;
	return cursize;
};

export const write = function(sb, data, length)
{
	(new Uint8Array(sb.data, getSpace(sb, length), length)).set(data.subarray(0, length));
};

export const print = function(sb, data)
{
	var buf = new Uint8Array(sb.data);
	var dest;
	if (sb.cursize !== 0)
	{
		if (buf[sb.cursize - 1] === 0)
			dest = getSpace(sb, data.length - 1) - 1;
		else
			dest = getSpace(sb, data.length);
	}
	else
		dest = getSpace(sb, data.length);
	var i;
	for (i = 0; i < data.length; ++i)
		buf[dest + i] = data.charCodeAt(i);
};