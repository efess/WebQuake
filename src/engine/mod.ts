import * as sys from './sys'
import * as con from './console'
import * as com from './com'
import * as vid from './vid'
import * as r from './r'
import * as GL from './GL'
import * as q from './q'
import * as vec from './vec'

export const EFFECTS = {
  brightfield: 1,
  muzzleflash: 2,
  brightlight: 4,
  dimlight: 8
};

export const TYPE = {
  brush: 0,
  sprite: 1,
  alias: 2
};

export const FLAGS = {
  rocket: 1,
  grenade: 2,
  gib: 4,
  rotate: 8,
  tracer: 16,
  zomgib: 32,
  tracer2: 64,
  tracer3: 128
};

export const VERSION = {
  brush: 29,
  sprite: 1,
  alias: 6
};

const known: any = [];

//
var loadmodel: any = null
export const novis: any[] = []
var filledcolor = 0

export const init = function()
{
  var i;
  for (i = 0; i < 1024; ++i)
    novis[i] = 0xff;

  filledcolor = 0;
  for (i = 0; i <= 255; ++i)
  {
    if (vid.d_8to24table[i] === 0)
    {
      filledcolor = i;
      break;
    }
  }
};

export const pointInLeaf = function(p, model)
{
  if (model == null)
    sys.error('Mod.PointInLeaf: bad model');
  if (model.nodes == null)
    sys.error('Mod.PointInLeaf: bad model');
  var node = model.nodes[0];
  var normal;
  for (;;)
  {
    if (node.contents < 0)
      return node;
    normal = node.plane.normal;
    if ((p[0] * normal[0] + p[1] * normal[1] + p[2] * normal[2] - node.plane.dist) > 0)
      node = node.children[0];
    else
      node = node.children[1];
  }
};

export const decompressVis = function(i, model)
{
  var decompressed = [], c, out = 0, row = (model.leafs.length + 7) >> 3;
  if (model.visdata == null)
  {
    for (; row >= 0; --row)
      decompressed[out++] = 0xff;
    return decompressed;
  }
  for (out = 0; out < row; )
  {
    if (model.visdata[i] !== 0)
    {
      decompressed[out++] = model.visdata[i++];
      continue;
    }
    for (c = model.visdata[i + 1]; c > 0; --c)
      decompressed[out++] = 0;
    i += 2;
  }
  return decompressed;
};

export const leafPVS = function(leaf, model)
{
  if (leaf === model.leafs[0])
    return novis;
  return decompressVis(leaf.visofs, model);
};

export const clearAll = function()
{
  const gl = GL.getContext()
  var i, mod 
  for (i = 0; i < known.length; ++i)
  {
    mod = known[i];
    if (mod.type !== TYPE.brush)
      continue;
    if (mod.cmds != null)
      gl.deleteBuffer(mod.cmds);
    known[i] = {
      name: mod.name,
      needload: true
    };
  }
};

export const findName = function(name)
{
  if (name.length === 0)
    sys.error('Mod.FindName: NULL name');
  var i;
  for (i = 0; i < known.length; ++i)
  {
    if (known[i] == null)
      continue;
    if (known[i].name === name)
      return known[i];
  }
  for (i = 0; i <= known.length; ++i)
  {
    if (known[i] != null)
      continue;
    known[i] = {name: name, needload: true};
    return known[i];
  }
};

export const loadModel = async function(mod, crash)
{
  if (mod.needload !== true)
    return mod;
  var buf = await com.loadFile(mod.name);
  if (buf == null)
  {
    if (crash === true)
      sys.error('Mod.LoadModel: ' + mod.name + ' not found');
    return;
  }
  loadmodel = mod;
  mod.needload = false;
  switch ((new DataView(buf)).getUint32(0, true))
  {
  case 0x4f504449:
    loadAliasModel(buf);
    break;
  case 0x50534449:
    loadSpriteModel(buf);
    break;
  default:
    loadBrushModel(buf);
  }
  return mod;
};

export const forName = async function(name, crash = false)
{
  return await loadModel(findName(name), crash);
};

/*
===============================================================================

          BRUSHMODEL LOADING

===============================================================================
*/

const LUMP =
{
  entities: 0,
  planes: 1,
  textures: 2,
  vertexes: 3,
  visibility: 4,
  nodes: 5,
  texinfo: 6,
  faces: 7,
  lighting: 8,
  clipnodes: 9,
  leafs: 10,
  marksurfaces: 11,
  edges: 12,
  surfedges: 13,
  models: 14
};

export const CONTENTS = {
  empty: -1,
  solid: -2,
  water: -3,
  slime: -4,
  lava: -5,
  sky: -6,
  origin: -7,
  clip: -8,
  current_0: -9,
  current_90: -10,
  current_180: -11,
  current_270: -12,
  current_up: -13,
  current_down: -14
};

