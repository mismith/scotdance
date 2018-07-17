<template>
  <form class="dynamic-form">
    <dynamic-field
      v-for="field in fields"
      :key="field.data"
      :field="field"
      :data="data"
      @change="handleChange(field.data, data[field.data])"
    />
  </form>
</template>

<script>
import DynamicField from '@/components/admin/utility/dynamic-field';

export default {
  name: 'dynamic-form',
  props: {
    path: String,
    fields: Array,
    data: Object,
  },
  methods: {
    handleChange(key, value) {
      this.$emit('change', {
        [`${this.path}/${key}`]: value,
      });
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
