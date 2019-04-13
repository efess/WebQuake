<template lang="pug">
  .multiplayer
    button.btn(@click="start()") Start Game
        
</template>

<script>
import {mapGetters, mapMutations} from 'vuex'

export default {
  data () {
    return {
    }
  },
  methods: {
    start(server) {
      this.$router.push({name: 'quake'})
    }
  }
}
</script>