export const loadTextures = function(buf)
{
  var view = new DataView(buf);
  var fileofs = view.getUint32((LUMP.textures << 3) + 4, true);
  var filelen = view.getUint32((LUMP.textures << 3) + 8, true);
  loadmodel.textures = [];
  var nummiptex = view.getUint32(fileofs, true);
  var dataofs = fileofs + 4;
  var i, miptexofs, tx, glt;
  for (i = 0; i < nummiptex; ++i)
  {
    miptexofs = view.getInt32(dataofs, true);
    dataofs += 4;
    if (miptexofs === -1)
    {
      loadmodel.textures[i] = r.state.notexture_mip;
      continue;
    }
    miptexofs += fileofs;
    tx =
    {
      name: q.memstr(new Uint8Array(buf, miptexofs, 16)),
      width: view.getUint32(miptexofs + 16, true),
      height: view.getUint32(miptexofs + 20, true)
    }
    if (tx.name.substring(0, 3).toLowerCase() === 'sky')
    {
      r.initSky(new Uint8Array(buf, miptexofs + view.getUint32(miptexofs + 24, true), 32768));
      tx.texturenum = r.state.solidskytexture;
      r.state.skytexturenum = i;
      tx.sky = true;
    }
    else
    {
      glt = GL.loadTexture(tx.name, tx.width, tx.height, new Uint8Array(buf, miptexofs + view.getUint32(miptexofs + 24, true), tx.width * tx.height));
      tx.texturenum = glt.texnum;
      if (tx.name.charCodeAt(0) === 42)
        tx.turbulent = true;
    }
    loadmodel.textures[i] = tx;
  }

  var j, tx2, num, name;
  for (i = 0; i < nummiptex; ++i)
  {
    tx = loadmodel.textures[i];
    if (tx.name.charCodeAt(0) !== 43)
      continue;
    if (tx.name.charCodeAt(1) !== 48)
      continue;
    name = tx.name.substring(2);
    tx.anims = [i];
    tx.alternate_anims = [];
    for (j = 0; j < nummiptex; ++j)
    {
      tx2 = loadmodel.textures[j];
      if (tx2.name.charCodeAt(0) !== 43)
        continue;
      if (tx2.name.substring(2) !== name)
        continue;
      num = tx2.name.charCodeAt(1);
      if (num === 48)
        continue;
      if ((num >= 49) && (num <= 57))
      {
        tx.anims[num - 48] = j;
        tx2.anim_base = i;
        tx2.anim_frame = num - 48;
        continue;
      }
      if (num >= 97)
        num -= 32;
      if ((num >= 65) && (num <= 74))
      {
        tx.alternate_anims[num - 65] = j;
        tx2.anim_base = i;
        tx2.anim_frame = num - 65;
        continue;
      }
      sys.error('Bad animating texture ' + tx.name);
    }
    for (j = 0; j < tx.anims.length; ++j)
    {
      if (tx.anims[j] == null)
        sys.error('Missing frame ' + j + ' of ' + tx.name);
    }
    for (j = 0; j < tx.alternate_anims.length; ++j)
    {
      if (tx.alternate_anims[j] == null)
        sys.error('Missing frame ' + j + ' of ' + tx.name);
    }
    loadmodel.textures[i] = tx;
  }

  loadmodel.textures[loadmodel.textures.length] = r.state.notexture_mip;
};

export const loadLighting = function(buf)
{
  var view = new DataView(buf);
  var fileofs = view.getUint32((LUMP.lighting << 3) + 4, true);
  var filelen = view.getUint32((LUMP.lighting << 3) + 8, true);
  if (filelen === 0)
    return;
  loadmodel.lightdata = new Uint8Array(new ArrayBuffer(filelen));
  loadmodel.lightdata.set(new Uint8Array(buf, fileofs, filelen));
};

export const loadVisibility = function(buf)
{
  var view = new DataView(buf);
  var fileofs = view.getUint32((LUMP.visibility << 3) + 4, true);
  var filelen = view.getUint32((LUMP.visibility << 3) + 8, true);
  if (filelen === 0)
    return;
  loadmodel.visdata = new Uint8Array(new ArrayBuffer(filelen));
  loadmodel.visdata.set(new Uint8Array(buf, fileofs, filelen));
};

export const loadEntities = function(buf)
{
  var view = new DataView(buf);
  var fileofs = view.getUint32((LUMP.entities << 3) + 4, true);
  var filelen = view.getUint32((LUMP.entities << 3) + 8, true);
  loadmodel.entities = q.memstr(new Uint8Array(buf, fileofs, filelen));
};

export const loadVertexes = function(buf)
{
  var view = new DataView(buf);
  var fileofs = view.getUint32((LUMP.vertexes << 3) + 4, true);
  var filelen = view.getUint32((LUMP.vertexes << 3) + 8, true);
  if ((filelen % 12) !== 0)
    sys.error('Mod.LoadVisibility: funny lump size in ' + loadmodel.name);
  var count = filelen / 12;
  loadmodel.vertexes = [];
  var i;
  for (i = 0; i < count; ++i)
  {
    loadmodel.vertexes[i] = [view.getFloat32(fileofs, true), view.getFloat32(fileofs + 4, true), view.getFloat32(fileofs + 8, true)];
    fileofs += 12;
  }
};

