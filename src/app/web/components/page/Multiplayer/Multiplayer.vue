<template lang="pug">
  .multiplayer
    table.table
      thead
        th Name
        th Connection
        th Location
        th Game
        th Ping
        th 
      tbody
        tr(v-for="(server, key) in getServerStatuses")
          td {{server.name}}
          td {{server.connecthostport}}
          td {{server.location}}
          td {{server.game}}
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
