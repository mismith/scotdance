<template>
  <div class="FileUploader">
    <v-card
      hover
      max-width="300"
      class="d-inline-flex flex-column justify-center align-center my-2"
    >
      <v-progress-linear v-show="progress" v-model="progress" absolute />
      <template v-if="value">
        <img v-if="isImage" :src="value" alt="Uploaded image" />
        <div v-else class="text-truncate pa-3">{{ filename }}</div>
      </template>
      <div v-else class="d-flex flex-column align-center py-4 px-8">
        <v-icon size="100">{{ mdiCloudUpload }}</v-icon>
        <div>Drag or Browse</div>
      </div>
      <input type="file" :accept="accept" @change="handleUpload" aria-label="Upload file" />
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
import { mdiCloudUpload } from '@mdi/js';
import FileUploaderMixin from '@/mixins/FileUploader';

export default {
  name: 'FileUploader',
  mixins: [
    FileUploaderMixin,
  ],
  props: {
    label: String,
    hint: String,
    required: Boolean,
    disabled: Boolean,
  },
  data() {
    return {
      mdiCloudUpload,
    };
  },
};
</script>

<style lang="scss">
.FileUploader {
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

      &,
      &::-webkit-file-upload-button {
        cursor:pointer;
      }
    }
  }
}
</style>
