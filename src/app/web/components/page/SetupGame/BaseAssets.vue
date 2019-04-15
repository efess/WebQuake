<template lang="pug">
  .base-assets.container
    h2 Base Game
    h5 Here you may configure the base game "pak" files found in the id1 directory. Pak0 is optional, but Pak1 is required if you want to play the full registered game or any custom maps or mods.

    .columns
      .column.col-12
        Asset(
          label="id1/pak0.pack"
          game="id1"
          :assetMeta="packZero")
    .columns
      .column.col-12
        Asset(
          label="id1/pak1.pack"
          game="id1"
          :assetMeta="packOne"
          :assetVerifier="isId1Pak1"
          assetVerifierFailMessage="Not a valid registered quake pak file")

</template>

<script>
import Asset from './Asset.vue'
import {isId1Pak1} from '../../../helpers/assetChecker'

export default {
  props: {
    assetMetas: {
      type: Array,
      default: []
    }
  },
  data() {
    return {
      isId1Pak1
    }
  },
  components: {
    Asset
  },
  computed: {
    packOne() {
      return this.assetMetas.find(assetMeta => assetMeta.fileName.toLowerCase() === 'pak1.pak')
    },
    packZero() { 
      return this.assetMetas.find(assetMeta => assetMeta.fileName.toLowerCase() === 'pak0.pak')
    }
  }
}
</script>
