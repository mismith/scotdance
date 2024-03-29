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
      :clearable="field.clearable"
      :hint="field.description"
      :persistent-hint="field.isDescriptionPersistent"
      :rules="rules"
      @input="handleInput()"
      @change="handleChange()"
    />

    <FileUploader
      v-else-if="field.type === 'file'"
      v-model="value"
      :name="field.data"
      :storage-path="field.storagePath"
      :max-size="field.maxSize"
      :accept="field.accept"
      :label="field.title"
      :required="field.required"
      :disabled="field.disabled"
      :hint="field.description"
      :persistent-hint="field.isDescriptionPersistent"
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
          :persistent-hint="field.isDescriptionPersistent"
          :readonly="field.readonly"
          :rules="rules"
          :append-icon="mdiCalendar"
          :autocomplete="field.autocomplete || 'off'"
          @input="handleInput()"
          @change="handleChange()"
          @click:append="datePicking = true"
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
        <div v-html="$sanitize(field.prepend)" class="mb-4" />
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
      :persistent-hint="field.isDescriptionPersistent"
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
      :persistent-hint="field.isDescriptionPersistent"
      :rules="rules"
      @input="handleInput()"
      @change="handleChange()"
    />
  </div>
</template>

<script>
import { mdiCalendar } from '@mdi/js';
import { idKey } from '@/helpers/firebase';
import FileUploader from '@/components/admin/FileUploader.vue';

export default {
  name: 'DynamicField',
  props: {
    field: Object,
    data: Object,
  },
  data() {
    return {
      idKey,
      mdiCalendar,

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
        this.field.required ? ((v) => !!`${v || ''}`.trim() || 'Required.') : true,
        this.field.type === 'date'
          ? ((v) => /^\d\d\d\d-\d\d-\d\d$/.test(`${v || ''}`.trim()) || 'Expected format: YYYY-MM-DD')
          : true,
        this.field.type === 'email'
          ? ((v) => /^[^\s@,]+@[^\s@,]+$/.test(`${v || ''}`.trim()) || 'Invalid email address')
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
    FileUploader,
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
