<template>
  <v-sheet light class="FileUploaderCellRenderer d-flex align-center">
    <div v-if="value" class="d-flex flex align-center">
      <div :style="{ backgroundImage: `url('${value}')` }" class="flex px-1 text-truncate">
        {{ isImage === false ? filename : '' }}
      </div>
      <v-btn icon x-small :href="value" target="_blank" @mousedown.stop>
        &nearr;
      </v-btn>
      <v-btn icon x-small @mousedown.stop @click="handleChange()">
        <v-icon small>{{ mdiClose }}</v-icon>
      </v-btn>
    </div>
    <v-btn v-else icon x-small class="ml-auto" @mousedown.stop @click="$refs.file.click()">
      <v-icon small>{{ mdiPaperclip }}</v-icon>
    </v-btn>
    <input ref="file" type="file" :accept="accept" @change="handleUpload" aria-label="Upload file" />

    <v-progress-linear v-show="progress" v-model="progress" absolute bottom />
  </v-sheet>
</template>

<script>
import { mdiClose, mdiPaperclip } from '@mdi/js';
import FileUploaderMixin from '@/mixins/FileUploader';

export default {
  name: 'FileUploaderCellRenderer',
  mixins: [
    FileUploaderMixin,
  ],
  props: {
    hotInstance: Object,
    TD: Object,
    row: Number,
    col: Number,
    prop: String,
    cellProperties: Object,
  },
  data() {
    return {
      mdiClose,
      mdiPaperclip,
    };
  },
  watch: {
    error(error) {
      if (error) {
        // eslint-disable-next-line no-alert
        window.alert(error); // @HACK: use native alert since cell is too small to display error
      }
    },
  },
  methods: {
    handleChange(value = null) {
      this.value = value;
      this.hotInstance.setDataAtCell(this.row, this.col, this.value);
    },
  },
};
</script>

<style lang="scss">
.FileUploaderCellRenderer {
  position: relative;
  height: 22px; // @HACK: avoid autoRowSize height issues
  background-color: transparent !important; // to let htInvalid coloring show through
  margin: 0px -4px;

  .v-progress-linear {
    pointer-events: none;
  }
  > div {
    height: 100%;

    > div {
      height: 100%;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: left center;
      font-size: x-small;
    }
  }
  input[type="file"] {
    display: none;
  }
}
</style>
