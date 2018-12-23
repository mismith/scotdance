<template>
  <div class="admin-info app-scroll-frame app-scroll">
    <v-layout row align-center justify-center class="app-scroll-frame pa-3">
      <v-card>
        <v-card-media class="pa-3">
          <v-icon :size="88">event</v-icon>
        </v-card-media>
        <v-card-title>
          <div class="md-title">{{ competitions.length }} competitions</div>
        </v-card-title>
      </v-card>
      <v-card>
        <v-card-media class="pa-3">
          <v-icon :size="88" class="icon-people" />
        </v-card-media>
        <v-card-title>
          <div class="md-title">{{ users.length }} users</div>
        </v-card-title>
      </v-card>
      <v-card>
        <v-card-media class="pa-3">
          <v-icon :size="88" class="icon-question" />
        </v-card-media>
        <v-card-title>
          <div class="md-title">{{ faqs.length }} FAQs</div>
        </v-card-title>
      </v-card>
    </v-layout>
  </div>
</template>

<script>
export default {
  name: 'admin-info',
  props: {
    section: Object,
    users: Array,
    competitions: Array,
    faqs: Array,
  },
};
</script>

<style lang="scss">
.admin-info {

}
</style>
