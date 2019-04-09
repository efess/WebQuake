import * as http from 'http'
import * as host from '../../../engine/host'
import * as pr from '../../../engine/pr'
import * as con from '../../../engine/console'
import * as net from '../../../engine/net'
import * as sv from '../../../engine/sv'
import * as sys from '../sys'
import * as url from 'url'
import * as q from '../../../engine/q'
import * as cvar from '../../../engine/cvar'

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

const getCvars = () => {
  return cvar.vars
    .filter(v => v.server === true)
    .map(v => ({rule: v.name, value: v.string}))
}

const getActivePlayers = () => {
  const time = sys.floatTime()
  const players = []

  for (let i = 0; i < sv.state.svs.maxclients; ++i) {
    const client = sv.state.svs.clients[i];
    if (client.active !== true)
      continue;
    const seconds = time - client.netconnection.connecttime
    players.push({
      name: htmlSpecialChars(sv.getClientName(client)),
      colors: client.colors,
      frags: client.edict.v_float[pr.entvars.frags].toFixed(0),
      connectedTime: seconds,
    })
  }
  return players
}
const createQueryResponse = () => {
  return {
    hostname: htmlSpecialChars(net.cvr.hostname.string),
    maxPlayers: sv.state.svs.maxclients.toString(),
    players: getActivePlayers(),
    map: pr.getString(pr.state.globals_int[pr.globalvars.mapname]),
    serverSettings: JSON.stringify(getCvars()),
    version: 3
  }
}

const sendOptions = (request, response) => {
  response.statusCode = 200;
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization');
  response.end();
}

const onRequest = (request, response) => {
	if (request.method === 'OPTIONS') {
    return sendOptions(request, response)
  }
  if (sv.state.server.active !== true)
  {
    response.statusCode = 503;
    response.end();
    return;
  }
  const pathParams = url.parse(request.url).pathname.split('/');
  if (pathParams.length === 0) {
		response.statusCode = 501;
		response.end();
		return;
  } else if (pathParams[1] === 'status') {
    if(request.method === 'GET' || request.method === 'HEAD') {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json; charset=UTF-8');
      if (request.method !== 'HEAD') {
        response.write(JSON.stringify(createQueryResponse()))
      }
      response.end();
      return
    }
  } else if (pathParams[1] === 'rcon') {
		var data;
		try
		{
			data = decodeURIComponent(pathParams.slice(2).join('/')).split('\n')[0];
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


export const createHttpServer = (port) => {
  const server = http.createServer();
  server.listen(port);
  server.on('request', onRequest);

  return server
}

export const registerWithMaster = () => {
	const gameVar = cvar.findVar('game')
	const masterServer = host.cvr.masterserver.string
	if (!masterServer) {
		return
	}
	const serverPost = JSON.stringify({
		game: gameVar && gameVar.value || 'id1',
		gameType: 'what is this field for?',
		name: net.cvr.hostname.string,
		hostdomain: net.cvr.hostdomain.string,
		port: net.state.hostport,
		location: host.cvr.location.string,
		description: host.cvr.description.string
	})
	const options = {
		...url.parse(masterServer + '/api/server'),
		method: 'POST',
		headers: {
			'Content-Type': 'application/json; charset=utf-8'
		}
	}
	const postReq = http.request(options, resp => {
		resp.on('data', () => {
      con.print('Updated master server\n');
		});
    resp.on('end', () => {
			con.print('No more data in response.\n');
    });
	}).on("error", (err) => {
		con.print('Error updated master server: ' + err.message + '\n');
	});

  // post the data
  postReq.write(serverPost);
	postReq.end();
}