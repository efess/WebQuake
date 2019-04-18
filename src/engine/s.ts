import * as cmd from './cmd'
import * as con from './console'
import * as com from './com'
import * as cvar from './cvar'
import * as host from './host'
import * as cl from './cl'
import * as mod from './mod'
import * as q from './q'
import * as vec from './vec'

export let state = {
} as any

let channels = [];
let context: any = null

let static_channels = [];
let ambient_channels = [];

const listener_origin = [0.0, 0.0, 0.0];
const listener_forward = [0.0, 0.0, 0.0];
const listener_right = [0.0, 0.0, 0.0];
const listener_up = [0.0, 0.0, 0.0];

let known_sfx = [];
export const cvr = {} as any

export const init = async function () {
	state = {}
	known_sfx = []
	channels = []
	context = null
	con.print('\nSound Initialization\n');
	cmd.addCommand('play', play);
	cmd.addCommand('playvol', playVol);
	cmd.addCommand('stopsound', stopAllSounds);
	cmd.addCommand('soundlist', soundList);
	cvr.nosound = cvar.registerVariable('nosound', (com.checkParm('-nosound') != null) ? '1' : '0');
	cvr.volume = cvar.registerVariable('volume', '0.7', true);
	cvr.precache = cvar.registerVariable('precache', '1');
	cvr.bgmvolume = cvar.registerVariable('bgmvolume', '1', true);
	cvr.ambient_level = cvar.registerVariable('ambient_level', '0.3');
	cvr.ambient_fade = cvar.registerVariable('ambient_fade', '100');

	// createBuffer is broken, disable Web Audio for now.
	/* if (window.AudioContext != null))
		S.context = new AudioContext();
	else if (window.webkitAudioContext != null)
		S.context = new webkitAudioContext(); */

	var i, ambient_sfx = ['water1', 'wind2'], ch, nodes;
	for (i = 0; i < ambient_sfx.length; ++i) {
		ch = { sfx: await precacheSound('ambience/' + ambient_sfx[i] + '.wav'), end: 0.0, master_vol: 0.0 };
		ambient_channels[i] = ch;
		if (await loadSound(ch.sfx) !== true)
			continue;
		if (ch.sfx.cache.loopstart == null) {
			con.print('Sound ambience/' + ch.sfx.name + '.wav not looped\n');
			continue;
		}
		if (context != null) {
			nodes = {
				source: context.createBufferSource(),
				gain: context.createGainNode()
			};
			ch.nodes = nodes;
			nodes.source.buffer = ch.sfx.cache.data;
			nodes.source.loop = true;
			nodes.source.loopStart = ch.sfx.cache.loopstart;
			nodes.source.loopEnd = nodes.source.buffer.length;
			nodes.source.connect(nodes.gain);
			nodes.gain.connect(context.destination);
		}
		else
			ch.audio = ch.sfx.cache.data.cloneNode();
	}

	con.state.sfx_talk = precacheSound('misc/talk.wav');
};

export const noteOff = function (node) {
	if ((node.playbackState === 1) || (node.playbackState === 2)) {
		try { node.noteOff(0.0); } catch (e) { }
	}
}

export const noteOn = function (node) {
	if ((node.playbackState === 0) || (node.playbackState === 3)) {
		try { node.noteOn(0.0); } catch (e) { }
	}
}

export const precacheSound = async function (name) {
	if (cvr.nosound.value !== 0)
		return;
	var i, sfx;
	for (i = 0; i < known_sfx.length; ++i) {
		if (known_sfx[i].name === name) {
			sfx = known_sfx[i];
			break;
		}
	}
	if (i === known_sfx.length) {
		known_sfx[i] = { name: name };
		sfx = known_sfx[i];
	}
	if (cvr.precache.value !== 0)
		await loadSound(sfx);
	return sfx;
};

