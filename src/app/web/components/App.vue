<template lang="pug">
  .main
    template(v-if="game")
      Game(@quit="game=false")
    template(v-else)
      .container.grid-lg
        .columns
          .col-12
            header.navbar
              section.navbar-section
                a.navbar-brand.mr-2(@click="nav('home')") WebQuake
                a.btn.btn-link(@click="nav('online')") Online
                a.btn.btn-link(@click="nav('setupPlayer')") Player Setup
                a.btn.btn-link(@click="nav('setupGame')") Game Setup
                a.btn.btn-link(@click="nav('config')") Configuration
        .columns
          .col-12.app-content
            Component(:is="contentPage")
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

const pageMap = {
  online: null,
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
    Config
  },
  data()  {
    return {
      game: false,
      contentPage: Home
    }
  },
  methods: {
    doGame() {
      this.game = true
    },
    nav(page) {
      this.contentPage = pageMap[page] || Home
    }
  }
});
</script>