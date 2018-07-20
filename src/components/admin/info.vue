<template>
  <div class="admin-info md-scroll-frame md-scroll">
    <section class="md-layout md-alignment-center md-scroll-frame md-padding" style="flex-direction: row;">
      <md-card>
        <md-card-header class="md-layout md-alignment-center">
          <md-icon class="md-size-4x">event</md-icon>
        </md-card-header>
        <md-card-content class="md-layout md-alignment-center">
          <div class="md-title">{{ competitions.length }} competitions</div>
        </md-card-content>
      </md-card>
      <md-card>
        <md-card-header class="md-layout md-alignment-center">
          <md-icon class="md-size-4x icon-people" />
        </md-card-header>
        <md-card-content class="md-layout md-alignment-center">
          <div class="md-title">{{ users.length }} users</div>
        </md-card-content>
      </md-card>
      <md-card>
        <md-card-header class="md-layout md-alignment-center">
          <md-icon class="md-size-4x icon-question" />
        </md-card-header>
        <md-card-content class="md-layout md-alignment-center">
          <div class="md-title">{{ faqs.length }} FAQs</div>
        </md-card-content>
      </md-card>
    </section>
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
