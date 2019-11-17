<template>
  <div class="AdminInfo app-scroll-frame app-scroll">
    <div class="layout row align-center justify-center app-scroll-frame alt pa-4">
      <v-card>
        <v-responsive class="pa-4">
          <v-icon :size="88" class="icon-question" />
        </v-responsive>
        <v-card-title>
          <div class="title">{{ faqs.length }} FAQs</div>
        </v-card-title>
      </v-card>
      <v-card>
        <v-responsive class="pa-4">
          <v-icon :size="88">mdi-event</v-icon>
        </v-responsive>
        <v-card-title>
          <div class="title">{{ competitions.length }} competitions</div>
        </v-card-title>
      </v-card>
      <v-card>
        <v-responsive class="pa-4">
          <v-icon :size="88" class="icon-people" />
        </v-responsive>
        <v-card-title>
          <div class="title">{{ users.length }} users</div>
        </v-card-title>
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
    competitions: Array,
    faqs: Array,
  },
};
</script>
