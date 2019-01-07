<template>
  <div class="dynamic-field">
    <v-select
      v-if="field.type === 'select'"
      v-model="value"
      :label="getLabel(field)"
      :items="field.presets"
      item-text="name"
      :item-value="idKey"
      :required="field.required"
      :readonly="field.readonly"
      :disabled="field.disabled"
      @input="handleInput()"
      @change="handleChange()"
    />

    <v-checkbox
      v-else-if="field.type === 'checkbox'"
      v-model="value"
      :label="getLabel(field)"
      :required="field.required"
      :readonly="field.readonly"
      :disabled="field.disabled"
      @input="handleInput()"
      @change="handleChange()"
    />

    <v-textarea
      v-else-if="field.type === 'textarea'"
      v-model="value"
      :label="getLabel(field)"
      :required="field.required"
      :readonly="field.readonly"
      :disabled="field.disabled"
      auto-grow
      @input="handleInput()"
      @change="handleChange()"
    />

    <v-text-field
      v-else
      v-model="value"
      :label="getLabel(field)"
      :type="field.type || 'text'"
      :required="field.required"
      :readonly="field.readonly"
      :disabled="field.disabled"
      @input="handleInput()"
      @change="handleChange()"
    />
  </div>
</template>

<script>
import { idKey } from '@/helpers/firebase';

export default {
  name: 'dynamic-field',
  props: {
    field: Object,
    data: Object,
  },
  data() {
    return {
      idKey,
    };
  },
  computed: {
    value: {
      get() {
        return this.data[this.field.data];
      },
      set(value) {
        this.data[this.field.data] = value;
      },
    },
  },
  methods: {
    getLabel(field) {
      return `${field.title}${field.required ? ' *' : ''}`;
    },
    handleInput() {
      this.$emit('input', {
        [this.field.data]: this.data[this.field.data],
      });
    },
    handleChange() {
      this.$emit('change', {
        [this.field.data]: this.data[this.field.data],
      });
    },
  },
};
</script>

<style lang="scss">
.dynamic-field {

}
</style>