export const loadSubmodels = function(buf)
{
  var view = new DataView(buf);
  var fileofs = view.getUint32((LUMP.models << 3) + 4, true);
  var filelen = view.getUint32((LUMP.models << 3) + 8, true);
  var count = filelen >> 6;
  if (count === 0)
    sys.error('Mod.LoadSubmodels: funny lump size in ' + loadmodel.name);
  loadmodel.submodels = [];

  loadmodel.mins = [view.getFloat32(fileofs, true) - 1.0,
    view.getFloat32(fileofs + 4, true) - 1.0,
    view.getFloat32(fileofs + 8, true) - 1.0];
  loadmodel.maxs = [view.getFloat32(fileofs + 12, true) + 1.0,
    view.getFloat32(fileofs + 16, true) + 1.0,
    view.getFloat32(fileofs + 20, true) + 1.0];
  loadmodel.hulls[0].firstclipnode = view.getUint32(fileofs + 36, true);
  loadmodel.hulls[1].firstclipnode = view.getUint32(fileofs + 40, true);
  loadmodel.hulls[2].firstclipnode = view.getUint32(fileofs + 44, true);
  fileofs += 64;

  var i, clipnodes = loadmodel.hulls[0].clipnodes, out;
  for (i = 1; i < count; ++i)
  {
    out = findName('*' + i);
    out.needload = false;
    out.type = TYPE.brush;
    out.submodel = true;
    out.mins = [view.getFloat32(fileofs, true) - 1.0,
      view.getFloat32(fileofs + 4, true) - 1.0,
      view.getFloat32(fileofs + 8, true) - 1.0];
    out.maxs = [view.getFloat32(fileofs + 12, true) + 1.0,
      view.getFloat32(fileofs + 16, true) + 1.0,
      view.getFloat32(fileofs + 20, true) + 1.0];
    out.origin = [view.getFloat32(fileofs + 24, true), view.getFloat32(fileofs + 28, true), view.getFloat32(fileofs + 32, true)];
    out.hulls = [
      {
        clipnodes: clipnodes,
        firstclipnode: view.getUint32(fileofs + 36, true),
        lastclipnode: loadmodel.nodes.length - 1,
        planes: loadmodel.planes,
        clip_mins: [0.0, 0.0, 0.0],
        clip_maxs: [0.0, 0.0, 0.0]
      },
      {
        clipnodes: loadmodel.clipnodes,
        firstclipnode: view.getUint32(fileofs + 40, true),
        lastclipnode: loadmodel.clipnodes.length - 1,
        planes: loadmodel.planes,
        clip_mins: [-16.0, -16.0, -24.0],
        clip_maxs: [16.0, 16.0, 32.0]
      },
      {
        clipnodes: loadmodel.clipnodes,
        firstclipnode: view.getUint32(fileofs + 44, true),
        lastclipnode: loadmodel.clipnodes.length - 1,
        planes: loadmodel.planes,
        clip_mins: [-32.0, -32.0, -24.0],
        clip_maxs: [32.0, 32.0, 64.0]
      }
    ];
    out.textures = loadmodel.textures;
    out.lightdata = loadmodel.lightdata;
    out.faces = loadmodel.faces;
    out.firstface = view.getUint32(fileofs + 56, true);
    out.numfaces = view.getUint32(fileofs + 60, true);
    loadmodel.submodels[i - 1] = out;
    fileofs += 64;
  }
};

export const loadEdges = function(buf)
{
  var view = new DataView(buf);
  var fileofs = view.getUint32((LUMP.edges << 3) + 4, true);
  var filelen = view.getUint32((LUMP.edges << 3) + 8, true);
  if ((filelen & 3) !== 0)
    sys.error('Mod.LoadEdges: funny lump size in ' + loadmodel.name);
  var count = filelen >> 2;
  loadmodel.edges = [];
  var i;
  for (i = 0; i < count; ++i)
  {
    loadmodel.edges[i] = [view.getUint16(fileofs, true), view.getUint16(fileofs + 2, true)];
    fileofs += 4;
  }
};

export const loadTexinfo = function(buf)
{
  var view = new DataView(buf);
  var fileofs = view.getUint32((LUMP.texinfo << 3) + 4, true);
  var filelen = view.getUint32((LUMP.texinfo << 3) + 8, true);
  if ((filelen % 40) !== 0)
    sys.error('Mod.LoadTexinfo: funny lump size in ' + loadmodel.name);
  var count = filelen / 40;
  loadmodel.texinfo = [];
  var i, out;
  for (i = 0; i < count; ++i)
  {
    out = {
      vecs: [
        [view.getFloat32(fileofs, true), view.getFloat32(fileofs + 4, true), view.getFloat32(fileofs + 8, true), view.getFloat32(fileofs + 12, true)],
        [view.getFloat32(fileofs + 16, true), view.getFloat32(fileofs + 20, true), view.getFloat32(fileofs + 24, true), view.getFloat32(fileofs + 28, true)]
      ],
      texture: view.getUint32(fileofs + 32, true),
      flags: view.getUint32(fileofs + 36, true)
    };
    if (out.texture >= loadmodel.textures.length)
    {
      out.texture = loadmodel.textures.length - 1;
      out.flags = 0;
    }
    loadmodel.texinfo[i] = out;
    fileofs += 40;
  }
};

export const loadFaces = function(buf)
{
  var view = new DataView(buf);
  var fileofs = view.getUint32((LUMP.faces << 3) + 4, true);
  var filelen = view.getUint32((LUMP.faces << 3) + 8, true);
  if ((filelen % 20) !== 0)
    sys.error('Mod.LoadFaces: funny lump size in ' + loadmodel.name);
  var count = filelen / 20;
  loadmodel.firstface = 0;
  loadmodel.numfaces = count;
  loadmodel.faces = [];
  var i, styles, out;
  var mins, maxs, j, e, tex, v, val;
  for (i = 0; i < count; ++i)
  {
    styles = new Uint8Array(buf, fileofs + 12, 4);
    out =
    {
      plane: loadmodel.planes[view.getUint16(fileofs, true)],
      firstedge: view.getUint16(fileofs + 4, true),
      numedges: view.getUint16(fileofs + 8, true),
      texinfo: view.getUint16(fileofs + 10, true),
      styles: [],
      lightofs: view.getInt32(fileofs + 16, true)
    };
    if (styles[0] !== 255)
      out.styles[0] = styles[0];
    if (styles[1] !== 255)
      out.styles[1] = styles[1];
    if (styles[2] !== 255)
      out.styles[2] = styles[2];
    if (styles[3] !== 255)
      out.styles[3] = styles[3];

    mins = [999999, 999999];
    maxs = [-99999, -99999];
    tex = loadmodel.texinfo[out.texinfo];
    out.texture = tex.texture;
    for (j = 0; j < out.numedges; ++j)
    {
      e = loadmodel.surfedges[out.firstedge + j];
      if (e >= 0)
        v = loadmodel.vertexes[loadmodel.edges[e][0]];
      else
        v = loadmodel.vertexes[loadmodel.edges[-e][1]];
      val = vec.dotProduct(v, tex.vecs[0]) + tex.vecs[0][3];
      if (val < mins[0])
        mins[0] = val;
      if (val > maxs[0])
        maxs[0] = val;
      val = vec.dotProduct(v, tex.vecs[1]) + tex.vecs[1][3];
      if (val < mins[1])
        mins[1] = val;
      if (val > maxs[1])
        maxs[1] = val;
    }
    out.texturemins = [Math.floor(mins[0] / 16) * 16, Math.floor(mins[1] / 16) * 16];
    out.extents = [Math.ceil(maxs[0] / 16) * 16 - out.texturemins[0], Math.ceil(maxs[1] / 16) * 16 - out.texturemins[1]];

    if (loadmodel.textures[tex.texture].turbulent === true)
      out.turbulent = true;
    else if (loadmodel.textures[tex.texture].sky === true)
      out.sky = true;

    loadmodel.faces[i] = out;
    fileofs += 20;
  }
};