export const pickChannel = function (entnum, entchannel) {
	var i, channel;

	if (entchannel !== 0) {
		for (i = 0; i < channels.length; ++i) {
			channel = channels[i];
			if (channel == null)
				continue;
			if ((channel.entnum === entnum) && ((channel.entchannel === entchannel) || (entchannel === -1))) {
				channel.sfx = null;
				if (channel.nodes != null) {
					noteOff(channel.nodes.source);
					channel.nodes = null;
				}
				else if (channel.audio != null) {
					channel.audio.pause();
					channel.audio = null;
				}
				break;
			}
		}
	}

	if ((entchannel === 0) || (i === channels.length)) {
		for (i = 0; i < channels.length; ++i) {
			channel = channels[i];
			if (channel == null)
				break;
			if (channel.sfx == null)
				break;
		}
	}

	if (i === channels.length) {
		channels[i] = { end: 0.0 };
		return channels[i];
	}
	return channel;
};

export const spatialize = function (ch) {
	if (ch.entnum === cl.clState.viewentity) {
		ch.leftvol = ch.master_vol;
		ch.rightvol = ch.master_vol;
		return;
	}

	var source = [
		ch.origin[0] - listener_origin[0],
		ch.origin[1] - listener_origin[1],
		ch.origin[2] - listener_origin[2]
	];
	var dist = Math.sqrt(source[0] * source[0] + source[1] * source[1] + source[2] * source[2]);
	if (dist !== 0.0) {
		source[0] /= dist;
		source[1] /= dist;
		source[2] /= dist;
	}
	dist *= ch.dist_mult;
	var dot = listener_right[0] * source[0]
		+ listener_right[1] * source[1]
		+ listener_right[2] * source[2];

	ch.rightvol = ch.master_vol * (1.0 - dist) * (1.0 + dot);
	if (ch.rightvol < 0.0)
		ch.rightvol = 0.0;
	ch.leftvol = ch.master_vol * (1.0 - dist) * (1.0 - dot);
	if (ch.leftvol < 0.0)
		ch.leftvol = 0.0;
};

export const startSound = async function (entnum, entchannel, sfx, origin, vol, attenuation) {
	if ((cvr.nosound.value !== 0) || (sfx == null))
		return;

	var target_chan = pickChannel(entnum, entchannel);
	target_chan.origin = [origin[0], origin[1], origin[2]];
	target_chan.dist_mult = attenuation * 0.001;
	target_chan.master_vol = vol;
	target_chan.entnum = entnum;
	target_chan.entchannel = entchannel;
	spatialize(target_chan);
	if ((target_chan.leftvol === 0.0) && (target_chan.rightvol === 0.0))
		return;

	if (await loadSound(sfx) !== true) {
		target_chan.sfx = null;
		return;
	}

	target_chan.sfx = sfx;
	target_chan.pos = 0.0;
	target_chan.end = host.state.realtime + sfx.cache.length;
	var volume;
	if (context != null) {
		var nodes = {
			source: context.createBufferSource(),
			merger1: context.createChannelMerger(2),
			splitter: context.createChannelSplitter(2),
			gain0: context.createGainNode(),
			gain1: context.createGainNode(),
			merger2: context.createChannelMerger(2)
		};
		target_chan.nodes = nodes;
		nodes.source.buffer = sfx.cache.data;
		if (sfx.cache.loopstart != null) {
			nodes.source.loop = true;
			nodes.source.loopStart = sfx.cache.loopstart;
			nodes.source.loopEnd = nodes.source.buffer.length;
		}
		nodes.source.connect(nodes.merger1);
		nodes.source.connect(nodes.merger1, 0, 1);
		nodes.merger1.connect(nodes.splitter);
		nodes.splitter.connect(nodes.gain0, 0);
		nodes.splitter.connect(nodes.gain1, 1);
		volume = target_chan.leftvol;
		if (volume > 1.0)
			volume = 1.0;
		nodes.gain0.gain.value = volume * cvr.volume.value;
		nodes.gain0.connect(nodes.merger2, 0, 0);
		volume = target_chan.rightvol;
		if (volume > 1.0)
			volume = 1.0;
		nodes.gain1.gain.value = volume * cvr.volume.value;
		nodes.gain1.connect(nodes.merger2, 0, 1);
		nodes.merger2.connect(context.destination);
		var i, check, skip;
		for (i = 0; i < channels.length; ++i) {
			check = channels[i];
			if (check === target_chan)
				continue;
			if ((check.sfx !== sfx) || (check.pos !== 0.0))
				continue;
			skip = Math.random() * 0.1;
			if (skip >= sfx.cache.length) {
				noteOn(nodes.source);
				break;
			}
			target_chan.pos += skip;
			target_chan.end -= skip;
			nodes.source.noteGrainOn(0.0, skip, nodes.source.buffer.length - skip);
			break;
		}
		noteOn(nodes.source);
	}
	else {
		target_chan.audio = sfx.cache.data.cloneNode();
		volume = (target_chan.leftvol + target_chan.rightvol) * 0.5;
		if (volume > 1.0)
			volume = 1.0;
		target_chan.audio.volume = volume * cvr.volume.value;
		await target_chan.audio.play().catch(() => { });
	}
};

