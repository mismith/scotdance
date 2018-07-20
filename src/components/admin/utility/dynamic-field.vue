<template>
  <div class="dynamic-field">
    <div v-if="field.type === 'avatar'" class="md-field md-layout md-alignment-center">
      <md-avatar class="md-large">
        <gravatar :user="data" />
      </md-avatar>
      <div class="md-layout-item md-padding">
        Avatar via <a href="https://gravatar.com/" target="_blank" class="ext">Gravatar</a>
      </div>
    </div>

    <md-field v-else-if="field.type === 'select'">
      <label>{{ field.title }}</label>
      <md-select
        v-model="data[field.data]"
        :required="field.required"
        :readonly="field.readonly"
        :disabled="field.disabled"
        @md-selected="handleChanges()"
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
      @input="handleChanges()"
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
      @change="handleChanges()"
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
        @change="handleChanges()"
      />
    </md-field>

    <md-field v-else>
      <label>{{ field.title }}</label>
      <md-input
        v-model="data[field.data]"
        :required="field.required"
        :readonly="field.readonly"
        :disabled="field.disabled"
        @change="handleChanges()"
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
