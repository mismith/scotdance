<template>
  <v-list two-line class="PlacedDancerList">
    <slot name="prepend" />
    <draggable
      v-model="displayDancers"
      handle=".sortable-handle"
      :disabled="!draggingEnabled"
      @sort="handleSort"
      class="draggable"
    >
      <v-slide-y-transition group hide-on-leave>
        <DancerListItem
          v-for="(dancer, index) in displayDancers"
          :key="dancer[idKey]"
          :dancer="dancer"
          :place="getPlace(dancer, dancers)"
          :to="asLinks && !isPlaceholderId(dancer[idKey]) && { name: 'competition.dancers', params: { dancerId: dancer[idKey] }}"
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
            <v-list-item-action v-if="admin && dance[idKey] !== callbacks[idKey] && !dancer.$points" class="ml-3">
              <v-switch
                v-show="reverseFrom ? index !== 0 : index"
                :input-value="reverseFrom ? (displayDancers[index - 1] && displayDancers[index - 1].$tie) : dancer.$tie"
                class="tieSwitch"
                @click.stop="handleTieToggle(index, dancer)"
              />
            </v-list-item-action>
            <span v-else-if="admin" />
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
  getReversePlace,
  isPlaceholderId,
} from '@/helpers/results';

export default {
  name: 'PlacedDancerList',
  props: {
    admin: {
      type: [Boolean, String],
      required: false,
    },
    asLinks: {
      type: Boolean,
      required: false,
    },
    dance: Object,
    dancers: Array,
    reverseFrom: {
      type: Number,
      required: false,
    },
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
      return this.admin && this.admin !== 'nodrag';
    },
    displayDancers: {
      get() {
        if (this.reverseFrom) {
          return [...this.dancers].reverse();
        }
        return this.dancers;
      },
      set() {
        // handled via @sort event, not v-model mutation
      },
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
    isPlaceholderId,

    handleSort(event) {
      if (this.reverseFrom) {
        const n = this.dancers.length - 1;
        this.$emit('dancer-reorder', {
          oldIndex: n - event.oldIndex,
          newIndex: n - event.newIndex,
        });
      } else {
        this.$emit('dancer-reorder', event);
      }
    },

    handleTieToggle(displayIndex, dancer) {
      if (this.reverseFrom) {
        // in reverse mode, tie controls the dancer above in display (next in data)
        const aboveDancer = this.displayDancers[displayIndex - 1];
        this.$emit('dancer-toggle', [aboveDancer, !aboveDancer.$tie]);
      } else {
        this.$emit('dancer-toggle', [dancer, !dancer.$tie]);
      }
    },

    getPlace(dancer, dancers) {
      if (this.dance[idKey] === callbacks[idKey] || this.dance[idKey] === all[idKey]) {
        // no places in callbacks or all dancers list
        return undefined;
      }
      if (this.reverseFrom) {
        return getReversePlace(dancer, dancers, this.reverseFrom);
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

<style lang="scss">
.PlacedDancerList {
  .tieSwitch {
    .v-input--switch__thumb {
      &::before {
        content: "TIE";
        color: black;
        font-size: 8px;
        letter-spacing: 0.1em;
      }
    }
  }
}
</style>
