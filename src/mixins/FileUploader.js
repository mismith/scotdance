import { uploadBytesResumable, getDownloadURL } from 'firebase/storage';

import { buckets, getStorageRef } from '@/helpers/firebase';

export default {
  props: {
    value: String,
    storagePath: String,
    maxSize: {
      type: Number,
      default: 244 * 1024,
    },
    accept: {
      type: String,
      default: 'image/*',
    },
  },
  data() {
    return {
      progress: undefined,
      error: undefined,
      isImage: null,

      rules: [
        (file) => {
          if (file.size > this.maxSize) {
            const kb = (size) => `${Math.round(size / 1024)}KB`;
            return `File size is too large (${kb(file.size)}). It must be under ${kb(this.maxSize)}.`;
          }
          return false;
        },
        (file) => {
          const types = this.accept.split(',').map((t) => t.trim());
          if (!types.some((t) => new RegExp(t.replace('*', '.*')).test(file.type))) {
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
        // @TODO: work for storagePath stuff too
        if (this.value.includes('firebasestorage.googleapis.com')) {
          return decodeURIComponent(this.value).replace(/\?.*$/, '').replace(/^.*\//, '');
        }
        if (this.value.includes('base64')) {
          return '<file>';
        }
        return this.value;
      }
      return '';
    },
  },
  watch: {
    value: {
      handler(value) {
        this.error = null;
        this.progress = null;
        this.isImage = null;
        const img = document.createElement('img');
        img.onload = () => {
          this.isImage = true;
        };
        img.onerror = () => {
          this.isImage = false;
        };
        img.src = value;
      },
      immediate: true,
    },
    error(error) {
      if (error) {
        this.progress = null;
      }
    },
  },
  methods: {
    async handleUpload({ target: { files: [file] } }) {
      if (!file) return;

      this.error = this.rules.map((r) => r(file)).find(Boolean) || '';
      if (this.error) return;

      // start loading
      this.progress = 1;

      if (this.storagePath) {
        // upload to firebase storage
        try {
          const task = uploadBytesResumable(getStorageRef(buckets, `${this.storagePath}/${file.name}`), file);
          task.on('state_changed', ({ bytesTransferred, totalBytes }) => {
            this.progress = (bytesTransferred / totalBytes) * 100 || 1;
          });
          const snap = await task;
          const url = await getDownloadURL(snap.ref);

          this.handleChange(url);
        } catch (err) {
          this.error = err && err.message;
        }
      } else {
        // load in-browser and store base64
        const reader = new FileReader();
        reader.onload = (event) => {
          this.handleChange(event.target.result);
        };
        reader.onerror = (err) => {
          this.error = err && err.message;
        };
        reader.readAsDataURL(file);
      }
    },

    handleChange(value = null) {
      this.value = value;
      this.$emit('update:value', value);
      this.$emit('input', value);
      this.$emit('change', value);
    },
  },
};
