<template>
  <img
    :src="user.photoURL || `https://avatars.io/gravatar/${encodeURIComponent(user.email)}`"
    :alt="user.displayName"
    class="gravatar"
  />
</template>

<script>
export default {
  name: 'gravatar',
  props: {
    user: Object,
  },
};
</script>

<style lang="scss">
.gravatar {

}
</style>
