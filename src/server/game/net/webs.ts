import ISocket from '../../../engine/interfaces/net/ISocket'
import IDatagram from '../../../engine/interfaces/net/IDatagram'
import * as sv from '../../../engine/sv'
import * as host from '../../../engine/host'
import * as pr from '../../../engine/pr'
import * as com from '../../../engine/com'
import * as net from '../../../engine/net'
import * as q from '../../../engine/q'
import * as cvar from '../../../engine/cvar'
import * as websocket from 'websocket'
import * as sys from '../sys'
import * as http from 'http'
import * as url from 'url'

export const name = "websocket"
export var initialized = false
export var available = true
export const state = {
  server: null,
  http: null,
  acceptsockets: [],
  colors: []
}

// not implemented client specific functions
export const connect = (host: string): ISocket => {
  return null
}
export const checkForResend = (): number => {
  return 0
}
export const canSendMessage = (sock: ISocket) => {
  return true
}

export const init = function()
{
	// var palette = await com.loadFile('gfx/palette.lmp');
	// if (palette == null)
	// 	sys.error('Couldn\'t load gfx/palette.lmp');
	// var pal = new Uint8Array(palette);
	// var pal = new Uint8Array(palette), i, src = 24, c;
	// for (i = 0; i <= 13; ++i)
	// {
	// 	WEBS.colors[i] = pal[src].toString() + ',' + pal[src + 1].toString() + ',' + pal[src + 2].toString();
	// 	src += 48;
	// }

	state.server = new websocket.server;
	state.server.on('request', serverOnRequest);

	return true;
};

export const listen = function()
{
	if (net.state.listening !== true)
	{
		state.server.unmount();
		if (state.http == null)
			return;
    state.http.close();
    state.http = null;
		return;
	}
	try
	{
		state.http = http.createServer();
		state.http.listen(net.state.hostport);
		state.http.on('request', httpOnRequest);
		state.server.mount({httpServer: state.http, maxReceivedMessageSize: 8192});
	}
	catch (e)
	{
		net.state.listening = false;
		return;
	}
};

export const checkNewConnections = (): ISocket => {
	if (state.acceptsockets.length === 0)
		return;
	var sock = net.newQSocket();
	var connection = state.acceptsockets.shift();
	sock.driverdata = connection;
	sock.receiveMessage = [];
	sock.address = connection.socket.remoteAddress;
	connection.data_socket = sock;
	connection.on('message', connectionOnMessage);
	connection.on('close', connectionOnClose);
	return sock;
};

export const getMessage = (sock: ISocket) => {
	if (sock.driverdata == null)
		return -1;
	if (sock.driverdata.closeReasonCode !== -1)
		return -1;
	if (sock.receiveMessage.length === 0)
		return 0;
	var src = sock.receiveMessage.shift(), dest = new Uint8Array(net.state.message.data);
	net.state.message.cursize = src.length - 1;
	var i;
	for (i = 1; i < src.length; ++i)
		dest[i - 1] = src[i];
	return src[0];
}

export const sendMessage = (sock: ISocket, data: IDatagram) => {
	if (sock.driverdata == null)
		return -1;
	if (sock.driverdata.closeReasonCode !== -1)
		return -1;
	var src = new Uint8Array(data.data), dest = Buffer.alloc(data.cursize + 1), i;
	dest[0] = 1;
	var i;
	for (i = 0; i < data.cursize; ++i)
		dest[i + 1] = src[i];
	sock.driverdata.sendBytes(dest);
	return 1;
}

export const sendUnreliableMessage = (sock: ISocket, data: IDatagram) => {
	if (sock.driverdata == null)
		return -1;
	if (sock.driverdata.closeReasonCode !== -1)
		return -1;
	var src = new Uint8Array(data.data), dest = Buffer.alloc(data.cursize + 1), i;
	dest[0] = 2;
	var i;
	for (i = 0; i < data.cursize; ++i)
		dest[i + 1] = src[i];
	sock.driverdata.sendBytes(dest);
	return 1;
};

export const cnSendMessage = (sock: ISocket) => {
	if (sock.driverdata == null)
		return;
	if (sock.driverdata.closeReasonCode === -1)
		return true;
};

export const close = (sock: ISocket) => {
	if (sock.driverdata == null)
		return;
	if (sock.driverdata.closeReasonCode !== -1)
		return;
	sock.driverdata.drop(1000);
	sock.driverdata = null;
};

const connectionOnMessage = function(message)
{
	if (message.type !== 'binary')
		return;
	if (message.binaryData.length > 8000)
		return;
	this.data_socket.receiveMessage.push(message.binaryData);
};

const connectionOnClose = function()
{
	net.close(this.data_socket);
};