export const setParent = function(node, parent)
{
  node.parent = parent;
  if (node.contents < 0)
    return;
  setParent(node.children[0], node);
  setParent(node.children[1], node);
};

export const loadNodes = function(buf)
{
  var view = new DataView(buf);
  var fileofs = view.getUint32((LUMP.nodes << 3) + 4, true);
  var filelen = view.getUint32((LUMP.nodes << 3) + 8, true);
  if ((filelen === 0) || ((filelen % 24) !== 0))
    sys.error('Mod.LoadNodes: funny lump size in ' + loadmodel.name);
  var count = filelen / 24;
  loadmodel.nodes = [];
  var i, out;
  for (i = 0; i < count; ++i)
  {
    loadmodel.nodes[i] = {
      num: i,
      contents: 0,
      planenum: view.getUint32(fileofs, true),
      children: [view.getInt16(fileofs + 4, true), view.getInt16(fileofs + 6, true)],
      mins: [view.getInt16(fileofs + 8, true), view.getInt16(fileofs + 10, true), view.getInt16(fileofs + 12, true)],
      maxs: [view.getInt16(fileofs + 14, true), view.getInt16(fileofs + 16, true), view.getInt16(fileofs + 18, true)],
      firstface: view.getUint16(fileofs + 20, true),
      numfaces: view.getUint16(fileofs + 22, true),
      cmds: []
    };
    fileofs += 24;
  }
  for (i = 0; i < count; ++i)
  {
    out = loadmodel.nodes[i];
    out.plane = loadmodel.planes[out.planenum];
    if (out.children[0] >= 0)
      out.children[0] = loadmodel.nodes[out.children[0]];
    else
      out.children[0] = loadmodel.leafs[-1 - out.children[0]];
    if (out.children[1] >= 0)
      out.children[1] = loadmodel.nodes[out.children[1]];
    else
      out.children[1] = loadmodel.leafs[-1 - out.children[1]];
  }
  setParent(loadmodel.nodes[0], undefined);
};

export const loadLeafs = function(buf)
{
  var view = new DataView(buf);
  var fileofs = view.getUint32((LUMP.leafs << 3) + 4, true);
  var filelen = view.getUint32((LUMP.leafs << 3) + 8, true);
  if ((filelen % 28) !== 0)
    sys.error('Mod.LoadLeafs: funny lump size in ' + loadmodel.name);
  var count = filelen / 28;
  loadmodel.leafs = [];
  var i, j, out;
  for (i = 0; i < count; ++i)
  {
    out = {
      num: i,
      contents: view.getInt32(fileofs, true),
      visofs: view.getInt32(fileofs + 4, true),
      mins: [view.getInt16(fileofs + 8, true), view.getInt16(fileofs + 10, true), view.getInt16(fileofs + 12, true)],
      maxs: [view.getInt16(fileofs + 14, true), view.getInt16(fileofs + 16, true), view.getInt16(fileofs + 18, true)],
      firstmarksurface: view.getUint16(fileofs + 20, true),
      nummarksurfaces: view.getUint16(fileofs + 22, true),
      ambient_level: [view.getUint8(fileofs + 24), view.getUint8(fileofs + 25), view.getUint8(fileofs + 26), view.getUint8(fileofs + 27)],
      cmds: [],
      skychain: 0,
      waterchain: 0
    };
    loadmodel.leafs[i] = out;
    fileofs += 28;
  };
};

export const loadClipnodes = function(buf)
{
  var view = new DataView(buf);
  var fileofs = view.getUint32((LUMP.clipnodes << 3) + 4, true);
  var filelen = view.getUint32((LUMP.clipnodes << 3) + 8, true);
  var count = filelen >> 3;
  loadmodel.clipnodes = [];

  loadmodel.hulls = [];
  loadmodel.hulls[1] = {
    clipnodes: loadmodel.clipnodes,
    firstclipnode: 0,
    lastclipnode: count - 1,
    planes: loadmodel.planes,
    clip_mins: [-16.0, -16.0, -24.0],
    clip_maxs: [16.0, 16.0, 32.0]
  };
  loadmodel.hulls[2] = {
    clipnodes: loadmodel.clipnodes,
    firstclipnode: 0,
    lastclipnode: count - 1,
    planes: loadmodel.planes,
    clip_mins: [-32.0, -32.0, -24.0],
    clip_maxs: [32.0, 32.0, 64.0]
  };
  var i;
  for (i = 0; i < count; ++i)
  {
    loadmodel.clipnodes[i] = {
      planenum: view.getUint32(fileofs, true),
      children: [view.getInt16(fileofs + 4, true), view.getInt16(fileofs + 6, true)]
    };
    fileofs += 8;
  }
};

