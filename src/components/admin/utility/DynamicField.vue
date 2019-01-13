<template>
  <div class="dynamic-field" :class="{ required: field.required }">
    <v-select
      v-if="field.type === 'select'"
      v-model="value"
      :name="field.data"
      :label="field.title"
      :items="field.presets"
      item-text="name"
      :item-value="idKey"
      :required="field.required"
      :readonly="field.readonly"
      :disabled="field.disabled"
      :hint="field.description"
      :rules="rules"
      @input="handleInput()"
      @change="handleChange()"
    />

    <image-uploader
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
      full-width
      max-width="290"
    >
      <v-text-field
        slot="activator"
        :value="value"
        :name="field.data"
        :label="field.title"
        :required="field.required"
        :disabled="field.disabled"
        :hint="field.description"
        readonly
        :rules="rules"
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
      <div slot="prepend" v-html="field.prepend" class="mb-3" />
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

    rules() {
      return [
        this.field.required ? (v => !!`${v || ''}`.trim() || 'Required.') : true,
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
.dynamic-field {
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
