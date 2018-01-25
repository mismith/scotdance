<template>
  <div class="home">
    <div style="margin-top: -10vh;">
      <img src="/static/touchicon.svg" role="presentation" width="200" />
      <h1 class="md-display-3">ScotDance</h1>
      <p class="md-headline">App for highland dancing events</p>
      <p>
        <md-button @click.prevent="TODO()" class="md-primary md-raised">Install App</md-button>
      </p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'home',
  methods: {
    TODO() {
      window.alert('Coming Soon.\nFor now, Select Share > Add to Homescreen');
    },
  },
};
</script>

<style lang="scss">
.home {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  text-align: center;
}
</style>
