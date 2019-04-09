import ISocket from '../../../engine/interfaces/net/ISocket'
import IDatagram from '../../../engine/interfaces/net/IDatagram'
import * as sv from '../../../engine/sv'
import * as host from '../../../engine/host'
import * as pr from '../../../engine/pr'
import * as com from '../../../engine/com'
import * as con from '../../../engine/console'
import * as net from '../../../engine/net'
import * as q from '../../../engine/q'
import * as cvar from '../../../engine/cvar'
import * as websocket from 'websocket'
import * as sys from '../sys'
import * as http from 'http'
import * as url from 'url'
import * as dgram from 'dgram'
import * as os from 'os'

export const name = "datagram"
export var initialized = false
export var available = true
export const state = {
  server: null,
  sockets: [],
  acceptsockets: [],
  myAddr: null,
  controlsocket: null
}

// not implemented client specific functions
export const connect = (host: string): ISocket => {
  return null
}
export const checkForResend = (): number => {
  return 0
}

export const registerWithMaster = () => {
}

export const init = function()
{
	if (com.checkParm('-noudp') != null)
		return;

	var i, newsocket;
	for (i = 0; i < sv.state.svs.maxclientslimit; ++i)
	{
		newsocket = dgram.createSocket('udp4');
		state.sockets[i] = newsocket;
		newsocket.bind();
		newsocket.on('listening', dgramOnListening);
		newsocket.on('message', dgramOnMessage);
		newsocket.on('error', dgramOnError);
	}

	var local = os.networkInterfaces(), j, k, addr;
	for (i in local)
	{
		j = local[i];
		for (k = 0; k < j.length; ++k)
		{
			addr = j[k];
			if ((addr.family !== 'IPv4') || (addr.internal === true))
				continue;
			state.myAddr = addr.address;
			break;
		}
		if (state.myAddr != null)
			break;
	}
	if (state.myAddr == null)
		state.myAddr = '127.0.0.1';

	return true;
};

export const listen = function()
{
	if (net.state.listening !== true)
	{
		if (state.controlsocket == null)
			return;
		state.controlsocket.close();
		state.controlsocket = null;
		return;
	}
	var controlsocket = dgram.createSocket('udp4');
	try
	{
		controlsocket.bind(net.state.hostport);
	}
	catch (e)
	{
		con.print('Unable to bind to ' + state.myAddr + ':' + net.state.hostport + '\n');
		controlsocket.close();
		return;
	}
	controlsocket.on('message', controlOnMessage);
	state.controlsocket = controlsocket;
};

export const checkNewConnections = function()
{
	if (state.acceptsockets.length === 0)
		return;
	var sock = net.newQSocket();
	var address = state.acceptsockets.shift();
	var i, newsocket;
	for (i = 0; i < state.sockets.length; ++i)
	{
		newsocket = state.sockets[i];
		if ((newsocket.data_port != null) && (newsocket.data_socket == null))
			break;
	}
	if (i === state.sockets.length)
		return;
	newsocket.data_socket = sock;
	sock.lastSendTime = net.state.time;
	sock.canSend = true;
	sock.driverdata = newsocket;
	sock.ackSequence = 0;
	sock.sendSequence = 0;
	sock.unreliableSendSequence = 0;
	sock.sendMessageLength = 0;
	sock.sendMessage = new Buffer(8192);
	sock.receiveSequence = 0;
	sock.unreliableReceiveSequence = 0;
	sock.receiveMessageLength = 0;
	sock.receiveMessage = new Buffer(8192);
	sock.addr = address;
	sock.address = address[0] + ':' + address[1];
	sock.messages = [];
	var buf = new Buffer(1032);
	buf.writeUInt32LE(0x09000080, 0);
	buf[4] = 0x81;
	buf.writeUInt32LE(newsocket.data_port, 5);
	state.controlsocket.send(buf, 0, 9, address[1], address[0]);
	return sock;
};

