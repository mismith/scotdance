<template>
  <div class="AccountButtons">
    <v-btn
      light
      @click="$store.commit('setCurrentDialog', 'register')"
      class="ma-1"
      v-test="'account-buttons:register'"
    >
      <span>Register</span>
    </v-btn>
    <v-btn
      color="secondary"
      @click="$store.commit('setCurrentDialog', 'login')"
      class="ma-1"
      v-test="'account-buttons:login'"
    >
      <span>Login</span>
    </v-btn>
  </div>
</template>

<script>

export default {
  name: 'AccountButtons',
};
</script>

<style lang="scss">
.AccountButtons {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: auto;

  > .v-btn.v-size--default {
    min-width: 120px;
  }
}
</style>
