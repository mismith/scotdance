<template>
  <v-list-item
    :to="to"
    @click="$emit('click', $event)"
    class="DancerListItem"
    :class="{ stripes: dancer.number === '?' }"
  >
    <slot name="avatar">
      <v-list-item-avatar :color="dancer.$favorite ? 'secondary' : 'grey'">
        <span>{{ dancer.number || '#' }}</span>
      </v-list-item-avatar>
    </slot>

    <v-list-item-content>
      <v-list-item-title>{{ dancer.$name }}</v-list-item-title>
      <v-list-item-subtitle class="dot-divided">
        <span v-if="dancer.$group" class="group">{{ dancer.$group.$name }}</span>
        <span v-if="detail" class="location">{{ detail }}</span>
      </v-list-item-subtitle>
    </v-list-item-content>

    <slot />

    <slot name="favorite">
      <v-list-item-action v-if="!isPlaceholderDancer">
        <FavoriteDancerButton :dancer="dancer" @click.stop />
      </v-list-item-action>
    </slot>
    <v-list-item-action v-if="place !== undefined">
      <v-icon v-if="dancer.$points" class="mr-3 my-3">{{ mdiCardsDiamond }}</v-icon>
      <Place v-else-if="place > 0" :place="place" />
      <v-icon v-else-if="place === 0" color="primary" class="icon-trophy" />
    </v-list-item-action>
  </v-list-item>
</template>

<script>
import { mdiCardsDiamond } from '@mdi/js';
import { formatHumanURL } from '@/helpers/router';
import FavoriteDancerButton from '@/components/FavoriteDancerButton.vue';
import Place from '@/components/Place.vue';

export default {
  name: 'DancerListItem',
  props: {
    dancer: Object,
    place: {
      type: Number,
      required: false,
    },
    to: {
      type: [Object, String],
      required: false,
    },
  },
  data() {
    return {
      mdiCardsDiamond,
    };
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
