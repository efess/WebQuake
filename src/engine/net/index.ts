import * as sys from '../sys'
import * as con from '../console'
import * as cl from '../cl'
import * as host from '../host'
import * as sv from '../sv'
import * as webs from './webs'
import * as loop from './loop'
import * as cvar from '../cvar'

const activeSockets: any[] = [];

export const cvr = {

} as any
export const state = {
  message: {data: new ArrayBuffer(8192), cursize: 0},
  activeconnections: 0
} as any

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
		address: 'UNSET ADDRESS'
	};
	return activeSockets[i];
};

export const connect = function(host)
{
	state.time = sys.floatTime();

	if (host === 'local')
	{
		state.driverlevel = 0;
		return loop.connect(host);
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

export const init = function()
{
	state.time = sys.floatTime();

	cvr.messagetimeout = cvar.registerVariable('net_messagetimeout', '300');
	cvr.hostname = cvar.registerVariable('hostname', 'UNNAMED');

	state.drivers = [loop, webs];
	for (state.driverlevel = 0; state.driverlevel < state.drivers.length; ++state.driverlevel)
		state.drivers[state.driverlevel].initialized = state.drivers[state.driverlevel].init();
};

export const shutdown = function()
{
	state.time = sys.floatTime();
	for (var i = 0; i < activeSockets.length; ++i)
		close(activeSockets[i]);
};