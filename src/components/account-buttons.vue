<template>
  <div class="account-buttons">
    <md-button
      @click="$store.commit('setRegisterDialogOpen', true)"
      class="md-raised"
    >
      <span>Register</span>
    </md-button>
    <md-button
      @click="$store.commit('setLoginDialogOpen', true)"
      class="md-raised md-accent"
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

  .md-button {
    margin-left: 0;
    margin-right: 0;
  }
}
</style>
