<template>
  <div class="mi-md-spinner" :style="{ width: `${diameter}px` }">
    <svg viewBox="25 25 50 50">
      <circle cx="50" cy="50" r="20" fill="none" stroke="#000" :stroke-width="width" stroke-miterlimit="10"/>
    </svg>
  </div>
</template>

<script>
export default {
  name: 'mi-md-spinner',
  props: {
    diameter: {
      type: Number,
      default: 64,
    },
    width: {
      type: Number,
      default: 4,
    },
  },
};
</script>

<style lang="scss">
@keyframes rotate {
  100% {
    transform: rotate(360deg);
  }
}
@keyframes dash {
  0% {
    stroke-dasharray: 1, 200;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 89, 200;
    stroke-dashoffset: -35px;
  }
  100% {
    stroke-dasharray: 89, 200;
    stroke-dashoffset: -124px;
  }
}
.mi-md-spinner {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  position: relative;
  margin: auto;

  &::before {
    content: '';
    display: block;
    padding-top: 100%;
  }

  svg {
    position: absolute;
    height: 100%;
    width: 100%;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    margin: auto;
    transform-origin: center center;
    animation: rotate 2s linear infinite;

    circle {
      stroke: var(--md-theme-default-primary);
      stroke-dasharray: 1, 200;
      stroke-dashoffset: 0;
      animation: dash 1.5s ease-in-out infinite;
      // stroke-linecap: round;
    }
  }
}
</style>
