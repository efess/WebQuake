import * as indexedDb from '../helpers/indexeddb'

const configFileName = 'Quake.id1/config.cfg'

const state = {
  assetMetas: [],
  configFile: '',
  newGameType: ''
}

const mutationTypes = {
  setAssetMetas: 'setAssetMetas',
  setConfigFile: 'setConfigFile'
}

const getters = {
  allAssetMetas: state => state.assetMetas,
  getConfigFile: state => state.configFile
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
    debugger
    localStorage[configFileName] = configFile
    commit(mutationTypes.setConfigFile, configFile)
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
