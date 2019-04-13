<template lang="pug">
  .game-container  
    span#progress Starting Quake...
    canvas#mainwindow
    img#loading(alt="Loading" style="display: none; position: fixed;")
</template>

<script>
import Vue from 'vue'
import GameInit from '../../game'

const gameHooks = (vueComp) => ({
  quit: () => vueComp.$emit('quit')
})

export default Vue.extend({
  props: {
    server: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      gameSys: null,
      gameQuit: false
    }
  },
  mounted() {
    this.gameSys = GameInit(this.args, {
      // hooks
      quit: () => {
        this.gameQuit = true
        this.$router.go(-1)
      }
    })
  },
  computed: {
    args () {
      const server = this.server
      const _args = []
      if (this.server) {
        _args.push(`-connect ws://${server.dns}:${server.port}`)
      } 
      return _args.join(' ')
    }
  },
  beforeRouteLeave (to, from, next) {
    if (this.gameQuit) {
      return next()
    }
    const answer = window.confirm('Do you really want to leave?')
    if (answer) {
      this.gameSys.quit()
      next()
    } else {
      next(false)
    }
  }
})
</script>

<style>
.game-container {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}
</style>
