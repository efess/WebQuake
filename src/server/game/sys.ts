import * as q from '../../engine/q'
import * as host from '../../engine/host'
import * as com from '../../engine/com'
import * as _assetStore from './assetStore'
import * as webs from './net/webs'
import * as datagram from './net/datagram'

export const assetStore = _assetStore
var commandBuffer = ''
var oldTime = null

export const quit = (): void => {
	process.exit(0);
}

export const print = (text: string): void => {
	process.stdout.write(text);
}

export const error = (text: string): void => {
	console.log(text);
	throw new Error(text);
}

export const floatTime = (): number =>{
	var time = process.hrtime(oldTime);
	return time[0] + (time[1] / 1000000000.0);
}

export const getExternalCommand = (): string => {
	var text = commandBuffer;
	if (text.length === 0)
		return;
  commandBuffer = '';
	return text;
}

const onConsoleInput = (data) => {
  commandBuffer += q.memstr(data);
}

function getNanoSecTime() {
  var hrTime = process.hrtime();
  return hrTime[0] * 1000000000 + hrTime[1];
}

const startGameLoop = () => {
	const _gameLoop = async () => {
		try{
//			const start = getNanoSecTime()
			await host.frame();
			// const durr = getNanoSecTime() - start
			// if (durr > 10000000) {
			// 	console.log(durr)
			// }
		} 
		catch(e) {
			if(e && e.message)
			{
				console.log(e && e.message)
				console.log(e && e.stack)
			}
    }
    
		return setTimeout(_gameLoop, host.cvr.ticrate.value * 1000.0);
  }
  _gameLoop()
}

export const init = async () => {
	com.initArgv(process.argv.slice(1));
	oldTime = process.hrtime();
  print('Host.Init\n');
  
  await host.init(true, assetStore, [webs, datagram])
  
	process.stdin.resume();
	process.stdin.on('data', onConsoleInput);
	process.nextTick(startGameLoop);
	q.state.isNaN = (val) => Number.isNaN(val)
}