export const makeHull0 = function()
{
  var node, child, clipnodes = [], i, out;
  var hull = {
    clipnodes: clipnodes,
    lastclipnode: loadmodel.nodes.length - 1,
    planes: loadmodel.planes,
    clip_mins: [0.0, 0.0, 0.0],
    clip_maxs: [0.0, 0.0, 0.0]
  };
  for (i = 0; i < loadmodel.nodes.length; ++i)
  {
    node = loadmodel.nodes[i];
    out = {planenum: node.planenum, children: []};
    child = node.children[0];
    out.children[0] = child.contents < 0 ? child.contents : child.num;
    child = node.children[1];
    out.children[1] = child.contents < 0 ? child.contents : child.num;
    clipnodes[i] = out;
  }
  loadmodel.hulls[0] = hull;
};

export const loadMarksurfaces = function(buf)
{
  var view = new DataView(buf);
  var fileofs = view.getUint32((LUMP.marksurfaces << 3) + 4, true);
  var filelen = view.getUint32((LUMP.marksurfaces << 3) + 8, true);
  var count = filelen >> 1;
  loadmodel.marksurfaces = [];
  var i, j;
  for (i = 0; i < count; ++i)
  {
    j = view.getUint16(fileofs + (i << 1), true);
    if (j > loadmodel.faces.length)
      sys.error('Mod.LoadMarksurfaces: bad surface number');
    loadmodel.marksurfaces[i] = j;
  }
};

export const loadSurfedges = function(buf)
{
  var view = new DataView(buf);
  var fileofs = view.getUint32((LUMP.surfedges << 3) + 4, true);
  var filelen = view.getUint32((LUMP.surfedges << 3) + 8, true);
  var count = filelen >> 2;
  loadmodel.surfedges = [];
  var i;
  for (i = 0; i < count; ++i)
    loadmodel.surfedges[i] = view.getInt32(fileofs + (i << 2), true);
}

export const loadPlanes = function(buf)
{
  var view = new DataView(buf);
  var fileofs = view.getUint32((LUMP.planes << 3) + 4, true);
  var filelen = view.getUint32((LUMP.planes << 3) + 8, true);
  if ((filelen % 20) !== 0)
    sys.error('Mod.LoadPlanes: funny lump size in ' + loadmodel.name);
  var count = filelen / 20;
  loadmodel.planes = [];
  var i, out;
  for (i = 0; i < count; ++i)
  {
    out = {
      normal: [view.getFloat32(fileofs, true), view.getFloat32(fileofs + 4, true), view.getFloat32(fileofs + 8, true)],
      dist: view.getFloat32(fileofs + 12, true),
      type: view.getUint32(fileofs + 16, true),
      signbits: 0
    };
    if (out.normal[0] < 0)
      ++out.signbits;
    if (out.normal[1] < 0)
      out.signbits += 2;
    if (out.normal[2] < 0)
      out.signbits += 4;
    loadmodel.planes[i] = out;
    fileofs += 20;
  }
};

export const loadBrushModel = function(buffer)
{
  loadmodel.type = TYPE.brush;
  var version = (new DataView(buffer)).getUint32(0, true);
  if (version !== VERSION.brush)
    sys.error('Mod.LoadBrushModel: ' + loadmodel.name + ' has wrong version number (' + version + ' should be ' + VERSION.brush + ')');
  loadVertexes(buffer);
  loadEdges(buffer);
  loadSurfedges(buffer);
  loadTextures(buffer);
  loadLighting(buffer);
  loadPlanes(buffer);
  loadTexinfo(buffer);
  loadFaces(buffer);
  loadMarksurfaces(buffer);
  loadVisibility(buffer);
  loadLeafs(buffer);
  loadNodes(buffer);
  loadClipnodes(buffer);
  makeHull0();
  loadEntities(buffer);
  loadSubmodels(buffer);

  var i, vert, mins = [0.0, 0.0, 0.0], maxs = [0.0, 0.0, 0.0];
  for (i = 0; i < loadmodel.vertexes.length; ++i)
  {
    vert = loadmodel.vertexes[i];
    if (vert[0] < mins[0])
      mins[0] = vert[0];
    else if (vert[0] > maxs[0])
      maxs[0] = vert[0];

    if (vert[1] < mins[1])
      mins[1] = vert[1];
    else if (vert[1] > maxs[1])
      maxs[1] = vert[1];

    if (vert[2] < mins[2])
      mins[2] = vert[2];
    else if (vert[2] > maxs[2])
      maxs[2] = vert[2];
  };
  loadmodel.radius = vec.length([
    Math.abs(mins[0]) > Math.abs(maxs[0]) ? Math.abs(mins[0]) : Math.abs(maxs[0]),
    Math.abs(mins[1]) > Math.abs(maxs[1]) ? Math.abs(mins[1]) : Math.abs(maxs[1]),
    Math.abs(mins[2]) > Math.abs(maxs[2]) ? Math.abs(mins[2]) : Math.abs(maxs[2])
  ]);
};

/*
==============================================================================

ALIAS MODELS

==============================================================================
*/

export const translatePlayerSkin = function(data, skin)
{
  const gl = GL.getContext()
  if ((loadmodel.skinwidth !== 512) || (loadmodel.skinheight !== 256))
    data = GL.resampleTexture(data, loadmodel.skinwidth, loadmodel.skinheight, 512, 256);
  var out = new Uint8Array(new ArrayBuffer(524288));
  var i, original;
  for (i = 0; i < 131072; ++i)
  {
    original = data[i];
    if ((original >> 4) === 1)
    {
      out[i << 2] = (original & 15) * 17;
      out[(i << 2) + 1] = 255;
    }
    else if ((original >> 4) === 6)
    {
      out[(i << 2) + 2] = (original & 15) * 17;
      out[(i << 2) + 3] = 255;
    }
  }
  skin.playertexture = gl.createTexture();
  GL.bind(0, skin.playertexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, out);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, GL.state.filter_min);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, GL.state.filter_max);
};

