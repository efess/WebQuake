<template lang="pug">
  .multiplayer
    .buttons
      button.btn(@click="refresh") Refresh
    table.table(:class="loading ? 'loading': ''")
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
          td {{server.dns}}:{{server.port}}
          td {{server.location}}
          td {{server.game}}
          td {{server.ping}}
          td
            button.btn(@click="join(server)") Join
        
</template>

<script>
import {mapActions, mapGetters} from 'vuex'

const refreshRate = 5000

export default {
  data () {
    return {
      loading: true,
      autoRefreshId: null
    }
  },
  computed: {
    ...mapGetters('multiplayer', ['getServerStatuses'])
  },
  mounted() {
    this.refresh()
      .then(this.autoRefresh)
  },
  destroy() {
    debugger
    clearTimeout(this.autoRefreshId)
  },
  methods: {
    ...mapActions('multiplayer', ['loadServerStatuses', 'pingAllServers']),
    autoRefresh () {
      this.autoRefreshId = setTimeout(() => {
        this.refresh()
          .then(this.autoRefresh)
      }, refreshRate)
    },
    refresh() {
      this.loading = true;
      return this.loadServerStatuses()
        .then(() => {
          this.loading = false
        }, () => {
          this.loading = false
        })
        .then(this.pingAllServers)
    },
    join(server) {
      this.$emit('joinMultiplayer', server)
    }
  }
}
</script>
