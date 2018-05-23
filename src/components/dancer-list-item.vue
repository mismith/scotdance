<template>
  <md-list-item @click="$emit('click', $event)" class="dancer-list-item">
    <md-avatar class="md-avatar-icon" :class="{'md-accent': dancer.$favorite}">
      <span>{{ dancer.number || '#' }}</span>
    </md-avatar>

    <div class="md-list-item-text">
      <span>{{ dancer.$name }}</span>
      <p>
        <span class="group">{{ dancer.$group && dancer.$group.$name }}</span>
        <span class="location">{{ dancer.location }}</span>
      </p>
    </div>

    <slot />

    <md-button
      v-if="$store.state.me"
      @click.stop="handleFavoriteToggle(dancer)"
      class="md-icon-button md-list-action"
    >
      <md-icon :class="{'md-accent': dancer.$favorite}">
        {{ dancer.$favorite ? 'star' : 'star_border' }}
      </md-icon>
    </md-button>

    <slot name="icon">
      <place v-if="place !== undefined" :place="place" />
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
  .md-list-item-text {
    p {
      span {
        &:not(:last-child) {
          &::after {
            content: "•";
            display: inline-block;
            margin-left: 0.25em;
          }
        }
      }
    }
  }
  .place {
    margin-left: 12px;
  }
}
</style>
