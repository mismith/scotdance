<template>
  <div class="DynamicField" :class="{ required: field.required }">
    <v-select
      v-if="field.type === 'select'"
      v-model="value"
      :name="field.data"
      :label="field.title"
      :items="field.presets"
      :item-text="field.itemText"
      :item-value="field.itemValue"
      :required="field.required"
      :readonly="field.readonly"
      :disabled="field.disabled"
      :hint="field.description"
      :rules="rules"
      @input="handleInput()"
      @change="handleChange()"
    />

    <ImageUploader
      v-else-if="field.type === 'image'"
      v-model="value"
      :name="field.data"
      :storage-path="field.storagePath"
      :label="field.title"
      :required="field.required"
      :disabled="field.disabled"
      :hint="field.description"
      :rules="rules"
      @input="handleInput()"
      @change="handleChange()"
    />

    <v-menu
      v-else-if="field.type === 'date'"
      v-model="datePicking"
      :close-on-content-click="false"
      offset-y
      max-width="290"
    >
      <!-- @TODO: https://github.com/vuetifyjs/vuetify/issues/9129 -->
      <template #activator="{ on }">
        <v-text-field
          v-on="on"
          v-model="value"
          :name="field.data"
          :label="field.title"
          :required="field.required"
          :disabled="field.disabled"
          :hint="field.description"
          :readonly="field.readonly"
          :rules="rules"
          append-icon="mdi-calendar"
          :autocomplete="field.autocomplete || 'none'"
          @focus="datePicking = true"
          @input="handleInput()"
          @change="handleChange()"
        />
      </template>
      <v-date-picker
        v-model="value"
        @input="datePicking = false; handleInput()"
        @change="datePicking = false; handleChange()"
      />
    </v-menu>

    <v-checkbox
      v-else-if="field.type === 'checkbox'"
      v-model="value"
      :name="field.data"
      :label="field.title"
      :required="field.required"
      :readonly="field.readonly"
      :disabled="field.disabled"
      :hint="field.description"
      persistent-hint
      :rules="rules"
      style="flex-direction: column;"
      @input="handleInput()"
      @change="handleChange()"
    >
      <template #prepend>
        <div v-html="field.prepend" class="mb-4" />
      </template>
    </v-checkbox>

    <v-textarea
      v-else-if="field.type === 'textarea'"
      v-model="value"
      :name="field.data"
      :label="field.title"
      :required="field.required"
      :readonly="field.readonly"
      :disabled="field.disabled"
      :hint="field.description"
      :rules="rules"
      rows="1"
      auto-grow
      @input="handleInput()"
      @change="handleChange()"
    />

    <v-text-field
      v-else
      v-model="value"
      :name="field.data"
      :label="field.title"
      :type="field.type || 'text'"
      :required="field.required"
      :readonly="field.readonly"
      :disabled="field.disabled"
      :hint="field.description"
      :rules="rules"
      @input="handleInput()"
      @change="handleChange()"
    />
  </div>
</template>

<script>
import { idKey } from '@/helpers/firebase';
import ImageUploader from '@/components/admin/ImageUploader.vue';

export default {
  name: 'DynamicField',
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

    rules() {
      return [
        this.field.required ? (v => !!`${v || ''}`.trim() || 'Required.') : true,
        this.field.type === 'date'
          ? (v => /^\d\d\d\d-\d\d-\d\d$/.test(`${v || ''}`.trim()) || 'Expected format: YYYY-MM-DD')
          : true,
        ...(this.field.rules || []),
      ];
    },
  },
  methods: {
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
.DynamicField {
  &.required {
    label {
      &::after {
        content: '*';
        margin-left: 0.25em;
      }
    }
  }
}
</style>
