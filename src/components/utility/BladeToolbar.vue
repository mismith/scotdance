<template>
  <v-toolbar dense class="blade-toolbar">
    <v-btn flat icon @click="handleClick">
      <v-icon>chevron_left</v-icon>
    </v-btn>
    <div v-html="text || ($route.meta && $route.meta.title) || 'Back'" />
  </v-toolbar>
</template>

<script>
export default {
  name: 'blade-toolbar',
  props: {
    text: String,
  },
  methods: {
    handleClick() {
      this.$router.go(-1);
    },
  },
};
</script>

<style lang="scss">
.blade-toolbar {

}
</style>
