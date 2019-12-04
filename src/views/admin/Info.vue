<template>
  <div class="AdminInfo app-scroll-frame app-scroll alt pa-4">
    <div class="grid">
      <v-card to="faqs">
        <v-responsive class="pa-4">
          <v-icon :size="88" class="icon-question" />
        </v-responsive>
        <v-card-title class="title">{{ faqs.length }} FAQs</v-card-title>
      </v-card>
      <v-card to="submissions">
        <v-responsive class="pa-4">
          <v-icon :size="88">mdi-calendar-multiple</v-icon>
        </v-responsive>
        <v-card-title class="title">{{ submissions.length }} submissions</v-card-title>
      </v-card>
      <v-card to="users">
        <v-responsive class="pa-4">
          <v-icon :size="88" class="icon-people" />
        </v-responsive>
        <v-card-title class="title">{{ users.length }} users</v-card-title>
      </v-card>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AdminInfo',
  props: {
    section: Object,
    users: Array,
    submissions: Array,
    faqs: Array,
  },
};
</script>

<style lang="scss">
.AdminInfo {
  .grid {
    display: grid;
    grid-gap: 12px;
    grid-template-columns: repeat(3, minmax(200px, 1fr));
    margin: auto;

    .v-card > * {
      justify-content: center;
      text-align: center;
    }
  }
}
</style>
