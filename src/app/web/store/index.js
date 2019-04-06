import Vuex from 'vuex'
import Vue from 'vue'
import player from './player'
import game from './game'

Vue.use(Vuex)


const store = new Vuex.Store({
  modules: {
    player,
    game
  },
})

store.dispatch('game/loadConfig');
store.dispatch('game/loadAssets');

export default store