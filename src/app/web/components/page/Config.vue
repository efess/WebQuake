<template lang="pug">
  .config
    label.form-label Quake Configuration
    textarea(placeholder="Textarea" rows="20" cols="80" :value="getConfigFile" @input="saveConfig($event.target.value)")
</template>

<script>
import {mapActions, mapGetters} from 'vuex'


export default {
  computed: {
    ...mapGetters('game', ['getConfigFile'])
  },
  methods: {
    ...mapActions('game', ['saveConfig'])
  },
  mounted (){
    this.$store.dispatch('game/loadConfig')
  }
}
</script>

<style>
</style>