export const stopSound = function (entnum, entchannel) {
	if (cvr.nosound.value !== 0)
		return;
	var i, ch;
	for (i = 0; i < channels.length; ++i) {
		ch = channels[i];
		if (ch == null)
			continue;
		if ((ch.entnum === entnum) && (ch.entchannel === entchannel)) {
			ch.end = 0.0;
			ch.sfx = null;
			if (ch.nodes != null) {
				noteOff(ch.nodes.source);
				ch.nodes = null;
			}
			else if (ch.audio != null) {
				ch.audio.pause();
				ch.audio = null;
			}
			return;
		}
	}
};

export const stopAllSounds = function () {
	if (cvr.nosound.value !== 0)
		return;

	var i, ch;

	for (i = 0; i < ambient_channels.length; ++i) {
		ch = ambient_channels[i];
		ch.master_vol = 0.0;
		if (ch.nodes != null)
			noteOff(ch.nodes.source);
		else if (ch.audio != null)
			ch.audio.pause();
	}

	for (i = 0; i < channels.length; ++i) {
		ch = channels[i];
		if (ch == null)
			continue;
		if (ch.nodes != null)
			noteOff(ch.nodes.source);
		else if (ch.audio != null)
			ch.audio.pause();
	}
	channels = [];

	if (context != null) {
		for (i = 0; i < static_channels.length; ++i)
			noteOff(static_channels[i].nodes.source);
	}
	else {
		for (i = 0; i < static_channels.length; ++i)
			static_channels[i].audio.pause();
	}
	static_channels = [];
};

export const staticSound = async function (sfx, origin, vol, attenuation) {
	if ((cvr.nosound.value !== 0) || (sfx == null))
		return;
	if (await loadSound(sfx) !== true)
		return;
	if (sfx.cache.loopstart == null) {
		con.print('Sound ' + sfx.name + ' not looped\n');
		return;
	}
	var ss = {
		sfx: sfx,
		origin: [origin[0], origin[1], origin[2]],
		master_vol: vol,
		dist_mult: attenuation * 0.000015625,
		end: host.state.realtime + sfx.cache.length
	} as any;
	static_channels[static_channels.length] = ss;
	if (context != null) {
		var nodes = {
			source: context.createBufferSource(),
			merger1: context.createChannelMerger(2),
			splitter: context.createChannelSplitter(2),
			gain0: context.createGainNode(),
			gain1: context.createGainNode(),
			merger2: context.createChannelMerger(2)
		};
		ss.nodes = nodes;
		nodes.source.buffer = sfx.cache.data;
		nodes.source.loop = true;
		nodes.source.loopStart = sfx.cache.loopstart;
		nodes.source.loopEnd = nodes.source.buffer.length;
		nodes.source.connect(nodes.merger1);
		nodes.source.connect(nodes.merger1, 0, 1);
		nodes.merger1.connect(nodes.splitter);
		nodes.splitter.connect(nodes.gain0, 0);
		nodes.splitter.connect(nodes.gain1, 1);
		nodes.gain0.connect(nodes.merger2, 0, 0);
		nodes.gain1.connect(nodes.merger2, 0, 1);
		nodes.merger2.connect(context.destination);
	}
	else {
		ss.audio = sfx.cache.data.cloneNode();
		ss.audio.pause();
	}
};

