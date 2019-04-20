import * as indexedDb from '../helpers/indexeddb'
const recommendedCfg = 
`bind "TAB" "+showscores"
bind "ENTER" "+jump"
bind "ESCAPE" "togglemenu"
bind "SPACE" "+jump"
bind "+" "sizeup"
bind "," "+moveleft"
bind "-" "sizedown"
bind "." "+moveright"
bind "/" "impulse 10"
bind "0" "impulse 0"
bind "1" "impulse 1"
bind "2" "impulse 2"
bind "3" "impulse 3"
bind "4" "impulse 4"
bind "5" "impulse 5"
bind "6" "impulse 6"
bind "7" "impulse 7"
bind "8" "impulse 8"
bind "=" "sizeup"
bind "\\" "+mlook"
bind "\`" "toggleconsole"
bind "a" "+lookup"
bind "c" "+movedown"
bind "d" "+moveup"
bind "t" "messagemode"
bind "z" "+lookdown"
bind "~" "toggleconsole"
bind "w" "+forward"
bind "s" "+back"
bind "a" "+moveleft"
bind "d" "+moveright"
bind "UPARROW" "+forward"
bind "DOWNARROW" "+back"
bind "LEFTARROW" "+left"
bind "RIGHTARROW" "+right"
bind "ALT" "+strafe"
bind "CTRL" "+attack"
bind "SHIFT" "+speed"
bind "F1" "help"
bind "F2" "menu_save"
bind "F3" "menu_load"
bind "F4" "menu_options"
bind "F5" "menu_multiplayer"
bind "F6" "echo Quicksaving...; wait; save quick"
bind "F9" "echo Quickloading...; wait; load quick"
bind "F10" "quit"
bind "F11" "zoom_in"
bind "F12" "screenshot"
bind "INS" "+klook"
bind "DEL" "+lookdown"
bind "PGDN" "+lookup"
bind "END" "centerview"
bind "MOUSE1" "+attack"
bind "MOUSE2" "+forward"
bind "MOUSE3" "+mlook"
bind "PAUSE" "pause"
crosshair "1"
gamma "0.4"
savedgamecfg "0"
saved1 "0"
saved2 "0"
saved3 "0"
saved4 "0"
viewsize "100"
volume "0.7"
bgmvolume "1"
_cl_name "player"
_cl_color "0"
cl_forwardspeed "400"
cl_backspeed "400"
lookspring "0"
lookstrafe "0"
sensitivity "3"
m_filter "1"
m_pitch "0.022"
m_yaw "0.022"
m_forward "1"
m_side "0.8"
+mlook`
const configFileName = 'Quake.id1/config.cfg'

const state = {
  assetMetas: [],
  configFile: '',
  newGameType: ''
}

const mutationTypes = {
  setAssetMetas: 'setAssetMetas',
  setConfigFile: 'setConfigFile',
  setRecommendedConfig: 'setRecommendedConfig'
}

const getters = {
  allAssetMetas: state => state.assetMetas,
  getConfigFile: state => state.configFile,
  hasRegistered: state => !!state.assetMetas.find(a => a.game === 'id1' && a.fileName.toLowerCase() === 'pak1.pak')
}

const mutations = {
  [mutationTypes.setAssetMetas] (state, assetMetas) {
    state.assetMetas = assetMetas
  },
  [mutationTypes.setConfigFile] (state, configFile) {
    state.configFile = configFile || ''
  }
}

const actions = {
  loadConfig ({commit}) {
    const configFile = localStorage[configFileName]
    commit(mutationTypes.setConfigFile, configFile)
  },
  saveConfig ({commit}, configFile) {
    localStorage[configFileName] = configFile
    commit(mutationTypes.setConfigFile, configFile)
  },
  loadRecommendedConfig ({commit}) {
    localStorage[configFileName] = recommendedCfg
    commit(mutationTypes.setConfigFile, recommendedCfg)
  },
  loadAssets ({commit}) {
    return indexedDb.getAllMeta()
      .then(allAssets => {
        commit(mutationTypes.setAssetMetas, allAssets)
      })
  },
  saveAsset ({ dispatch }, {game, fileName, fileCount, data}) {
    return indexedDb.saveAsset(game, fileName, fileCount, data)
      .then(() => dispatch('loadAssets'))
  },
  removeAsset ({ dispatch }, assetId) {
    return indexedDb.removeAsset(assetId)
      .then(() => dispatch('loadAssets'))
  }
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
}
