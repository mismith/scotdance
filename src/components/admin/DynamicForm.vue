<template>
  <v-form ref="form" v-model="value" class="DynamicForm" @submit.prevent="handleSubmit">
    <DynamicField
      v-for="field in fields"
      :key="field.data"
      :field="field"
      :data="data"
      @input="handleInput"
      @change="handleChange"
    />
    <slot />
  </v-form>
</template>

<script>
import DynamicField from '@/components/admin/DynamicField.vue';

export default {
  name: 'DynamicForm',
  props: {
    value: {
      type: Boolean,
      required: false,
    },
    fields: Array,
    data: Object,
  },
  watch: {
    value(v) {
      this.$emit('input', v);
    },
  },
  methods: {
    handleInput(change) {
      this.$emit('field-input', change);
    },
    handleChange(change) {
      this.$emit('field-change', change);
    },
    handleSubmit(event) {
      this.$refs.form.validate();
      this.$emit('submit', event);
    },
  },
  components: {
    DynamicField,
  },
};
</script>