export const floodFillSkin = function(skin)
{
  var fillcolor = skin[0];
  if (fillcolor === filledcolor)
    return;

  var width = loadmodel.skinwidth;
  var height = loadmodel.skinheight;

  var lifo = [[0, 0]], sp, cur, x, y;

  for (sp = 1; sp > 0; )
  {
    cur = lifo[--sp];
    x = cur[0];
    y = cur[1];
    skin[y * width + x] = filledcolor;
    if (x > 0)
    {
      if (skin[y * width + x - 1] === fillcolor)
        lifo[sp++] = [x - 1, y];
    }
    if (x < (width - 1))
    {
      if (skin[y * width + x + 1] === fillcolor)
        lifo[sp++] = [x + 1, y];
    }
    if (y > 0)
    {
      if (skin[(y - 1) * width + x] === fillcolor)
        lifo[sp++] = [x, y - 1];
    }
    if (y < (height - 1))
    {
      if (skin[(y + 1) * width + x] === fillcolor)
        lifo[sp++] = [x, y + 1];
    }
  }
};

export const loadAllSkins = function(buffer, inmodel)
{
  loadmodel.skins = [];
  var model = new DataView(buffer);
  var i, j, group, numskins;
  var skinsize = loadmodel.skinwidth * loadmodel.skinheight;
  var skin;
  for (i = 0; i < loadmodel.numskins; ++i)
  {
    inmodel += 4;
    if (model.getUint32(inmodel - 4, true) === 0)
    {
      skin = new Uint8Array(buffer, inmodel, skinsize);
      floodFillSkin(skin);
      loadmodel.skins[i] = {
        group: false,
        texturenum: GL.loadTexture(loadmodel.name + '_' + i,
          loadmodel.skinwidth,
          loadmodel.skinheight,
          skin)
      };
      if (loadmodel.player === true)
        translatePlayerSkin(new Uint8Array(buffer, inmodel, skinsize), loadmodel.skins[i]);
      inmodel += skinsize;
    }
    else
    {
      group = {
        group: true,
        skins: []
      };
      numskins = model.getUint32(inmodel, true);
      inmodel += 4;
      for (j = 0; j < numskins; ++j)
      {
        group.skins[j] = {interval: model.getFloat32(inmodel, true)};
        if (group.skins[j].interval <= 0.0)
          sys.error('Mod.LoadAllSkins: interval<=0');
        inmodel += 4;
      }
      for (j = 0; j < numskins; ++j)
      {
        skin = new Uint8Array(buffer, inmodel, skinsize);
        floodFillSkin(skin);
        group.skins[j].texturenum = GL.loadTexture(loadmodel.name + '_' + i + '_' + j,
          loadmodel.skinwidth,
          loadmodel.skinheight,
          skin);
        if (loadmodel.player === true)
          translatePlayerSkin(new Uint8Array(buffer, inmodel, skinsize), group.skins[j]);
        inmodel += skinsize;
      }
      loadmodel.skins[i] = group;
    }
  }
  return inmodel;
};

export const loadAllFrames = function(buffer, inmodel)
{
  loadmodel.frames = [];
  var model = new DataView(buffer);
  var i, j, k, frame, group, numframes;
  for (i = 0; i < loadmodel.numframes; ++i)
  {
    inmodel += 4;
    if (model.getUint32(inmodel - 4, true) === 0)
    {
      frame = {
        group: false,
        bboxmin: [model.getUint8(inmodel), model.getUint8(inmodel + 1), model.getUint8(inmodel + 2)],
        bboxmax: [model.getUint8(inmodel + 4), model.getUint8(inmodel + 5), model.getUint8(inmodel + 6)],
        name: q.memstr(new Uint8Array(buffer, inmodel + 8, 16)),
        v: []
      };
      inmodel += 24;
      for (j = 0; j < loadmodel.numverts; ++j)
      {
        frame.v[j] = {
          v: [model.getUint8(inmodel), model.getUint8(inmodel + 1), model.getUint8(inmodel + 2)],
          lightnormalindex: model.getUint8(inmodel + 3)
        };
        inmodel += 4;
      }
      loadmodel.frames[i] = frame;
    }
    else
    {
      group = {
        group: true,
        bboxmin: [model.getUint8(inmodel + 4), model.getUint8(inmodel + 5), model.getUint8(inmodel + 6)],
        bboxmax: [model.getUint8(inmodel + 8), model.getUint8(inmodel + 9), model.getUint8(inmodel + 10)],
        frames: []
      };
      numframes = model.getUint32(inmodel, true);
      inmodel += 12;
      for (j = 0; j < numframes; ++j)
      {
        group.frames[j] = {interval: model.getFloat32(inmodel, true)};
        if (group.frames[j].interval <= 0.0)
          sys.error('Mod.LoadAllFrames: interval<=0');
        inmodel += 4;
      }
      for (j = 0; j < numframes; ++j)
      {
        frame = group.frames[j];
        frame.bboxmin = [model.getUint8(inmodel), model.getUint8(inmodel + 1), model.getUint8(inmodel + 2)];
        frame.bboxmax = [model.getUint8(inmodel + 4), model.getUint8(inmodel + 5), model.getUint8(inmodel + 6)];
        frame.name = q.memstr(new Uint8Array(buffer, inmodel + 8, 16));
        frame.v = [];
        inmodel += 24;
        for (k = 0; k < loadmodel.numverts; ++k)
        {
          frame.v[k] = {
            v: [model.getUint8(inmodel), model.getUint8(inmodel + 1), model.getUint8(inmodel + 2)],
            lightnormalindex: model.getUint8(inmodel + 3)
          };
          inmodel += 4;
        }
      }
      loadmodel.frames[i] = group;
    }
  }
};

