<template lang="pug">
  .config
    label.form-label Quake config.cfg File
    button.btn(@click="loadRecommendedConfig") Load Recommended
    textarea(placeholder="Textarea" rows="20" cols="80" :value="getConfigFile" @input="saveConfig($event.target.value)")
</template>

<script>
import {mapActions, mapGetters} from 'vuex'


export default {
  computed: {
    ...mapGetters('game', ['getConfigFile'])
  },
  methods: {
    ...mapActions('game', ['saveConfig', 'loadRecommendedConfig'])
  },
  mounted (){
    this.$store.dispatch('game/loadConfig')
  }
}
</script>

<style>
</style>
