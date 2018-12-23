<template>
  <div class="dynamic-field">
    <v-select
      v-if="field.type === 'select'"
      v-model="value"
      :label="field.title"
      :items="field.presets"
      item-text="name"
      :item-value="idKey"
      :required="field.required"
      :readonly="field.readonly"
      :disabled="field.disabled"
      @change="handleChanges()"
    />

    <v-checkbox
      v-else-if="field.type === 'checkbox'"
      v-model="value"
      :label="field.title"
      :required="field.required"
      :readonly="field.readonly"
      :disabled="field.disabled"
      @change="handleChanges()"
    />

    <v-textarea
      v-else-if="field.type === 'textarea'"
      v-model="value"
      :label="field.title"
      :required="field.required"
      :readonly="field.readonly"
      :disabled="field.disabled"
      auto-grow
      @change="handleChanges()"
    />

    <v-text-field
      v-else
      v-model="value"
      :label="field.title"
      :type="field.type || 'text'"
      :required="field.required"
      :readonly="field.readonly"
      :disabled="field.disabled"
      @change="handleChanges()"
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
    handleChanges() {
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