export const loadAliasModel = function(buffer)
{
  var i, j, k, l;

  loadmodel.type = TYPE.alias;
  loadmodel.player = loadmodel.name === 'progs/player.mdl';
  var model = new DataView(buffer);
  var version = model.getUint32(4, true);
  if (version !== VERSION.alias)
    sys.error(loadmodel.name + ' has wrong version number (' + version + ' should be ' + VERSION.alias + ')');
  loadmodel.scale = [model.getFloat32(8, true), model.getFloat32(12, true), model.getFloat32(16, true)];
  loadmodel.scale_origin = [model.getFloat32(20, true), model.getFloat32(24, true), model.getFloat32(28, true)];
  loadmodel.boundingradius = model.getFloat32(32, true);
  loadmodel.numskins = model.getUint32(48, true);
  if (loadmodel.numskins === 0)
    sys.error('model ' + loadmodel.name + ' has no skins');
  loadmodel.skinwidth = model.getUint32(52, true);
  loadmodel.skinheight = model.getUint32(56, true);
  loadmodel.numverts = model.getUint32(60, true);
  if (loadmodel.numverts === 0)
    sys.error('model ' + loadmodel.name + ' has no vertices');
  loadmodel.numtris = model.getUint32(64, true);
  if (loadmodel.numtris === 0)
    sys.error('model ' + loadmodel.name + ' has no triangles');
  loadmodel.numframes = model.getUint32(68, true);
  if (loadmodel.numframes === 0)
    sys.error('model ' + loadmodel.name + ' has no frames');
  loadmodel.random = model.getUint32(72, true) === 1;
  loadmodel.flags = model.getUint32(76, true);
  loadmodel.mins = [-16.0, -16.0, -16.0];
  loadmodel.maxs = [16.0, 16.0, 16.0];

  var inmodel = loadAllSkins(buffer, 84);

  loadmodel.stverts = [];
  for (i = 0; i < loadmodel.numverts; ++i)
  {
    loadmodel.stverts[i] = {
      onseam: model.getUint32(inmodel, true) !== 0,
      s: model.getUint32(inmodel + 4, true),
      t: model.getUint32(inmodel + 8, true)
    };
    inmodel += 12;
  }

  loadmodel.triangles = [];
  for (i = 0; i < loadmodel.numtris; ++i)
  {
    loadmodel.triangles[i] = {
      facesfront: model.getUint32(inmodel, true) !== 0,
      vertindex: [
        model.getUint32(inmodel + 4, true),
        model.getUint32(inmodel + 8, true),
        model.getUint32(inmodel + 12, true)
      ]
    };
    inmodel += 16;
  }

  loadAllFrames(buffer, inmodel);

  var cmds = [];

  var triangle, vert, s;
  for (i = 0; i < loadmodel.numtris; ++i)
  {
    triangle = loadmodel.triangles[i];
    if (triangle.facesfront === true)
    {
      vert = loadmodel.stverts[triangle.vertindex[0]];
      cmds[cmds.length] = (vert.s + 0.5) / loadmodel.skinwidth;
      cmds[cmds.length] = (vert.t + 0.5) / loadmodel.skinheight;
      vert = loadmodel.stverts[triangle.vertindex[1]];
      cmds[cmds.length] = (vert.s + 0.5) / loadmodel.skinwidth;
      cmds[cmds.length] = (vert.t + 0.5) / loadmodel.skinheight;
      vert = loadmodel.stverts[triangle.vertindex[2]];
      cmds[cmds.length] = (vert.s + 0.5) / loadmodel.skinwidth;
      cmds[cmds.length] = (vert.t + 0.5) / loadmodel.skinheight;
      continue;
    }
    for (j = 0; j < 3; ++j)
    {
      vert = loadmodel.stverts[triangle.vertindex[j]];
      if (vert.onseam === true)
        cmds[cmds.length] = (vert.s + loadmodel.skinwidth / 2 + 0.5) / loadmodel.skinwidth;
      else
        cmds[cmds.length] = (vert.s + 0.5) / loadmodel.skinwidth;
      cmds[cmds.length] = (vert.t + 0.5) / loadmodel.skinheight;
    }
  }

  var group, frame;
  for (i = 0; i < loadmodel.numframes; ++i)
  {
    group = loadmodel.frames[i];
    if (group.group === true)
    {
      for (j = 0; j < group.frames.length; ++j)
      {
        frame = group.frames[j];
        frame.cmdofs = cmds.length << 2;
        for (k = 0; k < loadmodel.numtris; ++k)
        {
          triangle = loadmodel.triangles[k];
          for (l = 0; l < 3; ++l)
          {
            vert = frame.v[triangle.vertindex[l]];
            if (vert.lightnormalindex >= 162)
              sys.error('lightnormalindex >= NUMVERTEXNORMALS');
            cmds[cmds.length] = vert.v[0] * loadmodel.scale[0] + loadmodel.scale_origin[0];
            cmds[cmds.length] = vert.v[1] * loadmodel.scale[1] + loadmodel.scale_origin[1];
            cmds[cmds.length] = vert.v[2] * loadmodel.scale[2] + loadmodel.scale_origin[2];
            cmds[cmds.length] = r.state.avertexnormals[vert.lightnormalindex][0];
            cmds[cmds.length] = r.state.avertexnormals[vert.lightnormalindex][1];
            cmds[cmds.length] = r.state.avertexnormals[vert.lightnormalindex][2];
          }
        }
      }
      continue;
    }
    frame = group;
    frame.cmdofs = cmds.length << 2;
    for (j = 0; j < loadmodel.numtris; ++j)
    {
      triangle = loadmodel.triangles[j];
      for (k = 0; k < 3; ++k)
      {
        vert = frame.v[triangle.vertindex[k]];
        if (vert.lightnormalindex >= 162)
          sys.error('lightnormalindex >= NUMVERTEXNORMALS');
        cmds[cmds.length] = vert.v[0] * loadmodel.scale[0] + loadmodel.scale_origin[0];
        cmds[cmds.length] = vert.v[1] * loadmodel.scale[1] + loadmodel.scale_origin[1];
        cmds[cmds.length] = vert.v[2] * loadmodel.scale[2] + loadmodel.scale_origin[2];
        cmds[cmds.length] = r.state.avertexnormals[vert.lightnormalindex][0];
        cmds[cmds.length] = r.state.avertexnormals[vert.lightnormalindex][1];
        cmds[cmds.length] = r.state.avertexnormals[vert.lightnormalindex][2];
      }
    }
  }
  const gl = GL.getContext()
  loadmodel.cmds = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, loadmodel.cmds);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cmds), gl.STATIC_DRAW);
};

