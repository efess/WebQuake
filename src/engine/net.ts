import * as sys from './sys'
import * as con from './console'
import * as cl from './cl'
import * as host from './host'
import * as sv from './sv'
import * as cvar from './cvar'
import * as cmd from './cmd'
import * as com from './com'
import * as q from './q'
import ISocket from './interfaces/net/ISocket'
import IDatagram from './interfaces/net/IDatagram'
import INetworkDriver from './interfaces/net/INetworkDriver'

export const activeSockets: ISocket[] = [];

export const cvr = {

} as any

interface IState {
	listening: boolean,
	message: IDatagram,
	activeconnections: number,
	drivers: INetworkDriver[],
	time: number,
	driverlevel: number,
	newsocket: ISocket,
	reps: number,
	start_time: number,
	hostport: number,
	state: boolean
}

export let state: IState = {
	listening: false,
	drivers: [],
  message: {data: new ArrayBuffer(8192), cursize: 0},
	activeconnections: 0,
	time: 0,
	driverlevel: 0,
	newsocket: null,
	reps: 0,
	start_time: 0,
	hostport: 26000,
	state: false
}

export const initState = () => {
	state = {
		listening: false,
		drivers: [],
		message: {data: new ArrayBuffer(8192), cursize: 0},
		activeconnections: 0,
		time: 0,
		driverlevel: 0,
		newsocket: null,
		reps: 0,
		start_time: 0,
		hostport: 26000,
		state: false
	}
}

export const newQSocket = function()
{
	var i;
	for (i = 0; i < activeSockets.length; ++i)
	{
		if (activeSockets[i].disconnected === true)
			break;
	}

	activeSockets[i] = {
		connecttime: state.time,
		lastMessageTime: state.time,
		driver: state.driverlevel,
		address: 'UNSET ADDRESS',
		disconnected: false,
		canSend: false,
		receiveMessage: null,
		receiveMessageLength: 0,
		driverdata: null,
		sendMessage: null,
		sendMessageLength: 0,
		lastSendTime: 0,
		ackSequence: 0,
		sendSequence: 0,
		unreliableSendSequence: 0,
		receiveSequence: 0,
		unreliableReceiveSequence: 0,
		addr: '',
		messages: null
	};
	return activeSockets[i];
};

export const connect = function(host)
{
	state.time = sys.floatTime();

	if (host === 'local')
	{
		state.driverlevel = 0;
		return state.drivers[state.driverlevel].connect(host);
	}

	var dfunc, ret;
	for (state.driverlevel = 1; state.driverlevel < state.drivers.length; ++state.driverlevel)
	{
		dfunc = state.drivers[state.driverlevel];
		if (dfunc.initialized !== true)
			continue;
		ret = dfunc.connect(host);
		if (ret === 0)
		{
			cl.cls.state = cl.ACTIVE.connecting;
			con.print('trying...\n');
			state.start_time = state.time;
			state.reps = 0;
			throw 'NET.Connect';
		}
		if (ret != null)
			return ret;
	}
};

export const checkForResend = async function()
{
	state.time = sys.floatTime();
	var dfunc = state.drivers[state.newsocket.driver];
	if (state.reps <= 2)
	{
		if ((state.time - state.start_time) >= (2.5 * (state.reps + 1)))
		{
			con.print('still trying...\n');
			++state.reps;
		}
	}
	else if (state.reps === 3)
	{
		if ((state.time - state.start_time) >= 10.0)
		{
			close(state.newsocket);
			cl.cls.state = cl.ACTIVE.disconnected;
			con.print('No Response\n');
			await host.error('NET.CheckForResend: connect failed\n');
		}
	}
	var ret = dfunc.checkForResend();
	if (ret === 1)
	{
		state.newsocket.disconnected = false;
		cl.connect(state.newsocket);
	}
	else if (ret === -1)
	{
		state.newsocket.disconnected = false;
		close(state.newsocket);
		cl.cls.state = cl.ACTIVE.disconnected;
		con.print('Network Error\n');
		await host.error('NET.CheckForResend: connect failed\n');
	}
};

export const checkNewConnections = function()
{
	state.time = sys.floatTime();
	var dfunc, ret;
	for (state.driverlevel = 0; state.driverlevel < state.drivers.length; ++state.driverlevel)
	{
		dfunc = state.drivers[state.driverlevel];
		if (dfunc.initialized !== true)
			continue;
		ret = dfunc.checkNewConnections();
		if (ret != null)
			return ret;
	}
};

export const close = function(sock)
{
	if (sock == null)
		return;
	if (sock.disconnected === true)
		return;
	state.time = sys.floatTime();
	state.drivers[sock.driver].close(sock);
	sock.disconnected = true;
};

export const getMessage = function(sock)
{
	if (sock == null)
		return -1;
	if (sock.disconnected === true)
	{
		con.print('NET.GetMessage: disconnected socket\n');
		return -1;
	}
	state.time = sys.floatTime();
	var ret = state.drivers[sock.driver].getMessage(sock);
	if (sock.driver !== 0)
	{
		if (ret === 0)
		{
			if ((state.time - sock.lastMessageTime) > cvr.messagetimeout.value)
			{
				close(sock);
				return -1;
			}
		}
		else if (ret > 0)
			sock.lastMessageTime = state.time;
	}
	return ret;
};

export const sendMessage = function(sock, data)
{
	if (sock == null)
		return -1;
	if (sock.disconnected === true)
	{
		con.print('NET.SendMessage: disconnected socket\n');
		return -1;
	}
	state.time = sys.floatTime();
	return state.drivers[sock.driver].sendMessage(sock, data);
};