export const getMessage = function(sock)
{
	if (sock.driverdata == null)
		return -1;
	if ((sock.canSend !== true) && ((net.state.time - sock.lastSendTime) > 1.0))
		sendMessageNext(sock, true);
	var message, length, flags, ret = 0, sequence, i;
	for (; sock.messages.length > 0; )
	{
		message = sock.messages.shift();
		length = (message[2] << 8) + message[3] - 8;
		flags = message[1];
		sequence = message.readUInt32BE(4);
		if ((flags & 16) !== 0)
		{
			if (sequence < sock.unreliableReceiveSequence)
			{
				con.dPrint('Got a stale datagram\n');
				ret = 0;
				break;
			}
			if (sequence !== sock.unreliableReceiveSequence)
        con.dPrint('Dropped ' + (sequence - sock.unreliableReceiveSequence) + ' datagram(s)\n');
			sock.unreliableReceiveSequence = sequence + 1;
			net.state.message.cursize = length;
			for (i = 0; i < length; ++i)
				net.state.message.data[i] = message[8 + i];
			ret = 2;
			break;
		}
		if ((flags & 2) !== 0)
		{
			if (sequence !== (sock.sendSequence - 1))
			{
				con.dPrint('Stale ACK received\n');
				continue;
			}
			if (sequence === sock.ackSequence)
			{
				if (++sock.ackSequence !== sock.sendSequence)
          con.dPrint('ack sequencing error\n');
			}
			else
			{
				con.dPrint('Duplicate ACK received\n');
				continue;
			}
			sock.sendMessageLength -= 1024;
			if (sock.sendMessageLength > 0)
			{
				sock.sendMessage.copy(sock.sendMessage, 0, 1024, 1024 + sock.sendMessageLength);
				sock.sendNext = true;
				continue;
			}
			sock.sendMessageLength = 0;
			sock.canSend = true;
			continue;
		}
		if ((flags & 1) !== 0)
		{
			sock.driverdata.send(new Buffer([0, 2, 0, 8, sequence >>> 24, (sequence & 0xff0000) >>> 16, (sequence & 0xff00) >>> 8, (sequence & 0xff) >>> 0]),
				0, 8, sock.addr[1], sock.addr[0]);
			if (sequence !== sock.receiveSequence)
				continue;
			++sock.receiveSequence;
			if ((flags & 8) === 0)
			{
				message.copy(sock.receiveMessage, sock.receiveMessageLength, 8, 8 + length);
				sock.receiveMessageLength += length;
				continue;
			}
			var data = new Uint8Array(net.state.message.data);
			for (i = 0; i < sock.receiveMessageLength; ++i)
				data[i] = sock.receiveMessage[i];
			for (i = 0; i < length; ++i)
				data[sock.receiveMessageLength + i] = message[8 + i];
			net.state.message.cursize = sock.receiveMessageLength + length;
			sock.receiveMessageLength = 0;
			ret = 1;
			break;
		}
	}
	if (sock.sendNext === true)
		sendMessageNext(sock, false);
	return ret;
};

export const sendMessage = function(sock, data)
{
	if (sock.driverdata == null)
		return -1;
	var i, src = new Uint8Array(data.data);
	for (i = 0; i < data.cursize; ++i)
		sock.sendMessage[i] = src[i];
	sock.sendMessageLength = data.cursize;
	var buf = new Buffer(1032);
	buf[0] = 0;
	var dataLen;
	if (data.cursize <= 1024)
	{
		dataLen = data.cursize;
		buf[1] = 9;
	}
	else
	{
		dataLen = 1024;
		buf[1] = 1;
	}
	buf.writeUInt16BE(dataLen + 8, 2);
	buf.writeUInt32BE(sock.sendSequence++, 4);
	sock.sendMessage.copy(buf, 8, 0, dataLen);
	sock.canSend = false;
	sock.driverdata.send(buf, 0, dataLen + 8, sock.addr[1], sock.addr[0]);
	sock.lastSendTime = net.state.time;
	return 1;
};

