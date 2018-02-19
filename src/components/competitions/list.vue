<template>
  <div class="competitions-list md-scroll-frame">
    <div class="md-scroll">
      <md-list>
        <md-list-item
          v-for="competition in competitions"
          :key="competition[idKey]"
          @click="$router.push(`/competitions/${competition[idKey]}`)"
        >
          <md-icon>event</md-icon>
          <span class="md-list-item-text">{{ competition.name }}</span>
        </md-list-item>
      </md-list>
    </div>
  </div>
</template>

<script>
import {
  idKey,
  db,
} from '@/helpers/firebase';

export default {
  name: 'competitions-list',
  data() {
    return {
      idKey,
    };
  },
  firebase: {
    competitionsRaw: db.child('competitions'),
  },
  computed: {
    competitions() {
      return this.competitionsRaw.map(competition => ({
        ...competition,
        $favorite: this.$store.getters.isFavorite('competitions', competition[idKey]),
      }));
    },
  },
};
</script>

<style lang="scss">
.competitions-list {

}
</style>
