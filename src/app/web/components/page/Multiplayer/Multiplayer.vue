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
            button.btn.tooltip.tooltip-left(@click="join(server)" :disabled="isDisabled(server)" :data-tooltip="tooltipText(server)") Join
        
</template>

<script>
import {mapGetters, mapMutations} from 'vuex'
const sharewareMaps = ['start', 'e1m1', 'e1m2', 'e1m3', 'e1m4', 'e1m5', 'e1m6', 'e1m7']
export default {
  data () {
    return {
    }
  },
  computed: {
    ...mapGetters('multiplayer', ['getServerStatuses']),
    ...mapGetters('game', ['hasRegistered'])
  },
  methods: {
    ...mapMutations('multiplayer', ['setAutoRefreshOff', 'setAutoRefreshOn']),
    join(server) {
      this.$router.push({name: 'quake', params: {server}})
    },
    formatPlayerCount (server) {
      return `${server.players.length}/${server.maxPlayers}`
    },
    isDisabled (server) {
      return !this.hasRegistered && !sharewareMaps.find(m => m === server.map)
    },
    tooltipText (server) {
      return this.isDisabled(server) ? "Must add registered assets in setup\n before joining this server" : "Join this game server"
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