export const soundList = function () {
	var total = 0, i, sfx, sc, size;
	for (i = 0; i < known_sfx.length; ++i) {
		sfx = known_sfx[i];
		sc = sfx.cache;
		if (sc == null)
			continue;
		size = sc.size.toString();
		total += sc.size;
		for (; size.length <= 5;)
			size = ' ' + size;
		if (sc.loopstart != null)
			size = 'L' + size;
		else
			size = ' ' + size;
		con.print(size + ' : ' + sfx.name + '\n');
	}
	con.print('Total resident: ' + total + '\n');
};

export const localSound = async function (sound) {
	await startSound(cl.clState.viewentity, -1, sound, vec.origin, 1.0, 1.0);
};

export const updateAmbientSounds = async function () {
	if (cl.clState.worldmodel == null)
		return;

	var i, ch, vol, sc;

	var l = mod.pointInLeaf(listener_origin, cl.clState.worldmodel);
	if ((l == null) || (cvr.ambient_level.value === 0)) {
		for (i = 0; i < ambient_channels.length; ++i) {
			ch = ambient_channels[i];
			ch.master_vol = 0.0;
			if (ch.nodes != null) {
				noteOff(ch.nodes.source);
			}
			else if (ch.audio != null) {
				if (ch.audio.paused !== true)
					ch.audio.pause();
			}
		}
		return;
	}

	for (i = 0; i < ambient_channels.length; ++i) {
		ch = ambient_channels[i];
		if ((ch.nodes == null) && (ch.audio == null))
			continue;
		vol = cvr.ambient_level.value * l.ambient_level[i];
		if (vol < 8.0)
			vol = 0.0;
		vol /= 255.0;
		if (ch.master_vol < vol) {
			ch.master_vol += (host.state.frametime * cvr.ambient_fade.value) / 255.0;
			if (ch.master_vol > vol)
				ch.master_vol = vol;
		}
		else if (ch.master_vol > vol) {
			ch.master_vol -= (host.state.frametime * cvr.ambient_fade.value) / 255.0;
			if (ch.master_vol < vol)
				ch.master_vol = vol;
		}

		if (ch.master_vol === 0.0) {
			if (context != null) {
				noteOff(ch.nodes.source);
			}
			else {
				if (ch.audio.paused !== true)
					await ch.audio.pause();
			}
			continue;
		}
		if (ch.master_vol > 1.0)
			ch.master_vol = 1.0;
		if (context != null) {
			ch.nodes.gain.gain.value = ch.master_vol * cvr.volume.value;
			noteOn(ch.nodes.source);
		}
		else {
			ch.audio.volume = ch.master_vol * cvr.volume.value;
			sc = ch.sfx.cache;
			if (ch.audio.paused === true) {
				await ch.audio.play().catch(() => { });
				ch.end = host.state.realtime + sc.length;
				continue;
			}
			if (host.state.realtime >= ch.end) {
				try {
					ch.audio.currentTime = sc.loopstart;
				}
				catch (e) {
					ch.end = host.state.realtime;
					continue;
				}
				ch.end = host.state.realtime + sc.length - sc.loopstart;
			}
		}
	}
};

