<template>
  <v-list-tile
    :to="to"
    @click="$emit('click', $event)"
    class="dancer-list-item"
    :class="{ placeholder: dancer.number === '?' }"
  >
    <slot name="avatar">
      <v-list-tile-avatar :color="dancer.$favorite ? 'secondary' : 'grey'" class="white--text">
        <span>{{ dancer.number || '#' }}</span>
      </v-list-tile-avatar>
    </slot>

    <v-list-tile-content>
      <v-list-tile-title>{{ dancer.$name }}</v-list-tile-title>
      <v-list-tile-sub-title>
        <span v-if="dancer.$group" class="group">{{ dancer.$group.$name }}</span>
        <span class="location">{{ dancer.location }}</span>
      </v-list-tile-sub-title>
    </v-list-tile-content>

    <slot />

    <v-list-tile-action>
      <slot name="favorite">
        <favorite-dancer-button :dancer="dancer" @click.stop />
      </slot>
    </v-list-tile-action>
    <v-list-tile-action v-if="place !== undefined">
      <place v-if="place > 0" :place="place" class="primary--text" />
      <v-icon v-else-if="place === 0" color="primary" class="icon-trophy" />
    </v-list-tile-action>
  </v-list-tile>
</template>

<script>
import FavoriteDancerButton from '@/components/utility/FavoriteDancerButton.vue';
import Place from '@/components/utility/Place.vue';

export default {
  name: 'dancer-list-item',
  props: {
    dancer: Object,
    place: Number,
    to: true,
  },
  components: {
    FavoriteDancerButton,
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
            margin-right: 0.25em;
          }
        }
      }
    }
  }
  .place {
    margin-left: 12px;
  }

  &.placeholder {
    background: repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0, 0, 0, 0.1) 5px, rgba(0, 0, 0, 0.1) 10px);
  }
}
</style>
