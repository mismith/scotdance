<template>
  <div class="ImageUploader">
    <v-card hover max-width="300" class="flex-column align-center my-2">
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
import { buckets } from '@/helpers/firebase';

export default {
  name: 'ImageUploader',
  props: {
    storagePath: String,
    value: String,
    label: String,
    hint: String,
    required: Boolean,
    disabled: Boolean,
    maxSize: {
      type: Number,
      default: 244 * 1024,
    },
    accept: {
      type: String,
      default: 'image/svg+xml, image/png, image/jpeg',
    },
  },
  data() {
    return {
      progress: undefined,
      preview: undefined,
      error: undefined,

      rules: [
        (file) => {
          if (file.size > this.maxSize) {
            const kb = size => `${Math.round(size / 1024)}KB`;
            return `File size is too large (${kb(file.size)}). It must be under ${kb(this.maxSize)}.`;
          }
          return false;
        },
        (file) => {
          if (!this.accept.split(',').map(t => t.trim()).includes(file.type)) {
            return `Invalid file format (${file.type}). It must be of type(s): ${this.accept}.`;
          }
          return false;
        },
      ],
    };
  },
  computed: {
    filename() {
      if (this.value) {
        return decodeURIComponent(this.value).replace(/\?.*$/, '').replace(/^.*\//, '');
      }
      return '';
    },
  },
  methods: {
    async handleUpload({ target: { files: [file] } }) {
      if (!file) return;

      this.error = this.rules.map(r => r(file)).find(v => v) || '';
      if (this.error) return;

      // start loading
      this.progress = 1;

      // show preview locally while uploading
      const reader = new FileReader();
      reader.onload = (event) => {
        this.preview = event.target.result;

        if (!this.storagePath) {
          this.handleChange(this.preview);
        }
      };
      reader.onerror = (err) => {
        this.error = err && err.message;
      };
      reader.readAsDataURL(file);

      // upload to firebase storage
      if (this.storagePath) {
        try {
          const task = buckets.child(`${this.storagePath}/${file.name}`).put(file);
          task.on('state_changed', ({ bytesTransferred, totalBytes }) => {
            this.progress = (bytesTransferred / totalBytes) * 100 || 1;
          });
          const snap = await task;
          const url = await snap.ref.getDownloadURL();

          this.handleChange(url);
        } catch (err) {
          this.error = err && err.message;
        }
      }
    },

    handleChange(value = null) {
      this.error = null;
      this.progress = null;
      this.preview = value;
      this.value = value;
      this.$emit('update:value', value);
      this.$emit('input', value);
      this.$emit('change', value);
    },
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
    min-height: 100px;
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
