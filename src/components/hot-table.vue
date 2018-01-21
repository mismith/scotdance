<template>
  <div />
</template>

<script>
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.css';

export default {
  name: 'hot-table',
  props: {
    options: {
      type: Object,
      default: () => ({}),
    },
  },
  data() {
    return {
      instance: undefined,
    };
  },
  mounted() {
    this.instance = new Handsontable(this.$el, this.options);
  },
  beforeDestroy() {
    if (this.instance) {
      this.instance.destroy();
    }
  },
};
</script>
