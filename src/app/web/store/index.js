import Vuex from 'vuex'
import Vue from 'vue'
import player from './player'
import game from './game'
import multiplayer from './multiplayer'
Vue.use(Vuex)


const store = new Vuex.Store({
  modules: {
    multiplayer,
    player,
    game
  },
})

store.dispatch('game/loadConfig');
store.dispatch('game/loadAssets');
store.dispatch('multiplayer/refreshLoop');

export default store