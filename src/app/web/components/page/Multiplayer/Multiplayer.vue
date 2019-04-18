<template lang="pug">
  .multiplayer
    table.table
      thead
        th Name
        th Connection
        th Location
        th Map
        th Players
        th Ping
        th 
      tbody
        tr(v-for="(server, key) in getServerStatuses")
          td {{server.name}}
          td {{server.connecthostport}}
          td {{server.location}}
          td {{server.map}}
          td {{formatPlayerCount(server)}}
          td {{server.ping}}
          td
            button.btn(@click="join(server)") Join
        
</template>

<script>
import {mapGetters, mapMutations} from 'vuex'

export default {
  data () {
    return {
    }
  },
  computed: {
    ...mapGetters('multiplayer', ['getServerStatuses'])
  },
  methods: {
    ...mapMutations('multiplayer', ['setAutoRefreshOff', 'setAutoRefreshOn']),
    join(server) {
      this.$router.push({name: 'quake', params: {server}})
    },
    formatPlayerCount (server) {
      return `${server.players.length}/${server.maxPlayers}`
    }
  },
  beforeRouteEnter (to, from, next) {
    return next(vm => {
      vm.setAutoRefreshOn()
    })
  },
  beforeRouteLeave (to, from, next) {
    this.setAutoRefreshOff()
    return next()
  }
}
</script>
