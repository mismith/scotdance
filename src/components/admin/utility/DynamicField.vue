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
      :hint="field.description"
      @input="handleInput()"
      @change="handleChange()"
    />

    <image-uploader
      v-else-if="field.type === 'image'"
      v-model="value"
      :storage-path="field.storagePath"
      :label="getLabel(field)"
      :required="field.required"
      :disabled="field.disabled"
      :hint="field.description"
      @input="handleInput()"
      @change="handleChange()"
    />

    <v-menu
      v-else-if="field.type === 'date'"
      v-model="datePicking"
      :close-on-content-click="false"
      full-width
      max-width="290"
    >
      <v-text-field
        slot="activator"
        :value="value"
        :label="getLabel(field)"
        :required="field.required"
        :disabled="field.disabled"
        :hint="field.description"
        readonly
        @focus="datePicking = true"
      />
      <v-date-picker
        v-model="value"
        @input="datePicking = false; handleInput()"
        @change="datePicking = false; handleChange()"
      />
    </v-menu>

    <v-checkbox
      v-else-if="field.type === 'checkbox'"
      v-model="value"
      :label="getLabel(field)"
      :required="field.required"
      :readonly="field.readonly"
      :disabled="field.disabled"
      :hint="field.description"
      persistent-hint
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
      :hint="field.description"
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
      :hint="field.description"
      @input="handleInput()"
      @change="handleChange()"
    />
  </div>
</template>

<script>
import { idKey } from '@/helpers/firebase';
import ImageUploader from '@/components/admin/utility/ImageUploader.vue';

export default {
  name: 'dynamic-field',
  props: {
    field: Object,
    data: Object,
  },
  data() {
    return {
      idKey,

      datePicking: false,
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
  components: {
    ImageUploader,
  },
};
</script>

<style lang="scss">
.dynamic-field {

}
</style>
