<template>
  <div class="competitions-list md-scroll-frame">
    <div class="md-scroll">
      <md-list class="md-double-line">
        <competition-list-item
          v-for="competition in competitions"
          :key="competition[idKey]"
          :competition="competition"
          @click="$router.push(`/competitions/${competition[idKey]}`)"
        />
      </md-list>
    </div>
  </div>
</template>

<script>
import {
  idKey,
  db,
} from '@/helpers/firebase';
import CompetitionListItem from '@/components/competition-list-item';

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
  components: {
    CompetitionListItem,
  },
};
</script>

<style lang="scss">
.competitions-list {

}
</style>
