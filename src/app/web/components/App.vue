<template lang="pug">
  .main
    template(v-if="game")
      Game(@quit="game=false" :server="serverToJoin")
    template(v-else)
      .container.grid-lg
        .columns
          .col-12
            header.navbar
              section.navbar-section
                a.navbar-brand.mr-2(@click="nav('home')") WebQuake
                a.btn.btn-link(@click="nav('multiplayer')") Multiplayer
                a.btn.btn-link(@click="nav('setupPlayer')") Player Setup
                a.btn.btn-link(@click="nav('setupGame')") Game Setup
                a.btn.btn-link(@click="nav('config')") Configuration
        .columns
          .col-12.app-content
            Component(:is="contentPage" @joinMultiplayer="joinMultiplayer")
            div
              button(@click="doGame") Run Game
  
</template>

<script>
import Vue from "vue";
import Game from "./Game.vue"
import SetupPlayer from "./SetupPlayer.vue"
import SetupGame from "./page/SetupGame/SetupGame.vue"
import Config from "./page/Config.vue"
import Home from "./page/Home.vue"
import Multiplayer from "./page/Multiplayer/Multiplayer.vue"

const pageMap = {
  multiplayer: Multiplayer,
  home: Home,
  setupPlayer: SetupPlayer,
  setupGame: SetupGame,
  config: Config
}

export default Vue.extend({
  components: {
    Game,
    Home,
    SetupPlayer,
    SetupGame,
    Config,
    Multiplayer
  },
  data()  {
    return {
      game: false,
      contentPage: Home,
      serverToJoin: null
    }
  },
  methods: {
    doGame() {
      this.game = true
    },
    nav(page) {
      this.contentPage = pageMap[page] || Home
    },
    joinMultiplayer (server) {
      this.serverToJoin = server
      this.game = true
    }
  }
});
</script>