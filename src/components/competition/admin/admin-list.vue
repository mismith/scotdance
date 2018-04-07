<template>
  <md-list class="admin-list">
    <slot
      v-for="item in items"
      v-bind="item"
    />

    <form @submit.prevent="handleAddNew" class="footer">
      <md-list-item>
        <md-field v-if="presets && presetsType === 'select'">
          <label>Add New {{ itemsType }}</label>
          <md-select v-model="newItem" multiple>
            <md-option
              v-for="preset in presets"
              :key="preset[idKey]"
              :value="preset[idKey]"
            >{{ preset.$name || preset.name }}</md-option>
          </md-select>
        </md-field>

        <md-datepicker
          v-else-if="presets && presetsType === 'datepicker'"
          v-model="newItem"
          @md-selected="handleAddNew"
        >
          <label>Add New {{ itemsType }}</label>
        </md-datepicker>

        <md-autocomplete
          v-else-if="presets"
          v-model="newItem"
          :md-options="presets"
          @md-selected="handleAddNew"
        >
          <label>Add New {{ itemsType }}</label>
        </md-autocomplete>

        <md-field v-else>
          <label>Add New {{ itemsType }}</label>
          <md-input v-model="newItem" />
        </md-field>

        <md-button type="submit" :disabled="!isAddNewValid(newItem)" class="md-icon-button md-raised md-primary">
          <md-icon>add</md-icon>
        </md-button>
      </md-list-item>
    </form>
  </md-list>
</template>

<script>
import AdminListItem from '@/components/competition/admin/admin-list-item';
import {
  idKey,
} from '@/helpers/firebase';

export default {
  name: 'admin-list',
  props: {
    itemsRef: {
      type: Object,
      required: true,
    },
    itemsType: String,
    presets: Array,
    presetsType: String,
  },
  data() {
    return {
      idKey,

      newItem: undefined,
    };
  },
  firebase() {
    return {
      items: this.itemsRef,
    };
  },
  methods: {
    isAddNewValid() {
      return !!(this.newItem || '').trim();
    },
    handleAddNew() {
      this.$emit('create', {
        name: this.newItem,
      });

      this.newItem = null;
    },
  },
  components: {
    AdminListItem,
  },
};
</script>

<style lang="scss">
.admin-list {

}
</style>
