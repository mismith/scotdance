<template>
  <v-list two-line class="PlacedDancerList">
    <draggable
      v-model="dancers"
      :options="{ disabled: !draggingEnabled, handle: '.sortable-handle' }"
      @sort="$emit('dancer-reorder', $event)"
      class="draggable"
    >
      <DancerListItem
        v-for="(dancer, index) in dancers"
        :key="dancer[idKey]"
        :dancer="dancer"
        :place="getPlace(dancer, dancers)"
        @click="$emit('dancer-click', dancer)"
      >
        <v-icon
          v-if="draggingEnabled && dance[idKey] !== callbacks[idKey]"
          class="sortable-handle"
        >
          drag_indicator
        </v-icon>

        <v-list-action
          slot="favorite"
          v-if="admin && dance[idKey] !== callbacks[idKey]"
        >
          <v-switch
            v-show="index"
            :input-value="dancer.$tie"
            @click.stop="$emit('dancer-toggle', [dancer, !dancer.$tie])"
          />
        </v-list-action>
      </DancerListItem>

      <slot />
    </draggable>
  </v-list>
</template>

<script>
import Draggable from 'vuedraggable';
import DancerListItem from '@/components/DancerListItem.vue';
import { idKey } from '@/helpers/firebase';
import {
  overall,
  callbacks,
  getPlace,
} from '@/helpers/results';

export default {
  name: 'PlacedDancerList',
  props: {
    admin: Boolean,
    dance: Object,
    dancers: Array,
  },
  data() {
    return {
      idKey,
      overall,
      callbacks,
    };
  },
  computed: {
    draggingEnabled() {
      return !!this.admin;
    },
  },
  methods: {
    getPlace(dancer, dancers) {
      if (this.dance[idKey] === callbacks[idKey]) return undefined; // no places in callbacks
      if (this.dance[idKey] === overall[idKey] && dancers.length <= 1) return 0; // overall winner
      return getPlace(dancer, dancers);
    },
  },
  components: {
    Draggable,
    DancerListItem,
  },
};
</script>
