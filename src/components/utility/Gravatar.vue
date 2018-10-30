<template>
  <img
    :src="user.photoURL || `https://gravatar.com/avatar/${hash}`"
    :alt="user.displayName"
    class="gravatar"
  />
</template>

<script>
import md5 from 'md5';

export default {
  name: 'gravatar',
  props: {
    user: Object,
  },
  computed: {
    hash() {
      return md5((this.user.email || '').toLowerCase());
    },
  },
};
</script>

<style lang="scss">
.gravatar {

}
</style>
