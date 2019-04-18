<template lang="pug">
  .assets(:class="loading ? 'loading-lg' : ''")
    .todo Todo : add custom game assets
    
</template>

<script>
import {getAllMeta} from '../../../../helpers/indexeddb'
import {groupBy, keys} from 'ramda'

export default {
  components: {
  },
  props: {
    assetMetas: {
      type: Array,
      default: () => []
    }
  },
  data () {
    return {
      storeNames: [],
      selectedStore: 'id1',
      loading: true
    }
  },
  computed: {
    gameList () {
      return keys(groupBy(d => d.game, this.assetMetas))
    }
  },
  mounted () {
    getAllMeta()
      .then(metas => {
        this.storeNames = metas.map(meta => meta.game)
        this.loading = false
      })
      .catch(() => {
        this.loading = false
      })
  }
}
</script>
