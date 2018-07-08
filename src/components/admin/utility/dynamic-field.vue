<template>
  <div class="dynamic-field">
    <md-datepicker
      v-if="field.type === 'datetime'"
      v-model="data[field.data]"
      md-immediately
      @input="handleChange($event)"
      :class="{ 'md-required': field.required }"
    >
      <label>{{ field.title }}</label>
    </md-datepicker>

    <md-checkbox
      v-else-if="field.type === 'checkbox'"
      v-model="data[field.data]"
      @change="handleChange($event)"
      :required="field.required"
      :readonly="field.readonly"
      :disabled="field.disabled"
    >
      {{ field.title }}
    </md-checkbox>

    <md-field v-else>
      <label>{{ field.title }}</label>
      <md-input
        v-model="data[field.data]"
        @change="handleChange($event.target.value)"
        :required="field.required"
        :readonly="field.readonly"
        :disabled="field.disabled"
      />
    </md-field>
  </div>
</template>

<script>
import {
  idKey,
} from '@/helpers/firebase';

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
  methods: {
    handleChange(value) {
      this.$emit('change', value);
    },
  },
};
</script>

<style lang="scss">
.dynamic-field {

}
</style>
