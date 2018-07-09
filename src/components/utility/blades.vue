<template>
  <div class="blades md-layout md-scroll-frame">
    <slot />
  </div>
</template>

<script>
export default {
  name: 'blades',
};
</script>

<style lang="scss">
.blades {
  // extends: md-layout, md-scroll-frame
  flex-direction: row;
  flex-wrap: nowrap;
  position: relative;
  overflow-x: auto;
}
</style>
