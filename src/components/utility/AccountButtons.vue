<template>
  <div class="account-buttons">
    <v-btn
      @click="$store.commit('setCurrentDialog', 'register')"
      class="mx-0"
    >
      <span>Register</span>
    </v-btn>
    <v-btn
      color="secondary"
      @click="$store.commit('setCurrentDialog', 'login')"
      class="mx-0"
    >
      <span>Login</span>
    </v-btn>
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
