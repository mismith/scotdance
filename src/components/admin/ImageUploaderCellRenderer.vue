<template>
  <v-sheet light class="ImageUploaderCellRenderer d-flex align-center">
    <v-progress-linear v-show="progress" v-model="progress" absolute top />

    <div v-if="preview || value" class="d-flex align-center justify-space-between">
      <a :href="value" target="_blank" @mousedown.stop>
        <img :src="preview || value" />
      </a>
      <v-btn icon x-small class="ml-auto" @mousedown.stop @click="handleChange()">
        <v-icon x-small>mdi-close</v-icon>
      </v-btn>
    </div>
    <v-btn v-else x-small @mousedown.stop @click="$refs.file.click()">
      <v-icon small class="mr-2">mdi-upload</v-icon>
      Upload
    </v-btn>
    <input ref="file" type="file" :accept="accept" @change="handleUpload" />
  </v-sheet>
</template>

<script>
import ImageUploaderMixin from '@/mixins/ImageUploader';

export default {
  name: 'ImageUploaderCellRenderer',
  mixins: [
    ImageUploaderMixin,
  ],
  props: {
    hotInstance: Object,
    TD: Object,
    row: Number,
    col: Number,
    prop: String,
    cellProperties: Object,

    storagePath: {
      type: String,
      default: 'competitions/images',
    },
  },
  watch: {
    error(error) {
      if (error) {
        // eslint-disable-next-line no-alert
        window.alert(error);
      }
    },
  },
  methods: {
    handleChange(value = null) {
      this.setValue(value);
      this.hotInstance.setDataAtCell(this.row, this.col, this.value);
    },
  },
};
</script>

<style lang="scss">
.ImageUploaderCellRenderer {
  position: relative;
  height: 22px; // @HACK: avoid autoRowSize height issues
  margin: 0px -4px;

  .v-progress-linear {
    pointer-events: none;
  }
  > div {
    height: 100%;
  }
  a {
    display: inline-flex;
    height: 100%;

    img {
      height: 100%;
      max-width: 100%;
      vertical-align: middle;
    }
  }
  input[type="file"] {
    display: none;
  }
}
</style>
