import * as sz from './sz'
import * as net from './net'
import * as q from './q'

export const state = {

} as any

export const writeChar = function(sb, c)
{
	(new DataView(sb.data)).setInt8(sz.getSpace(sb, 1), c);
};

export const writeByte = function(sb, c)
{
	(new DataView(sb.data)).setUint8(sz.getSpace(sb, 1), c);
};

export const writeShort = function(sb, c)
{
	(new DataView(sb.data)).setInt16(sz.getSpace(sb, 2), c, true);
};

export const writeLong = function(sb, c)
{
	(new DataView(sb.data)).setInt32(sz.getSpace(sb, 4), c, true);
};

export const writeFloat = function(sb, f)
{
	(new DataView(sb.data)).setFloat32(sz.getSpace(sb, 4), f, true);
};

export const writeString = function(sb, s)
{
	if (s != null)
		sz.write(sb, new Uint8Array(q.strmem(s)), s.length);
	writeChar(sb, 0)
};

export const writeCoord = function(sb, f)
{
	writeShort(sb, f * 8.0);
};

export const writeAngle = function(sb, f)
{
	writeByte(sb, ((f >> 0) * (256.0 / 360.0)) & 255);
};

export const beginReading = function()
{
	state.readcount = 0;
	state.badread = false;
};

export const readChar = function()
{
	if (state.readcount >= net.state.message.cursize)
	{
		state.badread = true;
		return -1;
	}
	if (state.readcount === 7) {
		debugger
	}
	var c = (new Int8Array(net.state.message.data, state.readcount, 1))[0];
	++state.readcount;
	return c;
};

export const readByte = function()
{
	if (state.readcount >= net.state.message.cursize)
	{
		state.badread = true;
		return -1;
	}
	var c = (new Uint8Array(net.state.message.data, state.readcount, 1))[0];
	++state.readcount;
	return c;
};

export const readShort = function()
{
	if ((state.readcount + 2) > net.state.message.cursize)
	{
		state.badread = true;
		return -1;
	}
	var c = (new DataView(net.state.message.data)).getInt16(state.readcount, true);
	state.readcount += 2;
	return c;
};

export const readLong = function()
{
	if ((state.readcount + 4) > net.state.message.cursize)
	{
		state.badread = true;
		return -1;
	}
	var c = (new DataView(net.state.message.data)).getInt32(state.readcount, true);
	state.readcount += 4;
	return c;
};

export const readFloat = function()
{
	if ((state.readcount + 4) > net.state.message.cursize)
	{
		state.badread = true;
		return -1;
	}
	var f = (new DataView(net.state.message.data)).getFloat32(state.readcount, true);
	state.readcount += 4;
	return f;
};

export const readString = function()
{
	var string = [], l, c;
	for (l = 0; l < 2048; ++l)
	{
		c = readByte();
		if (c <= 0)
			break;
		string[l] = String.fromCharCode(c);
	}
	return string.join('');
};

export const readCoord = function()
{
	return readShort() * 0.125;
};

export const readAngle = function()
{
	return readChar() * 1.40625;
};