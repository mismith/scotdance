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
      <v-list-item-title>
        {{ dancer.$name }}
        <HelpTip v-if="isPlaceholderDancer">
          This is a <em>placeholder</em> dancer.<br />
          <br />
          Typically, competition organizers will use this to denote that a dancer is missing, invalid, misheard, or otherwise problematic—and should be fixed later.
        </HelpTip>
      </v-list-item-title>
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
import { isPlaceholderId } from '@/helpers/results';
import { idKey } from '@/helpers/firebase';
import FavoriteDancerButton from '@/components/FavoriteDancerButton.vue';
import Place from '@/components/Place.vue';
import HelpTip from '@/components/HelpTip.vue';

export default {
  name: 'DancerListItem',
  props: {
    dancer: {
      type: Object,
      required: true,
    },
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
    isPlaceholderDancer() {
      return isPlaceholderId(this.dancer[idKey]);
    },
  },
  mounted() {
    this.$emit('mounted', this.$el);
  },
  components: {
    FavoriteDancerButton,
    Place,
    HelpTip,
  },
};
</script>
