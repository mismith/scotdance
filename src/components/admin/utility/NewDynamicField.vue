<template>
  <form @submit.prevent="handleSubmit" class="new-dynamic-field md-list-item-content">
    <dynamic-field
      :field="field"
      :data="data"
      class="md-list-item-text"
    />
    <md-button
      type="submit"
      class="md-icon-button md-raised md-primary md-list-action"
      :disabled="!isValid"
    >
      <md-icon>add</md-icon>
    </md-button>
  </form>
</template>

<script>
import DynamicField from '@/components/admin/utility/DynamicField.vue';

export default {
  name: 'new-dymnamic-field',
  props: {
    field: {
      type: Object,
      default: () => ({ title: 'Name', data: 'name' }),
    },
  },
  data() {
    return {
      data: {
        [this.field.data]: undefined,
      },
    };
  },
  computed: {
    isValid() {
      return !!(this.data[this.field.data] || '').trim();
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('change', {
        ...this.data,
      });

      this.data[this.field.data] = '';
    },
  },
  components: {
    DynamicField,
  },
};
</script>

<style lang="scss">
.new-dynamic-field {
  padding-top: 8px;
  padding-bottom: 16px;

  .md-list-action:last-of-type {
    margin-right: -8px;
  }
}
</style>
