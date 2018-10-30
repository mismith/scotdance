<template>
  <draggable
    element="md-list"
    v-model="dancers"
    :options="{ disabled: !draggingEnabled, handle: '.sortable-handle' }"
    @sort="$emit('dancer-reorder', $event)"
    class="placed-dancer-list md-double-line draggable"
  >
    <dancer-list-item
      v-for="(dancer, index) in dancers"
      :key="dancer[idKey]"
      :dancer="dancer"
      :place="getPlace(dancer, dancers)"
      @click="$emit('dancer-click', dancer)"
    >
      <md-icon v-if="draggingEnabled" class="sortable-handle">drag_indicator</md-icon>
      <md-switch
        v-if="admin && index && dance[idKey] !== callbacks[idKey]"
        v-model="dancer.$tie"
        @change="$emit('dancer-toggle', [dancer, $event])"
      />
      <span v-if="dance[idKey] === callbacks[idKey]" slot="icon" />
      <md-icon
        v-if="dance[idKey] === overall[idKey] && dancers.length <= 1"
        slot="icon"
        class="icon-trophy md-primary"
      />
    </dancer-list-item>

    <slot />
  </draggable>
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
    getPlace,
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
