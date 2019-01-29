import * as net from './index'
import * as sys from '../sys'

export const state = {
  client: null,
  server: null,
  localconnectpending: false
} as any

export const init = function()
{
	return true;
};

export const connect = function(host)
{
	if (host !== 'local')
		return;

	state.localconnectpending = true;

	if (state.client == null)
	{
		state.client = net.newQSocket();
		state.client.receiveMessage = new Uint8Array(new ArrayBuffer(8192));
		state.client.address = 'localhost';
	}
	state.client.receiveMessageLength = 0;
	state.client.canSend = true;

	if (state.server == null)
	{
		state.server = net.newQSocket();
		state.server.receiveMessage = new Uint8Array(new ArrayBuffer(8192));
		state.server.address = 'LOCAL';
	}
	state.server.receiveMessageLength = 0;
	state.server.canSend = true;

	state.client.driverdata = state.server;
	state.server.driverdata = state.client;

	return state.client;
};

export const checkNewConnections = function()
{
	if (state.localconnectpending !== true)
		return;
	state.localconnectpending = false;
	state.server.receiveMessageLength = 0;
	state.server.canSend = true;
	state.client.receiveMessageLength = 0;
	state.client.canSend = true;
	return state.server;
};

export const getMessage = function(sock)
{
	if (sock.receiveMessageLength === 0)
		return 0;
	var ret = sock.receiveMessage[0];
	var length = sock.receiveMessage[1] + (sock.receiveMessage[2] << 8);
	if (length > net.state.message.data.byteLength)
		sys.error('Loop.GetMessage: overflow');
	net.state.message.cursize = length;
	(new Uint8Array(net.state.message.data)).set(sock.receiveMessage.subarray(3, length + 3));
	sock.receiveMessageLength -= length;
	if (sock.receiveMessageLength >= 4)
	{
		var i;
		for (i = 0; i < sock.receiveMessageLength; ++i)
			sock.receiveMessage[i] = sock.receiveMessage[length + 3 + i];
	}
	sock.receiveMessageLength -= 3;
	if ((sock.driverdata != null) && (ret === 1))
		sock.driverdata.canSend = true;
	return ret;
};

export const sendMessage = function(sock, data)
{
	if (sock.driverdata == null)
		return -1;
	var bufferLength = sock.driverdata.receiveMessageLength;
	sock.driverdata.receiveMessageLength += data.cursize + 3;
	if (sock.driverdata.receiveMessageLength > 8192)
		sys.error('Loop.SendMessage: overflow');
	var buffer = sock.driverdata.receiveMessage;
	buffer[bufferLength] = 1;
	buffer[bufferLength + 1] = data.cursize & 0xff;
	buffer[bufferLength + 2] = data.cursize >> 8;
	buffer.set(new Uint8Array(data.data, 0, data.cursize), bufferLength + 3);
	sock.canSend = false;
	return 1;
};

export const sendUnreliableMessage = function(sock, data)
{
	if (sock.driverdata == null)
		return -1;
	var bufferLength = sock.driverdata.receiveMessageLength;
	sock.driverdata.receiveMessageLength += data.cursize + 3;
	if (sock.driverdata.receiveMessageLength > 8192)
		sys.error('Loop.SendMessage: overflow');
	var buffer = sock.driverdata.receiveMessage;
	buffer[bufferLength] = 2;
	buffer[bufferLength + 1] = data.cursize & 0xff;
	buffer[bufferLength + 2] = data.cursize >> 8;
	buffer.set(new Uint8Array(data.data, 0, data.cursize), bufferLength + 3);
	return 1;
};

export const canSendMessage = function(sock)
{
	if (sock.driverdata != null)
		return sock.canSend;
};

export const close = function(sock)
{
	if (sock.driverdata != null)
		sock.driverdata.driverdata = null;
	sock.receiveMessageLength = 0;
	sock.canSend = false;
	if (sock === state.client)
		state.client = null;
	else
		state.server = null;
};