CDAudio = {};

CDAudio.known = [];

CDAudio.Play = async function(track, looping)
{
	if ((CDAudio.initialized !== true) || (CDAudio.enabled !== true))
		return;
	track -= 2;
	if (CDAudio.playTrack === track)
	{
		if (CDAudio.cd != null)
		{
			CDAudio.cd.loop = looping;
			if ((looping === true) && (CDAudio.cd.paused === true))
				await CDAudio.cd.play();
		}
		return;
	}
	if ((track < 0) || (track >= CDAudio.known.length))
	{
		Con.DPrint('CDAudio.Play: Bad track number ' + (track + 2) + '.\n');
		return;
	}
	CDAudio.Stop();
	CDAudio.playTrack = track;
	CDAudio.cd = new Audio(CDAudio.known[track]);
	CDAudio.cd.loop = looping;
	CDAudio.cd.volume = CDAudio.cdvolume;
	await CDAudio.cd.play();
};

CDAudio.Stop = function()
{
	if ((CDAudio.initialized !== true) || (CDAudio.enabled !== true))
		return;
	if (CDAudio.cd != null)
		CDAudio.cd.pause();
	CDAudio.playTrack = null;
	CDAudio.cd = null;
};

CDAudio.Pause = function()
{
	if ((CDAudio.initialized !== true) || (CDAudio.enabled !== true))
		return;
	if (CDAudio.cd != null)
		CDAudio.cd.pause();
};

CDAudio.Resume = function()
{
	if ((CDAudio.initialized !== true) || (CDAudio.enabled !== true))
		return;
	if (CDAudio.cd != null)
		CDAudio.cd.play();
};

CDAudio.CD_f = async function()
{
	if ((CDAudio.initialized !== true) || (Cmd.argv.length <= 1))
		return;
	var command = Cmd.argv[1].toLowerCase();
	switch (command)
	{
	case 'on':
		CDAudio.enabled = true;
		return;
	case 'off':
		CDAudio.Stop();
		CDAudio.enabled = false;
		return;
	case 'play':
		await CDAudio.Play(Q.atoi(Cmd.argv[2]), false);
		return;
	case 'loop':
		await CDAudio.Play(Q.atoi(Cmd.argv[2]), true);
		return;
	case 'stop':
		CDAudio.Stop();
		return;
	case 'pause':
		CDAudio.Pause();
		return;
	case 'resume':
		await CDAudio.Resume();
		return;
	case 'info':
		Con.Print(CDAudio.known.length + ' tracks\n');
		if (CDAudio.cd != null)
		{
			if (CDAudio.cd.paused !== true)
				Con.Print('Currently ' + (CDAudio.cd.loop === true ? 'looping' : 'playing') + ' track ' + (CDAudio.playTrack + 2) + '\n');
		}
		Con.Print('Volume is ' + CDAudio.cdvolume + '\n');
		return;
	}
};

CDAudio.Update = function()
{
	if ((CDAudio.initialized !== true) || (CDAudio.enabled !== true))
		return;
	if (S.bgmvolume.value === CDAudio.cdvolume)
		return;
	if (S.bgmvolume.value < 0.0)
		Cvar.SetValue('bgmvolume', 0.0);
	else if (S.bgmvolume.value > 1.0)
		Cvar.SetValue('bgmvolume', 1.0);
	CDAudio.cdvolume = S.bgmvolume.value;
	if (CDAudio.cd != null)
		CDAudio.cd.volume = CDAudio.cdvolume;
};

CDAudio.TrackExists = async function(trackPath) {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('HEAD', trackPath);
		xhr.onload = () => {
			resolve({
				status: xhr.status
			});
		}
		xhr.onerror = (e) => reject(e) 
		xhr.send();
	})
}

CDAudio.Init = async function()
{
	Cmd.AddCommand('cd', CDAudio.CD_f);
	if (COM.CheckParm('-nocdaudio') != null)
		return;
	var i, j, track;
	for (i = 1; i <= 99; ++i)
	{
		track = '/media/quake' + (i <= 9 ? '0' : '') + i + '.ogg';
		for (j = COM.searchpaths.length - 1; j >= 0; --j)
		{
			const exists = await CDAudio.TrackExists(COM.searchpaths[j].filename + track)
			if ((exists.status >= 200) && (exists.status <= 299))
			{
				CDAudio.known[i - 1] = COM.searchpaths[j].filename + track;
				break;
			}
		}
		if (j < 0)
			break;
	}
	if (CDAudio.known.length === 0)
		return;
	CDAudio.initialized = CDAudio.enabled = true;
	CDAudio.Update();
	Con.Print('CD Audio Initialized\n');
};