<template>
  <form @submit.prevent="handleSubmit" class="new-dynamic-field layout align-center">
    <dynamic-field :field="field" :data="data" class="flex" />
    <v-btn type="submit" icon color="primary" :disabled="!isValid">
      <v-icon>add</v-icon>
    </v-btn>
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
  .v-messages {
    display: none;
  }
}
</style>
