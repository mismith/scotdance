<template>
  <div class="dynamic-field">
    <md-field v-if="field.type === 'select'">
      <label>{{ field.title }}</label>
      <md-select
        v-model="data[field.data]"
        :required="field.required"
        :readonly="field.readonly"
        :disabled="field.disabled"
        @md-selected="handleChange($event)"
      >
        <md-option
          v-for="preset in field.presets"
          :key="preset[idKey]"
          :value="preset[idKey]"
        >
          {{ preset.$name || preset.name }}
        </md-option>
        <md-option v-if="!field.presets.length" disabled>
          None found.
        </md-option>
      </md-select>
    </md-field>

    <md-datepicker
      v-else-if="field.type === 'datetime'"
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
      :required="field.required"
      :readonly="field.readonly"
      :disabled="field.disabled"
      @change="handleChange($event)"
    >
      {{ field.title }}
    </md-checkbox>

    <md-field v-else-if="field.type === 'textarea'">
      <label>{{ field.title }}</label>
      <md-textarea
        v-model="data[field.data]"
        :required="field.required"
        :readonly="field.readonly"
        :disabled="field.disabled"
        md-autogrow
        @change="handleChange($event.target.value)"
      />
    </md-field>

    <md-field v-else>
      <label>{{ field.title }}</label>
      <md-input
        v-model="data[field.data]"
        :required="field.required"
        :readonly="field.readonly"
        :disabled="field.disabled"
        @change="handleChange($event.target.value)"
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
    handleChange() {
      this.$emit('change', this.data);
    },
  },
};
</script>

<style lang="scss">
.dynamic-field {

}
</style>
