<template>
  <span class="CountdownTicker">
    <template v-if="timeLeft !== undefined">
      {{ formattedTimeLeft }}
    </template>
    <Spinner color="amber" size="16" width="1" v-else />
</span>
</template>

<script>
import { format, formatDistanceStrict } from 'date-fns';
import Spinner from '@/components/Spinner.vue';

export default {
  name: 'CountdownTicker',
  props: {
    endTimestamp: {
      type: Number,
      default: 0,
    },
    format: {
      type: String,
      default: 'mm:ss',
    },
  },
  data() {
    return {
      timeLeft: undefined,
    };
  },
  computed: {
    formattedTimeLeft() {
      if (this.timeLeft === undefined) {
        return null;
      }
      if (this.format === 'distance') {
        return formatDistanceStrict(0, this.timeLeft);
      }
      return format(new Date(this.timeLeft), this.format);
    },
  },
  watch: {
    endTimestamp() {
      this.handleTick();
    },
  },
  methods: {
    handleTick() {
      if (this.endTimestamp) {
        const timeLeft = this.endTimestamp - Date.now();
        this.timeLeft = Math.max(0, timeLeft);
      } else if (this.timeLeft) {
        this.timeLeft = 0;
        this.stopTicker();
      }
    },
    startTicker() {
      this.handleTick();
      window.setInterval(this.handleTick, 1000);
    },
    stopTicker() {
      window.clearInterval(this.handleTick);
    },
  },
  created() {
    this.startTicker();
  },
  beforeDestroy() {
    this.stopTicker();
  },
  components: {
    Spinner,
  },
};
</script>