export const sendUnreliableMessage = function(sock, data)
{
	if (sock == null)
		return -1;
	if (sock.disconnected === true)
	{
		con.print('NET.SendUnreliableMessage: disconnected socket\n');
		return -1;
	}
	state.time = sys.floatTime();
	return state.drivers[sock.driver].sendUnreliableMessage(sock, data);
};

export const canSendMessage = function(sock)
{
	if (sock == null)
		return;
	if (sock.disconnected === true)
		return;
	state.time = sys.floatTime();
	return state.drivers[sock.driver].canSendMessage(sock);
};

export const sendToAll = function(data)
{
	var i, count = 0, state1 = [], state2 = [];
	for (i = 0; i < sv.state.svs.maxclients; ++i)
	{
		host.state.client = sv.state.svs.clients[i];
		if (host.state.client.netconnection == null)
			continue;
		if (host.state.client.active !== true)
		{
			state1[i] = state2[i] = true;
			continue;
		}
		if (host.state.client.netconnection.driver === 0)
		{
			sendMessage(host.state.client.netconnection, data);
			state1[i] = state2[i] = true;
			continue;
		}
		++count;
		state1[i] = state2[i] = false;
	}
	var start = sys.floatTime();
	for (; count !== 0; )
	{
		count = 0;
		for (i = 0; i < sv.state.svs.maxclients; ++i)
		{
			host.state.client = sv.state.svs.clients[i];
			if (state1[i] !== true)
			{
				if (canSendMessage(host.state.client.netconnection) === true)
				{
					state1[i] = true;
					sendMessage(host.state.client.netconnection, data);
				}
				else
					getMessage(host.state.client.netconnection);
				++count;
				continue;
			}
			if (state2[i] !== true)
			{
				if (canSendMessage(host.state.client.netconnection) === true)
					state2[i] = true;
				else
					getMessage(host.state.client.netconnection);
				++count;
			}
		}
		if ((sys.floatTime() - start) > 5.0)
			return count;
	}
	return count;
};

const listen_f = () => {
	if (cmd.state.argv.length !== 2)
	{
		con.print('"listen" is "' + (state.listening === true ? 1 : 0) + '"\n');
		return;
	}
	var listening = (q.atoi(cmd.state.argv[1]) !== 0);
	if (state.listening === listening)
		return;
	state.listening = listening;
	
	for (state.driverlevel = 0; state.driverlevel < state.drivers.length; ++state.driverlevel)
	{
		const driver = state.drivers[state.driverlevel]
		driver.initialized = driver.init();
		if (driver.initialized === true)
			driver.listen();
	}
}

const maxPlayers_f = function()
{
	if (cmd.state.argv.length !== 2)
	{
		con.print('"maxplayers" is "' + sv.state.svs.maxclients + '"\n');
		return;
	}
	if (sv.state.server.active === true)
	{
		con.print('maxplayers can not be changed while a server is running.\n');
		return;
	}
	var n = q.atoi(cmd.state.argv[1]);
	if (n <= 0)
		n = 1;
	else if (n > sv.state.svs.maxclientslimit)
	{
		n = sv.state.svs.maxclientslimit;
		con.print('"maxplayers" set to "' + n + '"\n');
	}
	if ((n === 1) && (state.listening === true))
		cmd.state.text += 'listen 0\n';
	else if ((n >= 2) && (state.listening !== true))
		cmd.state.text += 'listen 1\n';
	sv.state.svs.maxclients = n;
	if (n === 1)
		cvar.set('deathmatch', '0');
	else
		cvar.set('deathmatch', '1');
};

const port_f = function()
{
	if (cmd.state.argv.length !== 2)
	{
		con.print('"port" is "' + state.hostport + '"\n');
		return;
	}
	var n = q.atoi(cmd.state.argv[1]);
	if ((n <= 0) || (n >= 65535))
	{
		con.print('Bad value, must be between 1 and 65534\n');
		return;
	}
	state.hostport = n;
	if (state.listening === true)
		cmd.state.text += 'listen 0\nlisten 1\n';
};

export const init = (drivers: INetworkDriver[]) => {
	state.time = sys.floatTime();

	cvr.messagetimeout = cvar.registerVariable('net_messagetimeout', '300');
	cvr.hostname = cvar.registerVariable('hostname', 'UNNAMED');
	cvr.connecthostport = cvar.registerVariable('connecthostport', '');
	cmd.addCommand('listen', listen_f);
	cmd.addCommand('maxplayers', maxPlayers_f);
	cmd.addCommand('port', port_f);

	state.drivers = drivers;
	for (state.driverlevel = 0; state.driverlevel < state.drivers.length; ++state.driverlevel)
	{
		state.drivers[state.driverlevel].initialized = state.drivers[state.driverlevel].init();
	}

	if (host.state.dedicated) {
		var i = com.checkParm('-port');
		if (i != null)
		{
			i = q.atoi(com.state.argv[i + 1]);
			if ((i > 0) && (i <= 65534))
				state.hostport = i;
		}
		state.listening = true;
		for (state.driverlevel = 0; state.driverlevel < state.drivers.length; ++state.driverlevel)
		{
			const driver = state.drivers[state.driverlevel]
			if (driver.initialized === true)
				driver.listen();
		}
	}
};

export const shutdown = function()
{
	state.time = sys.floatTime();
	for (var i = 0; i < activeSockets.length; ++i)
		close(activeSockets[i]);
};

export const registerWithMaster = () => {
	const webSocket = state.drivers.find(drv => drv.name === 'websocket')
	if (webSocket) {
		webSocket.registerWithMaster()
	}
}