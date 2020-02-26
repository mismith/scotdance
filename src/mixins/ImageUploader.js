import { buckets } from '@/helpers/firebase';

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
      default: 'image/svg+xml, image/png, image/jpeg',
    },
  },
  data() {
    return {
      progress: undefined,
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

      if (this.storagePath) {
        // upload to firebase storage
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

    setValue(value = null) {
      this.error = null;
      this.progress = null;
      this.value = value;
    },
    handleChange(value = null) {
      this.setValue(value);
      this.$emit('update:value', value);
      this.$emit('input', value);
      this.$emit('change', value);
    },
  },
};
