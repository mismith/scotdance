<template>
  <v-sheet light class="ImageUploaderCellRenderer d-flex align-center">
    <v-progress-linear v-show="progress" v-model="progress" absolute top />

    <div v-if="value" class="d-flex flex align-center">
      <div :style="{ backgroundImage: `url('${value}')` }" class="flex"></div>
      <v-btn icon x-small :href="value" target="_blank" @mousedown.stop>
        <v-icon small>mdi-link</v-icon>
      </v-btn>
      <v-btn icon x-small @mousedown.stop @click="handleChange()">
        <v-icon small>mdi-close-circle</v-icon>
      </v-btn>
    </div>
    <v-btn v-else icon x-small class="ml-auto" @mousedown.stop @click="$refs.file.click()">
      <v-icon small>mdi-cloud-upload</v-icon>
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

    > div {
      height: 100%;
      background-size: contain;
      background-repeat: no-repeat;
    }
  }
  input[type="file"] {
    display: none;
  }
}
</style>
