<template>
  <div class="profile md-scroll-frame">
    <div class="md-scroll">
      <form class="md-padding">
        <md-avatar>
          <img
            :src="me.photoURL || `//avatars.io/gravatar/${me.email}`"
            :alt="me.displayName"
          />
        </md-avatar>

        <md-field>
          <label>Display name</label>
          <md-input v-model="me.displayName" />
        </md-field>
        <md-field>
          <label>Email</label>
          <md-input v-model="me.email" readonly required />
        </md-field>
      </form>
    </div>
  </div>
</template>

<script>
import {
  mapState,
} from 'vuex';

export default {
  name: 'profile',
  computed: {
    ...mapState([
      'me',
    ]),
  },
};
</script>

<style lang="scss">
.profile {
  .md-avatar {
    min-width: 100px;
    min-height: 100px;
    border-radius: 50%;
    margin-bottom: 16px;
  }
}
</style>
