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
      :color="warning ? 'warning' : undefined"
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
      :color="warning ? 'warning' : undefined"
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
          :color="warning ? 'warning' : undefined"
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
      :color="warning ? 'warning' : undefined"
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
      :color="warning ? 'warning' : undefined"
      rows="1"
      auto-grow
      @input="handleInput()"
      @change="handleChange()"
    />

    <v-combobox
      v-else-if="field.type === 'place'"
      :value="value"
      :name="field.data"
      :label="field.title"
      :required="field.required"
      :readonly="field.readonly"
      :disabled="field.disabled"
      :hint="field.description"
      :persistent-hint="field.isDescriptionPersistent"
      :rules="rules"
      :color="warning ? 'warning' : undefined"
      :loading="placesLoading"
      :items="placeSuggestions"
      no-filter
      item-text="displayName"
      @update:search-input="handlePlaceSearchInput"
      @change="handlePlaceChange"
    >
      <template #item="{ item, on, attrs }">
        <v-list-item v-on="on" v-bind="attrs">
          <v-list-item-content>
            <v-list-item-title>{{ item.displayName }}</v-list-item-title>
            <v-list-item-subtitle>{{ item.formattedAddress }}</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
      </template>
    </v-combobox>

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
      :color="warning ? 'warning' : undefined"
      @input="handleInput()"
      @change="handleChange()"
    />

    <aside v-if="warning" class="warning--text d-flex align-center caption">
      <v-icon size="12" class="mr-1" style="color: inherit">{{ mdiAlert }}</v-icon>
      {{ warning }}
    </aside>
  </div>
</template>

<script>
import { mdiAlert, mdiCalendar } from '@mdi/js';
import debounce from 'lodash.debounce';
import { idKey } from '@/helpers/firebase';
import FileUploader from '@/components/admin/FileUploader.vue';
import { searchForPlaces } from '@/helpers/maps';

export default {
  name: 'DynamicField',
  props: {
    field: Object,
    data: Object,
  },
  data() {
    return {
      idKey,
      mdiAlert,
      mdiCalendar,

      datePicking: false,

      placesLoading: false,
      placeSuggestions: [],
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
    warning() {
      return this.value && this.field.warningRules?.map((rule) => rule(this.value)).find((v) => typeof v === 'string');
    },
  },
  methods: {
    handleInput(value = undefined) {
      this.$emit('input', {
        [this.field.data]: value !== undefined ? value : this.data[this.field.data],
      });
    },
    handleChange(value = undefined) {
      this.$emit('change', {
        [this.field.data]: value !== undefined ? value : this.data[this.field.data],
      });
    },

    searchForPlaces: debounce(async function placeSearch(place) {
      this.placesLoading = true;
      const placeSuggestions = await searchForPlaces(place);
      this.placeSuggestions = placeSuggestions;
      this.placesLoading = false;
    }, 300),
    handlePlaceSearchInput(placeString) {
      if (placeString && placeString !== this.value) {
        this.searchForPlaces(placeString);
      }
      this.handleInput(placeString);
    },
    async handlePlaceChange(placeObject) {
      this.searchForPlaces.cancel?.(); // TODO: does this ever work?
      this.placesLoading = false;

      if (typeof placeObject === 'object' && placeObject.displayName) {
        this.value = placeObject.displayName;
        this.handleChange(placeObject.displayName);
        this.$emit('place-pick', placeObject);
      } else {
        this.handleChange();
      }
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