const sendMessageNext = function(sock, resend)
{
	var buf = new Buffer(1032);
	buf[0] = 0;
	var dataLen;
	if (sock.sendMessageLength <= 1024)
	{
		dataLen = sock.sendMessageLength;
		buf[1] = 9;
	}
	else
	{
		dataLen = 1024;
		buf[1] = 1;
	}
	buf.writeUInt16BE(dataLen + 8, 2);
	if (resend !== true)
		buf.writeUInt32BE(sock.sendSequence++, 4);
	else
		buf.writeUInt32BE(sock.sendSequence - 1, 4);
	sock.sendMessage.copy(buf, 8, 0, dataLen);
	sock.sendNext = false;
	sock.driverdata.send(buf, 0, dataLen + 8, sock.addr[1], sock.addr[0]);
	sock.lastSendTime = net.state.time;
};

export const sendUnreliableMessage = function(sock, data)
{
	if (sock.driverdata == null)
		return -1;
	var buf = new Buffer(1032);
	buf.writeUInt32BE(data.cursize + 0x00100008, 0);
	buf.writeUInt32BE(sock.unreliableSendSequence++, 4);
	var i, src = new Uint8Array(data.data);
	for (i = 0; i < data.cursize; ++i)
		buf[8 + i] = src[i];
	sock.driverdata.send(buf, 0, data.cursize + 8, sock.addr[1], sock.addr[0]);
	return 1;
};

export const canSendMessage = function(sock)
{
	if (sock.driverdata == null)
		return;
	if (sock.sendNext === true)
		sendMessageNext(sock, false);
	return sock.canSend;
};

export const close = function(sock)
{
	if (sock.driverdata == null)
		return;
	sock.driverdata.data_socket = null;
	sock.driverdata = null;
};

