<template lang="pug">
  .setup-player
    Textbox(label="Player Name")
</template>

<script>
import Textbox from './input/Textbox.vue'
import {mapGetters, mapMutations} from 'vuex'

export default {
  components: {
    Textbox
  }
}
</script>
<style>
</style>