export const updateDynamicSounds = function () {
	var i, ch, sc, volume;
	for (i = 0; i < channels.length; ++i) {
		ch = channels[i];
		if (ch == null)
			continue;
		if (ch.sfx == null)
			continue;
		if (host.state.realtime >= ch.end) {
			sc = ch.sfx.cache;
			if (sc.loopstart != null) {
				if (context == null) {
					try {
						ch.audio.currentTime = sc.loopstart;
					}
					catch (e) {
						ch.end = host.state.realtime;
						continue;
					}
				}
				ch.end = host.state.realtime + sc.length - sc.loopstart;
			}
			else {
				ch.sfx = null;
				ch.nodes = null;
				ch.audio = null;
				continue;
			}
		}
		spatialize(ch);
		if (context != null) {
			if (ch.leftvol > 1.0)
				ch.leftvol = 1.0;
			if (ch.rightvol > 1.0)
				ch.rightvol = 1.0;
			ch.nodes.gain0.gain.volume = ch.leftvol * cvr.volume.value;
			ch.nodes.gain1.gain.volume = ch.rightvol * cvr.volume.value;
		}
		else {
			volume = (ch.leftvol + ch.rightvol) * 0.5;
			if (volume > 1.0)
				volume = 1.0;
			ch.audio.volume = volume * cvr.volume.value;
		}
	}
};

export const updateStaticSounds = async function () {
	var i, j, ch, ch2, sfx, sc, volume;

	for (i = 0; i < static_channels.length; ++i)
		spatialize(static_channels[i]);

	for (i = 0; i < static_channels.length; ++i) {
		ch = static_channels[i];
		if ((ch.leftvol === 0.0) && (ch.rightvol === 0.0))
			continue;
		sfx = ch.sfx;
		for (j = i + 1; j < static_channels.length; ++j) {
			ch2 = static_channels[j];
			if (sfx === ch2.sfx) {
				ch.leftvol += ch2.leftvol;
				ch.rightvol += ch2.rightvol;
				ch2.leftvol = 0.0;
				ch2.rightvol = 0.0;
			}
		}
	}

	if (context != null) {
		for (i = 0; i < static_channels.length; ++i) {
			ch = static_channels[i];
			if ((ch.leftvol === 0.0) && (ch.rightvol === 0.0)) {
				noteOff(ch.nodes.source);
				continue;
			}
			if (ch.leftvol > 1.0)
				ch.leftvol = 1.0;
			if (ch.rightvol > 1.0)
				ch.rightvol = 1.0;
			ch.nodes.gain0.gain.value = ch.leftvol * cvr.volume.value;
			ch.nodes.gain1.gain.value = ch.rightvol * cvr.volume.value;
			noteOn(ch.nodes.source);
		}
	}
	else {
		for (i = 0; i < static_channels.length; ++i) {
			ch = static_channels[i];
			volume = (ch.leftvol + ch.rightvol) * 0.5;
			if (volume > 1.0)
				volume = 1.0;
			if (volume === 0.0) {
				if (ch.audio.paused !== true)
					ch.audio.pause();
				continue;
			}
			ch.audio.volume = volume * cvr.volume.value;
			sc = ch.sfx.cache;
			if (ch.audio.paused === true) {
				await ch.audio.play().catch(() => { });
				ch.end = host.state.realtime + sc.length;
				continue;
			}
			if (host.state.realtime >= ch.end) {
				try {
					ch.audio.currentTime = sc.loopstart;
				}
				catch (e) {
					ch.end = host.state.realtime;
					continue;
				}
			}
		}
	}
};

export const update = async function (origin, forward, right, up) {
	if (cvr.nosound.value !== 0)
		return;

	listener_origin[0] = origin[0];
	listener_origin[1] = origin[1];
	listener_origin[2] = origin[2];
	listener_forward[0] = forward[0];
	listener_forward[1] = forward[1];
	listener_forward[2] = forward[2];
	listener_right[0] = right[0];
	listener_right[1] = right[1];
	listener_right[2] = right[2];
	listener_up[0] = up[0];
	listener_up[1] = up[1];
	listener_up[2] = up[2];

	if (cvr.volume.value < 0.0)
		cvar.setValue('volume', 0.0);
	else if (cvr.volume.value > 1.0)
		cvar.setValue('volume', 1.0);

	await updateAmbientSounds();
	updateDynamicSounds();
	await updateStaticSounds();
};

export const play = async function () {
	if (cvr.nosound.value !== 0)
		return;
	var i, sfx;
	for (i = 1; i < cmd.state.argv.length; ++i) {
		sfx = await precacheSound(com.defaultExtension(cmd.state.argv[i], '.wav'));
		if (sfx != null)
			await startSound(cl.clState.viewentity, 0, sfx, listener_origin, 1.0, 1.0);
	}
};