export const loadSpriteFrame = function(identifier, buffer, inframe, frame)
{
  var i;

  var model = new DataView(buffer);
  frame.origin = [model.getInt32(inframe, true), -model.getInt32(inframe + 4, true)];
  frame.width = model.getUint32(inframe + 8, true);
  frame.height = model.getUint32(inframe + 12, true);
  var size = frame.width * frame.height;

  var glt;
  for (i = 0; i < GL.state.textures.length; ++i)
  {
    glt = GL.state.textures[i];
    if (glt.identifier === identifier)
    {
      // JOE:FIXME: width height undefined! This was in the original code though
      //if ((width !== glt.width) || (height !== glt.height))
      sys.error('Mod.LoadSpriteFrame: cache mismatch');
      frame.texturenum = glt.texnum;
      return inframe + 16 + frame.width * frame.height;
    }
  }

  var data = new Uint8Array(buffer, inframe + 16, size);
  var scaled_width = frame.width, scaled_height = frame.height;
  if (((frame.width & (frame.width - 1)) !== 0) || ((frame.height & (frame.height - 1)) !== 0))
  {
    --scaled_width;
    scaled_width |= (scaled_width >> 1);
    scaled_width |= (scaled_width >> 2);
    scaled_width |= (scaled_width >> 4);
    scaled_width |= (scaled_width >> 8);
    scaled_width |= (scaled_width >> 16);
    ++scaled_width;
    --scaled_height;
    scaled_height |= (scaled_height >> 1);
    scaled_height |= (scaled_height >> 2);
    scaled_height |= (scaled_height >> 4);
    scaled_height |= (scaled_height >> 8);
    scaled_height |= (scaled_height >> 16);
    ++scaled_height;
  }
  if (scaled_width > GL.state.maxtexturesize)
    scaled_width = GL.state.maxtexturesize;
  if (scaled_height > GL.state.maxtexturesize)
    scaled_height = GL.state.maxtexturesize;
  if ((scaled_width !== frame.width) || (scaled_height !== frame.height))
  {
    size = scaled_width * scaled_height;
    data = GL.resampleTexture(data, frame.width, frame.height, scaled_width, scaled_height);
  }

  var trans = new ArrayBuffer(size << 2);
  var trans32 = new Uint32Array(trans);
  for (i = 0; i < size; ++i)
  {
    if (data[i] !== 255)
      trans32[i] = com.state.littleLong(vid.d_8to24table[data[i]] + 0xff000000);
  }
  const gl = GL.getContext()
  glt = {texnum: gl.createTexture(), identifier: identifier, width: frame.width, height: frame.height};
  GL.bind(0, glt.texnum);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, scaled_width, scaled_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(trans));
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, GL.state.filter_min);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, GL.state.filter_max);
  GL.state.textures[GL.state.textures.length] = glt;
  frame.texturenum = glt.texnum;
  return inframe + 16 + frame.width * frame.height;
}

export const loadSpriteModel = function(buffer)
{
  loadmodel.type = TYPE.sprite;
  var model = new DataView(buffer);
  var version = model.getUint32(4, true);
  if (version !== VERSION.sprite)
    sys.error(loadmodel.name + ' has wrong version number (' + version + ' should be ' + VERSION.sprite + ')');
  loadmodel.oriented = model.getUint32(8, true) === 3;
  loadmodel.boundingradius = model.getFloat32(12, true);
  loadmodel.width = model.getUint32(16, true);
  loadmodel.height = model.getUint32(20, true);
  loadmodel.numframes = model.getUint32(24, true);
  if (loadmodel.numframes === 0)
    sys.error('model ' + loadmodel.name + ' has no frames');
  loadmodel.random = model.getUint32(32, true) === 1;
  loadmodel.mins = [loadmodel.width * -0.5, loadmodel.width * -0.5, loadmodel.height * -0.5];
  loadmodel.maxs = [loadmodel.width * 0.5, loadmodel.width * 0.5, loadmodel.height * 0.5];

  loadmodel.frames = [];
  var inframe = 36, i, j, frame, group, numframes;
  for (i = 0; i < loadmodel.numframes; ++i)
  {
    inframe += 4;
    if (model.getUint32(inframe - 4, true) === 0)
    {
      frame = {group: false};
      loadmodel.frames[i] = frame;
      inframe = loadSpriteFrame(loadmodel.name + '_' + i + '_' + j, buffer, inframe, frame);
    }
    else
    {
      group = {
        group: true,
        frames: []
      };
      loadmodel.frames[i] = group;
      numframes = model.getUint32(inframe, true);
      inframe += 4;
      for (j = 0; j < numframes; ++j)
      {
        group.frames[j] = {interval: model.getFloat32(inframe, true)};
        if (group.frames[j].interval <= 0.0)
          sys.error('Mod.LoadSpriteModel: interval<=0');
        inframe += 4;
      }
      for (j = 0; j < numframes; ++j)
        inframe = loadSpriteFrame(loadmodel.name + '_' + i + '_' + j, buffer, inframe, group.frames[j]);
    }
  }
};

export const print = function()
{
  con.print('Cached models:\n');
  var i;
  for (i = 0; i < known.length; ++i)
    con.print(known[i].name + '\n');
};