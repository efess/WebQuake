import ISocket from '../../../engine/interfaces/net/ISocket'
import IDatagram from '../../../engine/interfaces/net/IDatagram'
import * as net from '../../../engine/net'

export const name: string = "websocket"
export var initialized: boolean = false;
export var available: boolean = false;

export const init = () => { 
	if(typeof window === "undefined")
		return
	if ((window['WebSocket'] == null) || (document.location.protocol === 'https:'))
		return;
	available = true;
	return true;
};
export const listen = () => {}
export const connect = (host: string): any =>
{
	if (host.length <= 5)
		return null
	if (host.charCodeAt(5) === 47)
		return null
	if (host.substring(0, 5) !== 'ws://')
		return null
	host = 'ws://' + host.split('/')[2];
	var sock = net.newQSocket();
	sock.disconnected = true;
	sock.receiveMessage = []
	sock.address = host;
	try
	{
		sock.driverdata = new WebSocket(host, 'quake');
	}
	catch (e)
	{
		return null;
	}
	sock.driverdata.data_socket = sock;
	sock.driverdata.binaryType = 'arraybuffer';
	sock.driverdata.onerror = onError;
	sock.driverdata.onmessage = onMessage;
	net.state.newsocket = sock;
	return 0;
};

export const checkNewConnections = (): ISocket => {
	return null
}

export const getMessage = function(sock: ISocket)
{
	if (sock.driverdata == null)
		return -1;
	if (sock.driverdata.readyState !== 1)
		return -1;
	if (sock.receiveMessage.length === 0)
		return 0;
	var message = sock.receiveMessage.shift();
	net.state.message.cursize = message.length - 1;
	(new Uint8Array(net.state.message.data)).set(message.subarray(1));
	return message[0];
};

export const sendMessage = function(sock: ISocket, data: IDatagram)
{
	if (sock.driverdata == null)
		return -1;
	if (sock.driverdata.readyState !== 1)
		return -1;
	var buf = new ArrayBuffer(data.cursize + 1), dest = new Uint8Array(buf);
	dest[0] = 1;
	dest.set(new Uint8Array(data.data, 0, data.cursize), 1);
	sock.driverdata.send(buf);
	return 1;
};

export const sendUnreliableMessage = function(sock: ISocket, data: IDatagram)
{
	if (sock.driverdata == null)
		return -1;
	if (sock.driverdata.readyState !== 1)
		return -1;
	var buf = new ArrayBuffer(data.cursize + 1), dest = new Uint8Array(buf);
	dest[0] = 2;
	dest.set(new Uint8Array(data.data, 0, data.cursize), 1);
	sock.driverdata.send(buf);
	return 1;
};

export const canSendMessage = function(sock: ISocket)
{
	if (sock.driverdata == null)
		return;
	if (sock.driverdata.readyState === 1)
		return true;
};

export const close = function(sock: ISocket)
{
	if (sock.driverdata != null)
		sock.driverdata.close(1000);
};

export const checkForResend = function()
{
	if (net.state.newsocket.driverdata.readyState === 1)
		return 1;
	if (net.state.newsocket.driverdata.readyState !== 0)
		return -1;
};

export const onError = function()
{
	net.close(this.data_socket);
};

export const onMessage = function(message)
{
	var data = message.data;
	if (typeof(data) === 'string')
		return;
	if (data.byteLength > 8000)
		return;
	this.data_socket.receiveMessage.push(new Uint8Array(data));
};