const htmlSpecialChars = function(str)
{
	var out = [], i, c;
	for (i = 0; i < str.length; ++i)
	{
		c = str.charCodeAt(i);
		switch (c)
		{
			case 38: out[out.length] = '&amp;'; continue;
			case 60: out[out.length] = '&lt;'; continue;
			case 62: out[out.length] = '&gt;'; continue;
		}
		out[out.length] = String.fromCharCode(c);
	}
	return out.join('');
};

const httpOnRequest = function(request, response)
{
	if (request.method === 'OPTIONS')
	{
		response.statusCode = 200;
		response.setHeader('Access-Control-Allow-Origin', '*');
		response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
		response.setHeader('Access-Control-Allow-Headers', 'Authorization');
		response.end();
		return;
	}
	var head = request.method === 'HEAD';
	if ((request.method !== 'GET') && (head !== true))
	{
		response.statusCode = 501;
		response.end();
		return;
	}
	var pathname = url.parse(request.url).pathname.split('/');
	var path = '';
	if (pathname.length >= 2)
		path = pathname[1].toLowerCase();
	var i, text;
	if (path.length === 0)
	{
		if (sv.state.server.active !== true)
		{
			response.statusCode = 503;
			response.end();
			return;
		}
		response.statusCode = 200;
		response.setHeader('Content-Type', 'text/html; charset=UTF-8');
		if (head === true)
		{
			response.end();
			return;
		}
		var hostname = htmlSpecialChars(net.cvr.hostname.string);
		response.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>');
		response.write(hostname);
		response.write('</title>');
		if (host.cvr.rcon_password.string.length !== 0)
		{
			response.write('<script type="text/javascript">function rcon() {\n');
			response.write('var rcon = document.getElementById(\'rcon\').value, password = document.getElementById(\'password\').value;\n');
			response.write('if ((rcon.length === 0) || (password.length === 0)) {return;}\n');
			response.write('try {rcon = encodeURIComponent(rcon); password = \'Basic \' + btoa(\'quake:\' + password);} catch (e) {return;}\n');
			response.write('var xhr = new XMLHttpRequest(); xhr.open(\'HEAD\', \'/rcon/\' + rcon); xhr.setRequestHeader(\'Authorization\', password); xhr.send();\n');
			response.write('}</script>');
		}
		response.write('</head><body><h1>');
		response.write(hostname);
		response.write(' - ');
		response.write(htmlSpecialChars(pr.getString(pr.state.globals_int[pr.globalvars.mapname])));
		response.write(' (');
		response.write(net.state.activeconnections.toString());
		response.write('/');
		response.write(sv.state.svs.maxclients.toString());
		response.write(')</h1><table border="1"><tr><th>Name</th><th>Shirt</th><th>Pants</th><th>Frags</th><th>Time</th></tr>');
		var client, time = sys.floatTime(), seconds;
		for (i = 0; i < sv.state.svs.maxclients; ++i)
		{
			client = sv.state.svs.clients[i];
			if (client.active !== true)
				continue;
			response.write('<tr><td>');
			response.write(htmlSpecialChars(sv.getClientName(client)))
			response.write('</td><td>');
			response.write((client.colors >> 4).toString());
			response.write('</td><td>');
			response.write((client.colors & 15).toString());
			response.write('</td><td>');
			response.write(client.edict.v_float[pr.entvars.frags].toFixed(0));
			response.write('</td><td>');
			seconds = Math.floor(time - client.netconnection.connecttime);
			response.write(Math.floor(seconds / 60.0).toString());
			response.write(':');
			seconds = Math.floor(seconds % 60.0).toString();
			if (seconds.length === 1)
				response.write('0');
			response.write(seconds);
			response.write('</td></tr>');
		}
		response.write('</table>');
		if (host.cvr.rcon_password.string.length !== 0)
			response.write('<p>Rcon: <input type="text" id="rcon"> <input type="password" id="password"> <input type="button" value="Send" onclick="rcon()"></p>');
		response.end('</body></html>');
		return;
	}
	if (path === 'server_info')
	{
		if (sv.state.server.active !== true)
		{
			response.statusCode = 503;
			response.end();
			return;
		}
		response.statusCode = 200;
		response.setHeader('Content-Type', 'application/json; charset=UTF-8');
		if (head === true)
			response.end();
		else
		{
			response.end(JSON.stringify({
				hostName: net.cvr.hostname.string,
				levelName: pr.getString(pr.state.globals_int[pr.globalvars.mapname]),
				currentPlayers: net.state.activeconnections,
				maxPlayers: sv.state.svs.maxclients,
				protocolVersion: 2
			}));
		}
		return;
	}
	if (path === 'player_info')
	{
		if (sv.state.server.active !== true)
		{
			response.statusCode = 503;
			response.end();
			return;
		}
		var client;
		if ((pathname.length <= 2) || (pathname[2] === ''))
		{
			response.statusCode = 200;
			response.setHeader('Content-Type', 'application/json; charset=UTF-8');
			response.write('[');
			text = [];
			for (i = 0; i < sv.state.svs.maxclients; ++i)
			{
				client = sv.state.svs.clients[i];
				if (client.active !== true)
					continue;
				text[text.length] = JSON.stringify({
					name: sv.getClientName(client),
					colors: client.colors,
					frags: (client.edict.v_float[pr.entvars.frags]) >> 0,
					connectTime: sys.floatTime() - client.netconnection.connecttime,
					address: client.netconnection.address
				});
			}
			response.write(text.join(','));
			response.end(']');
			return;
		}
		var playerNumber = q.atoi(pathname[2]);
		var activeNumber = -1;
		for (i = 0; i < sv.state.svs.maxclients; ++i)
		{
			client = sv.state.svs.clients[i];
			if (client.active !== true)
				continue;
			if (++activeNumber === playerNumber)
				break;
		}
		if (i === sv.state.svs.maxclients)
		{
			response.statusCode = 404;
			response.end();
			return;
		}
		response.statusCode = 200;
		response.setHeader('Content-Type', 'application/json; charset=UTF-8');
		if (head === true)
		{
			response.end();
			return;
		}
		response.end(JSON.stringify({
			name: sv.getClientName(client),
			colors: client.colors,
			frags: (client.edict.v_float[pr.entvars.frags]) >> 0,
			connectTime: sys.floatTime() - client.netconnection.connecttime,
			address: client.netconnection.address
		}));
		return;
	}
	if (path === 'rule_info')
	{
		var name, v;
		if (pathname.length >= 3)
		{
			name = pathname[2].toLowerCase();
			if (name.length !== 0)
			{
				for (i = 0; i < cvar.vars.length; ++i)
				{
					v = cvar.vars[i];
					if (v.server !== true)
						continue;
					if (v.name !== name)
						continue;
					response.statusCode = 200;
					response.setHeader('Content-Type', 'application/json; charset=UTF-8');
					if (head === true)
						response.end();
					else
						response.end(JSON.stringify({rule: v.name, value: v.string}));
					return;
				}
				response.statusCode = 404;
				response.end();
				return;
			}
		}
		response.statusCode = 200;
		response.setHeader('Content-Type', 'application/json; charset=UTF-8');
		if (head === true)
		{
			response.end();
			return;
		}
		response.write('[');
		text = [];
		for (i = 0; i < cvar.vars.length; ++i)
		{
			v = cvar.vars[i];
			if (v.server === true)
				text[text.length] = JSON.stringify({rule: v.name, value: v.string});
		}
		response.write(text.join(','));
		response.end(']');
		return;
	}
	if (path === 'rcon')
	{
		var data;
		try
		{
			data = decodeURIComponent(pathname.slice(2).join('/')).split('\n')[0];
		}
		catch (e)
		{
			response.statusCode = 400;
			response.end();
			return;
		}
		if (data.length === 0)
		{
			response.statusCode = 400;
			response.end();
			return;
		}
		if (request.headers.authorization == null)
		{
			response.statusCode = 401;
			response.setHeader('WWW-Authenticate', 'Basic realm="Quake"');
			response.end();
			return;
		}
		var password = request.headers.authorization;
		if (password.substring(0, 6) !== 'Basic ')
		{
			response.statusCode = 403;
			response.end();
			return;
		}
		try
		{
			password = (Buffer.from(password.substring(6), 'base64')).toString('ascii');
		}
		catch (e)
		{
			response.statusCode = 403;
			response.end();
			return;
		}
		if (password.substring(0, 6) !== 'quake:')
		{
			response.statusCode = 403;
			response.end();
			return;
		}
		response.statusCode = (host.remoteCommand(request.connection.remoteAddress, data, password.substring(6)) === true) ? 200 : 403;
		response.end();
		return;
	};
	response.statusCode = 404;
	response.end();
};

const serverOnRequest = (request) => {
	if (sv.state.server.active !== true)
	{
		request.reject();
		return;
	}
	if (request.requestedProtocols[0] !== 'quake')
	{
		request.reject();
		return;
	}
	if ((net.state.activeconnections + state.acceptsockets.length) >= sv.state.svs.maxclients)
	{
		request.reject();
		return;
	}
	var i, s;
	for (i = 0; i < net.activeSockets.length; ++i)
	{
		s = net.activeSockets[i];
		if (s.disconnected === true)
			continue;
		if (net.state.drivers[s.driver].name !== "websocket")
			continue;
		if (request.remoteAddress !== s.address)
			continue;
		net.close(s);
		break;
	}
	state.acceptsockets.push(request.accept('quake', request.origin));
};