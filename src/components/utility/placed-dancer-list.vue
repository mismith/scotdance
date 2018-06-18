<template>
  <md-list class="md-double-line">
    <dancer-list-item
      v-for="(dancer, index) in dancers"
      :key="dancer[idKey]"
      :dancer="dancer"
      :place="getPlace(dancer, dancers)"
      @click="$emit('dancer-click', dancer)"
    >
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
  </md-list>
</template>

<script>
import DancerListItem from '@/components/utility/dancer-list-item';
import {
  idKey,
} from '@/helpers/firebase';
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
  methods: {
    getPlace,
  },
  components: {
    DancerListItem,
  },
};
</script>

<style lang="scss">
.placed-dancer-list {

}
</style>