const controlOnMessage = function(msg, rinfo)
{
	if (sv.state.server.active !== true)
		return;
	if (rinfo.size < 4)
		return;
	if ((msg[0] !== 0x80) || (msg[1] !== 0))
		return;
	if (((msg[2] << 8) + msg[3]) !== rinfo.size)
		return;
	var command = msg[4];
	var buf = new Buffer(1032), str, cursize;
	buf[0] = 0x80;
	buf[1] = 0;

	if (command === 2)
	{
		if (msg.toString('ascii', 5, 11) !== 'QUAKE\0')
			return;
		buf[4] = 0x83;
		str = state.myAddr + ':' + net.state.hostport;
		buf.write(str, 5, str.length, 'ascii');
		cursize = str.length + 5;
		buf[cursize++] = 0;
		str = net.cvr.hostname.string.substring(0, 15);
		buf.write(str, cursize, str.length, 'ascii');
		cursize += str.length;
		buf[cursize++] = 0;
		str =  pr.getString(pr.state.globals_int[pr.globalvars.mapname]);
		buf.write(str, cursize, str.length, 'ascii');
		cursize += str.length;
		buf[cursize++] = 0;
		buf[cursize++] = net.state.activeconnections;
		buf[cursize++] = sv.state.svs.maxclients;
		buf[cursize++] = 3;
		buf[2] = cursize >> 8;
		buf[3] = cursize & 255;
		state.controlsocket.send(buf, 0, cursize, rinfo.port, rinfo.address);
		return;
	}

	var i;

	if (command === 3)
	{
		var playerNumber = msg[5];
		if (playerNumber == null)
			return;
		var activeNumber = -1, client;
		for (i = 0; i < sv.state.svs.maxclients; ++i)
		{
			client = sv.state.svs.clients[i];
			if (client.active !== true)
				continue;
			if (++activeNumber === playerNumber)
				break;
		}
		if (i === sv.state.svs.maxclients)
			return;
		buf[4] = 0x84;
		buf[5] = playerNumber;
		str = sv.getClientName(client);
		buf.write(str, 6, str.length, 'ascii');
		cursize = str.length + 6;
		buf[cursize++] = 0;
		buf.writeUInt32LE(client.colors, cursize);
		buf.writeInt32LE(client.edict.v_float[pr.entvars.frags] >> 0, cursize + 4);
		buf.writeInt32LE((sys.floatTime() - client.netconnection.connecttime) >> 0, cursize + 8);
		cursize += 12;
		str = client.netconnection.address;
		buf.write(str, cursize, str.length, 'ascii');
		cursize += str.length;
		buf[cursize++] = 0;
		buf[2] = cursize >> 8;
		buf[3] = cursize & 255;
		state.controlsocket.send(buf, 0, cursize, rinfo.port, rinfo.address);
		return;
	}

	if (command === 4)
	{
		var prevCvarName = msg.toString('ascii', 5).slice('\0')[0];
		if (prevCvarName.length !== 0)
		{
			for (i = 0; i < cvar.vars.length; ++i)
			{
				if (cvar.vars[i].name === prevCvarName)
					break;
			}
			if (i === cvar.vars.length)
				return;
			++i;
		}
		else
			i = 0;
		var v;
		for (; i < cvar.vars.length; ++i)
		{
			v = cvar.vars[i];
			if (v.server === true)
				break;
		}
		buf[4] = 0x85;
		if (i >= cvar.vars.length)
		{
			buf[2] = 0;
			buf[3] = 5;
			state.controlsocket.send(buf, 0, 5, rinfo.port, rinfo.address);
			return;
		}
		str = v.name;
		buf.write(str, 5, str.length, 'ascii');
		cursize = str.length + 5;
		buf[cursize++] = 0;
		str = v.string;
		buf.write(str, cursize, str.length, 'ascii');
		cursize += str.length;
		buf[cursize++] = 0;
		buf[2] = cursize >> 8;
		buf[3] = cursize & 255;
		state.controlsocket.send(buf, 0, cursize, rinfo.port, rinfo.address);
		return;
	}

	if (command !== 1)
		return;
	if (msg.toString('ascii', 5, 11) !== 'QUAKE\0')
		return;

	if (msg[11] !== 3)
	{
		buf[2] = 0;
		buf[3] = 28;
		buf[4] = 0x82;
		buf.write('Incompatible version.\n\0', 5, 23);
		state.controlsocket.send(buf, 0, 28, rinfo.port, rinfo.address);
		return;
	}
	var s;
	for (i = 0; i < net.activeSockets.length; ++i)
	{
		s = net.activeSockets[i];
		if (s.disconnected === true)
			continue;
		if (net.state.drivers[s.driver].name !== "datagram")
			continue;
		if (rinfo.address !== s.addr[0])
			continue;
		if ((rinfo.port !== s.addr[1]) || ((sys.floatTime() - s.connecttime) >= 2.0))
		{
			net.close(s);
			return;
		}
		buf[2] = 0;
		buf[3] = 9;
		buf[4] = 0x81;
		buf.writeUInt32LE(s.driverdata.data_port, 5);
		state.controlsocket.send(buf, 0, 9, rinfo.port, rinfo.address);
		return;
	}
	for (i = 0; i < state.sockets.length; ++i)
	{
		s = state.sockets[i];
		if ((s.data_port != null) && (s.data_socket == null))
			break;
	}
	if ((i === state.sockets.length) || ((net.state.activeconnections + state.acceptsockets.length) >= sv.state.svs.maxclients))
	{
		buf[2] = 0;
		buf[3] = 22;
		buf[4] = 0x82;
		buf.write('Server is full.\n\0', 5, 17);
		state.controlsocket.send(buf, 0, 22, rinfo.port, rinfo.address);
		return;
	}
	state.acceptsockets.push([rinfo.address, rinfo.port]);
};

const dgramOnError = function(e)
{
	this.data_port = null;
	if (this.data_socket != null)
		net.close(this.data_socket);
};

const dgramOnListening = function()
{
	this.data_port = this.address().port;
};

const dgramOnMessage = function(msg, rinfo)
{
	if (this.data_socket == null)
		return;
	var addr = this.data_socket.addr;
	if ((rinfo.address !== addr[0]) || (rinfo.port !== addr[1]))
		return;
	if (rinfo.size < 8)
		return;
	if ((msg[0] & 0x80) !== 0)
		return;
	this.data_socket.messages.push(msg);
};