<template>
  <div class="competition-info md-scroll-frame">
    <div class="md-scroll">
      <h1>{{ competition.name }}</h1>
      <p>{{ competition.location }}</p>
    </div>
  </div>
</template>

<script>
import {
  idKey,
  db,
} from '@/helpers/firebase';

export default {
  name: 'competition-info',
  data() {
    return {
      idKey,
    };
  },
  firebase: {
    competition: {
      source: db.child('competitions').child('idc0'),
      asObject: true,
    },
  },
};
</script>

<style lang="scss">
.competition-info {
  padding: 0 16px;
}
</style>
