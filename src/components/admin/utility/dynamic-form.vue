<template>
  <form class="dynamic-form">
    <dynamic-field
      v-for="field in fields"
      :key="field.data"
      :field="field"
      :data="data"
      @change="handleChanges"
    />
  </form>
</template>

<script>
import DynamicField from '@/components/admin/utility/dynamic-field';

export default {
  name: 'dynamic-form',
  props: {
    fields: Array,
    data: Object,
  },
  methods: {
    handleChanges(changes) {
      this.$emit('change', changes);
    },
  },
  components: {
    DynamicField,
  },
};
</script>

<style lang="scss">
.dynamic-form {

}
</style>
