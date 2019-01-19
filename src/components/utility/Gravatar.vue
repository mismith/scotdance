<template>
  <img
    :src="user.photoURL || `https://gravatar.com/avatar/${hash}`"
    :alt="user.displayName"
    class="Gravatar"
  />
</template>

<script>
import md5 from 'md5';

export default {
  name: 'Gravatar',
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
