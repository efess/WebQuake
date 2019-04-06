<template lang="pug">
  .setup-game.container
    h1 Use this screen to configure what pack files you want to provide to the game
    .card
      BaseAssets(:assetMetas="baseAssets")
    .card
      CustomAssets
</template>

<script>
import CustomAssets from './CustomAssets.vue'
import BaseAssets from './BaseAssets.vue'
import { mapGetters } from 'vuex'

export default {
  data () {
    return { 
      loading: true
    }
  },
  components: {
    CustomAssets,
    BaseAssets
  },
  computed: {
    ...mapGetters('game', ['allAssetMetas']),
    baseAssets() { return this.allAssetMetas.filter(assetMeta => assetMeta.game === 'id1') }
  }
}
</script>
<style>
</style>