export const playVol = async function () {
	if (cvr.nosound.value !== 0)
		return;
	var i, sfx;
	for (i = 1; i < cmd.state.argv.length; i += 2) {
		sfx = await precacheSound(com.defaultExtension(cmd.state.argv[i], '.wav'));
		if (sfx != null)
			await startSound(cl.clState.viewentity, 0, sfx, listener_origin, q.atof(cmd.state.argv[i + 1]), 1.0);
	}
};

export const loadSound = async function (s) {
	if (cvr.nosound.value !== 0)
		return;
	if (s.cache != null)
		return true;

	var sc = {} as any

	var data = await com.loadFile('sound/' + s.name);
	if (data == null) {
		con.print('Couldn\'t load sound/' + s.name + '\n');
		return;
	}

	var view = new DataView(data);
	if ((view.getUint32(0, true) !== 0x46464952) || (view.getUint32(8, true) !== 0x45564157)) {
		con.print('Missing RIFF/WAVE chunks\n');
		return;
	}
	var p, fmt, dataofs, datalen, cue, loopstart, samples;
	for (p = 12; p < data.byteLength;) {
		switch (view.getUint32(p, true)) {
			case 0x20746d66: // fmt
				if (view.getInt16(p + 8, true) !== 1) {
					con.print('Microsoft PCM format only\n');
					return;
				}
				fmt = {
					channels: view.getUint16(p + 10, true),
					samplesPerSec: view.getUint32(p + 12, true),
					avgBytesPerSec: view.getUint32(p + 16, true),
					blockAlign: view.getUint16(p + 20, true),
					bitsPerSample: view.getUint16(p + 22, true)
				};
				break;
			case 0x61746164: // data
				dataofs = p + 8;
				datalen = view.getUint32(p + 4, true);
				break;
			case 0x20657563: // cue
				cue = true;
				loopstart = view.getUint32(p + 32, true);
				break;
			case 0x5453494c: // LIST
				if (cue !== true)
					break;
				cue = false;
				if (view.getUint32(p + 28, true) === 0x6b72616d)
					samples = loopstart + view.getUint32(p + 24, true);
				break;
		}
		p += view.getUint32(p + 4, true) + 8;
		if ((p & 1) !== 0)
			++p;
	}

	if (fmt == null) {
		con.print('Missing fmt chunk\n');
		return;
	}
	if (dataofs == null) {
		con.print('Missing data chunk\n');
		return;
	}
	if (loopstart != null)
		sc.loopstart = loopstart * fmt.blockAlign / fmt.samplesPerSec;
	if (samples != null)
		sc.length = samples / fmt.samplesPerSec;
	else
		sc.length = datalen / fmt.avgBytesPerSec;

	sc.size = datalen + 44;
	if ((sc.size & 1) !== 0)
		++sc.size;
	var out = new ArrayBuffer(sc.size);
	view = new DataView(out);
	view.setUint32(0, 0x46464952, true); // RIFF
	view.setUint32(4, sc.size - 8, true);
	view.setUint32(8, 0x45564157, true); // WAVE
	view.setUint32(12, 0x20746d66, true); // fmt
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, fmt.channels, true);
	view.setUint32(24, fmt.samplesPerSec, true);
	view.setUint32(28, fmt.avgBytesPerSec, true);
	view.setUint16(32, fmt.blockAlign, true);
	view.setUint16(34, fmt.bitsPerSample, true);
	view.setUint32(36, 0x61746164, true); // data
	view.setUint32(40, datalen, true);
	(new Uint8Array(out, 44, datalen)).set(new Uint8Array(data, dataofs, datalen));
	if (context != null)
		sc.data = context.createBuffer(out, true);
	else
		sc.data = new Audio('data:audio/wav;base64,' + q.btoa(new Uint8Array(out)));

	s.cache = sc;
	return true;
};
