<template>
  <v-list two-line class="placed-dancer-list">
    <draggable
      v-model="dancers"
      :options="{ disabled: !draggingEnabled, handle: '.sortable-handle' }"
      @sort="$emit('dancer-reorder', $event)"
      class="draggable"
    >
      <dancer-list-item
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

        <v-switch
          slot="favorite"
          v-if="admin && index && dance[idKey] !== callbacks[idKey]"
          :input-value="dancer.$tie"
          @click.stop="$emit('dancer-toggle', [dancer, !dancer.$tie])"
        />
      </dancer-list-item>

      <slot />
    </draggable>
  </v-list>
</template>

<script>
import Draggable from 'vuedraggable';
import DancerListItem from '@/components/utility/DancerListItem.vue';
import { idKey } from '@/helpers/firebase';
import {
  overall,
  callbacks,
  getPlace,
} from '@/helpers/results';

export default {
  name: 'placed-dancer-list',
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

<style lang="scss">
.placed-dancer-list {

}
</style>
