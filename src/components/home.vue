<template>
  <div class="home">
    <div>
      <img src="static/img/touchicon.png" role="presentation" width="128" height="128" />
      <h1 class="md-display-3">ScotDance</h1>
      <p class="md-headline">Highland dancing event tracker</p>
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
      window.alert('Coming Soon.\nFor now, Select Share > Add to Homescreen'); // eslint-disable-line no-alert
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
