<template>
  <md-list-item
    class="admin-list-item"
    :md-expand="mdExpand"
    :md-expanded="mdExpanded"
    @update:mdExpanded="$emit('update:mdExpanded', $event)"
    @click.stop="$emit('click', $event)"
  >
    <div class="md-list-item-text" v-html="itemNameFn(item)" />

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

    <md-icon v-if="!mdExpand">chevron_right</md-icon>
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
    itemNameFn: {
      type: Function,
      default: item => item.$name || item.name,
    },
    mdExpand: Boolean,
    mdExpanded: Boolean,
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
