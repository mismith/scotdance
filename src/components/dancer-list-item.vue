<template>
  <md-list-item @click="$emit('click', $event)" class="dancer-list-item">
    <md-avatar class="md-avatar-icon" :class="{'md-accent': dancer.$favorite}">
      <span>{{ dancer.number }}</span>
    </md-avatar>

    <div class="md-list-item-text">
      <span>{{ dancer.$name }}</span>
      <p>{{ dancer.$group && dancer.$group.$name }} • {{ dancer.location }}</p>
    </div>

    <slot />

    <slot name="icon">
      <place v-if="place !== undefined" :place="place" />
      <md-button
        v-else-if="$store.state.me"
        @click.stop="handleFavoriteToggle(dancer)"
        class="md-icon-button md-list-action"
      >
        <md-icon :class="{'md-accent': dancer.$favorite}">
          {{ dancer.$favorite ? 'star' : 'star_border' }}
        </md-icon>
      </md-button>
    </slot>
  </md-list-item>
</template>

<script>
import {
  idKey,
  db,
} from '@/helpers/firebase';
import Place from '@/components/place';

export default {
  name: 'dancer-list-item',
  props: {
    dancer: Object,
    place: Number,
  },
  methods: {
    handleFavoriteToggle(dancer) {
      return db
        .child('users:favorites')
        .child(this.$store.state.me[idKey])
        .child('dancers')
        .child(dancer[idKey])
        .set(dancer.$favorite ? null : true);
    },
  },
  components: {
    Place,
  },
};
</script>

<style lang="scss">
.dancer-list-item {

}
</style>
