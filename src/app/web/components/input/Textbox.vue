<template lang="pug">
  .input-field
    label.label {{label}}
    input(:value="value_internal" @change="onchange")
</template>

<script>
export default {
  props: {
    label: {
      type: String,
      required: true
    },
    value: {
      type: String,
      default: ''
    }
  },
  data () {
    return {
      value_internal: this.value
    }
  },
  methods: {
    onchange() {
      this.$emit('input', onchange)
    }
  }
}
</script>

<style>

</style>
