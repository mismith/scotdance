<template>
  <v-list two-line class="PlacedDancerList">
    <draggable
      v-model="dancers"
      handle=".sortable-handle"
      :disabled="!draggingEnabled"
      @sort="$emit('dancer-reorder', $event)"
      class="draggable"
    >
      <v-slide-y-transition group hide-on-leave>
        <DancerListItem
          v-for="(dancer, index) in dancers"
          :key="dancer[idKey]"
          :dancer="dancer"
          :place="getPlace(dancer, dancers)"
          @click="$emit('dancer-click', dancer)"
          @mounted="handleDancerMounted(dancer, $event)"
        >
          <v-icon
            v-if="draggingEnabled && dance[idKey] !== callbacks[idKey]"
            class="sortable-handle"
          >
            {{ mdiDragVertical }}
          </v-icon>

          <template #favorite>
            <v-list-item-action v-if="admin && dance[idKey] !== callbacks[idKey]">
              <v-switch
                v-show="index"
                :input-value="dancer.$tie"
                @click.stop="$emit('dancer-toggle', [dancer, !dancer.$tie])"
              />
            </v-list-item-action>
          </template>
        </DancerListItem>
      </v-slide-y-transition>

      <slot />
    </draggable>
  </v-list>
</template>

<script>
import Draggable from 'vuedraggable';
import { mdiDragVertical } from '@mdi/js';
import DancerListItem from '@/components/DancerListItem.vue';
import { idKey } from '@/helpers/firebase';
import {
  all,
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
      mdiDragVertical,
      overall,
      callbacks,

      dancerEls: {},
    };
  },
  computed: {
    draggingEnabled() {
      return !!this.admin;
    },
  },
  watch: {
    async dancers(dancers, prev) {
      // if a newly added dancer, lookup and emit its DOM element
      if (dancers && prev && dancers.length > prev.length) {
        const prevIds = prev.map((dancer) => dancer[idKey]);

        await this.$nextTick(); // wait for the element to be mounted first

        dancers.forEach((dancer) => {
          if (!prevIds.includes(dancer[idKey])) {
            const el = this.dancerEls[dancer[idKey]];
            if (el) {
              this.$emit('dancer-added', dancer, el);
            }
          }
        });
      }
    },
  },
  methods: {
    getPlace(dancer, dancers) {
      if (this.dance[idKey] === callbacks[idKey] || this.dance[idKey] === all[idKey]) {
        // no places in callbacks or all dancers list
        return undefined;
      }
      if (this.dance[idKey] === overall[idKey] && dancers.length <= 1) return 0; // overall winner
      return getPlace(dancer, dancers);
    },

    handleDancerMounted(dancer, el) {
      // store map of dancerIds and their respective elements
      this.dancerEls[dancer[idKey]] = el;
    },
  },
  components: {
    Draggable,
    DancerListItem,
  },
};
</script>
