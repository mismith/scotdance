<template>
  <div class="ImageUploader">
    <v-card hover max-width="300" class="flex-column justify-center align-center my-2">
      <v-progress-linear v-show="progress" v-model="progress" absolute />
      <img v-if="preview || value" :src="preview || value" :style="{ opacity: progress ? 0.25 : 1 }" />
      <div v-else class="d-flex flex-column align-center pa-4">
        <v-icon size="100">mdi-cloud-upload</v-icon>
        <div>Drag or Browse</div>
      </div>
      <input type="file" :accept="accept" @change="handleUpload" />
    </v-card>
    <v-text-field
      :value="filename"
      :label="label"
      :hint="hint"
      :required="required"
      :disabled="disabled"
      readonly
      clearable
      :error="!!error"
      :messages="error ? error : undefined"
      @change="handleChange"
      @click:clear="handleChange()"
    />
  </div>
</template>

<script>
import ImageUploaderMixin from '@/mixins/ImageUploader';

export default {
  name: 'ImageUploader',
  mixins: [
    ImageUploaderMixin,
  ],
  props: {
    label: String,
    hint: String,
    required: Boolean,
    disabled: Boolean,
  },
};
</script>

<style lang="scss">
.ImageUploader {
  .v-progress-linear {
    position: absolute;
    bottom: 0;
    margin: 0;
  }
  .v-card {
    position: relative;
    min-height: 48px;
    overflow: hidden;

    img {
      max-width: 100%;
      vertical-align: middle;
    }
    input[type="file"] {
      position: absolute;
      top: 0;
      left: 0;
      opacity: 0;
      font-size: 999px;
    }
  }
}
</style>
