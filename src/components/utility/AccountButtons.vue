<template>
  <div class="account-buttons">
    <md-button
      @click="$store.commit('setCurrentDialog', 'register')"
      class="md-raised solo"
    >
      <span>Register</span>
    </md-button>
    <md-button
      @click="$store.commit('setCurrentDialog', 'login')"
      class="md-raised md-accent solo"
    >
      <span>Login</span>
    </md-button>
  </div>
</template>

<script>

export default {
  name: 'account-buttons',
};
</script>

<style lang="scss">
.account-buttons {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: auto;
}
</style>
