<template>
  <form @submit.prevent="handleSubmit" class="dynamic-form">
    <dynamic-field
      v-for="field in fields"
      :key="field.data"
      :field="field"
      :data="data"
      @input="handleInput"
      @change="handleChange"
    />
    <slot />
  </form>
</template>

<script>
import DynamicField from '@/components/admin/utility/DynamicField.vue';

export default {
  name: 'dynamic-form',
  props: {
    fields: Array,
    data: Object,
  },
  methods: {
    handleInput(change) {
      this.$emit('input', { change, form: this.$el });
    },
    handleChange(change) {
      this.$emit('change', change);
    },
    handleSubmit(event) {
      this.$emit('submit', event);
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
