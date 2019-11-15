<template>
  <v-list-item
    :to="to"
    @click="$emit('click', $event)"
    class="DancerListItem"
    :class="{ placeholder: dancer.number === '?' }"
  >
    <slot name="avatar">
      <v-list-item-avatar :color="dancer.$favorite ? 'secondary' : 'grey'">
        <span>{{ dancer.number || '#' }}</span>
      </v-list-item-avatar>
    </slot>

    <v-list-item-content>
      <v-list-item-title>{{ dancer.$name }}</v-list-item-title>
      <v-list-item-sub-title class="dot-divided">
        <span v-if="dancer.$group" class="group">{{ dancer.$group.$name }}</span>
        <span v-if="detail" class="location">{{ detail }}</span>
      </v-list-item-sub-title>
    </v-list-item-content>

    <slot />

    <slot name="favorite">
      <v-list-item-action>
        <FavoriteDancerButton :dancer="dancer" @click.stop />
      </v-list-item-action>
    </slot>
    <v-list-item-action v-if="place !== undefined">
      <place v-if="place > 0" :place="place" />
      <v-icon v-else-if="place === 0" color="primary" class="icon-trophy" />
    </v-list-item-action>
  </v-list-item>
</template>

<script>
import { formatHumanURL } from '@/helpers/router';
import FavoriteDancerButton from '@/components/FavoriteDancerButton.vue';
import Place from '@/components/Place.vue';

export default {
  name: 'DancerListItem',
  props: {
    dancer: Object,
    place: Number,
    to: true,
  },
  computed: {
    detail() {
      return this.dancer.location || formatHumanURL(this.dancer.website);
    },
  },
  mounted() {
    this.$emit('mounted', this.$el);
  },
  components: {
    FavoriteDancerButton,
    Place,
  },
};
</script>

<style lang="scss">
.DancerListItem {
  &.placeholder {
    background: repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0, 0, 0, 0.1) 5px, rgba(0, 0, 0, 0.1) 10px);
  }
}
</style>
