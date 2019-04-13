<template lang="pug">
  router-view
</template>

<script>
export default {
  methods: {
    joinMultiplayer (server) {
      this.serverToJoin = server
      this.game = true
    }
  }
};
</script>