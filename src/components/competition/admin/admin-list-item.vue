<template>
  <md-list-item
    class="admin-list-item"
    :md-expand="expandable"
    @update:mdExpanded="$event && $emit('md-expanded', $event)"
    @click="$emit('click', $event)"
  >
    <span class="md-list-item-text">{{ item.name }}</span>

    <md-list slot="md-expand">
      <slot />
    </md-list>

    <md-button @click.stop="confirmRemove = true" class="md-icon-button">
      <md-icon>delete</md-icon>
    </md-button>
    <md-dialog-confirm
      :md-active.sync="confirmRemove"
      md-title="Delete entry"
      md-content="Are you sure you want to permanently delete this entry?"
      md-confirm-text="Yes"
      md-cancel-text="No"
      @md-confirm="$emit('remove', item)"
    />

    <md-icon v-if="!expandable">chevron_right</md-icon>
  </md-list-item>
</template>

<script>
import {
  idKey,
} from '@/helpers/firebase';

export default {
  name: 'admin-list-item',
  props: {
    item: Object,
    expandable: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      idKey,

      confirmRemove: false,
    };
  },
};
</script>

<style lang="scss">
.admin-list-item {

}
</style>
