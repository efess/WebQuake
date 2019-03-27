import * as draw from '../../engine/draw'
import * as q from '../../engine/q'
import * as crc from '../../engine/crc'
import * as com from '../../engine/com'
import * as sys from '../../engine/sys'
import * as con from '../../engine/console'

const getFile = async function(file: string) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.overrideMimeType('text/plain; charset=x-user-defined');
    xhr.open('GET', file);
    xhr.onload = () => {
      resolve({
        status: xhr.status,
        responseText: xhr.responseText
      });
    }
    xhr.onerror = (e) => reject(e) 
    xhr.send();
  });
};

const getFileRange = async function(file, rangeFrom, rangeTo) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.overrideMimeType('text/plain; charset=x-user-defined');
    xhr.open('GET', file);
    xhr.setRequestHeader('Range', 'bytes=' + rangeFrom + '-' + rangeTo);
    xhr.onload = () => {
      resolve({
        status: xhr.status,
        responseText: xhr.responseText
      });
    }
    xhr.onerror = (e) => reject(e)
    xhr.send();
  });
};


export const writeFile = (filename: string, data: Uint8Array, len: number) =>
{
  filename = filename.toLowerCase();
  var dest = [], i;
  for (i = 0; i < len; ++i)
    dest[i] = String.fromCharCode(data[i]);
  try
  {
    localStorage.setItem('Quake.' + com.state.searchpaths[com.state.searchpaths.length - 1].filename + '/' + filename, dest.join(''));
  }
  catch (e)
  {
    sys.print('COM.WriteFile: failed on ' + filename + '\n');
    Promise.resolve(false);
  }
  sys.print('COM.WriteFile: ' + filename + '\n');
  return Promise.resolve(true);
};

export const writeTextFile = (filename, data) =>
{
  filename = filename.toLowerCase();
  try
  {
    localStorage.setItem('Quake.' + com.state.searchpaths[com.state.searchpaths.length - 1].filename + '/' + filename, data);
  }
  catch (e)
  {
    sys.print('COM.WriteTextFile: failed on ' + filename + '\n');
    Promise.resolve(false);
  }
  sys.print('COM.WriteTextFile: ' + filename + '\n');
  return Promise.resolve(true);
};

export const loadFile = async function(filename: string)
{
  filename = filename.toLowerCase();
  var i, j, k, search, netpath, pak, file, data;
  draw.beginDisc();
  for (i = com.state.searchpaths.length - 1; i >= 0; --i)
  {
    search = com.state.searchpaths[i];
    netpath = search.filename + '/' + filename;
    data = localStorage.getItem('Quake.' + netpath);
    if (data != null)
    {
      sys.print('FindFile: ' + netpath + '\n');
      draw.endDisc();
      return q.strmem(data);
    }
    for (j = search.pack.length - 1; j >= 0; --j)
    {
      pak = search.pack[j];
      for (k = 0; k < pak.length; ++k)
      {
        file = pak[k];
        if (file.name !== filename)
          continue;
        if (file.filelen === 0)
        {
          draw.endDisc();
          return new ArrayBuffer(0);
        }
        const gotFile = await getFileRange(search.filename + '/pak' + j + '.pak', file.filepos, (file.filepos + file.filelen - 1)) as any
        
        if ((gotFile.status >= 200) && (gotFile.status <= 299) && (gotFile.responseText.length === file.filelen))
        {
          sys.print('PackFile: ' + search.filename + '/pak' + j + '.pak : ' + filename + '\n')
          draw.endDisc();
          return q.strmem(gotFile.responseText);
        }
        break;
      }
    }
    const gotFile = await getFile(netpath) as any;
    if ((gotFile.status >= 200) && (gotFile.status <= 299))
    {
      sys.print('FindFile: ' + netpath + '\n');
      draw.endDisc();
      return q.strmem(gotFile.responseText);
    }
  }
  sys.print('FindFile: can\'t find ' + filename + '\n');
  draw.endDisc();
};

export const loadPackFile = async function(packfile)
{
  const gotHeader = await getFileRange(packfile, 0, 11) as any;
  if ((gotHeader.status <= 199) || (gotHeader.status >= 300) || (gotHeader.responseText.length !== 12))
    return;
  var header = new DataView(q.strmem(gotHeader.responseText));
  if (header.getUint32(0, true) !== 0x4b434150)
    sys.error(packfile + ' is not a packfile');
  var dirofs = header.getUint32(4, true);
  var dirlen = header.getUint32(8, true);
  var numpackfiles = dirlen >> 6;
  if (numpackfiles !== 339)
    com.state.modified = true;
  var pack = [];
  if (numpackfiles !== 0)
  {
    const fileInfo = await getFileRange(packfile, dirofs, (dirofs + dirlen - 1)) as any
    if ((fileInfo.status <= 199) || (fileInfo.status >= 300) || (fileInfo.responseText.length !== dirlen))
      return;
    var info = q.strmem(fileInfo.responseText);
    if (crc.block(new Uint8Array(info)) !== 32981)
      com.state.modified = true;
    var i;
    for (i = 0; i < numpackfiles; ++i)
    {
      pack[pack.length] =
      {
        name: q.memstr(new Uint8Array(info, i << 6, 56)).toLowerCase(),
        filepos: (new DataView(info)).getUint32((i << 6) + 56, true),
        filelen: (new DataView(info)).getUint32((i << 6) + 60, true)
      }
    }
  }
  con.print('Added packfile ' + packfile + ' (' + numpackfiles + ' files)\n');
  return pack;
};