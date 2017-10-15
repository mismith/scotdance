<template>
  <div class="competition md-scroll-frame">

    <div class="md-scroll">
      <router-view />
    </div>

    <md-bottom-bar>
      <md-bottom-bar-item
        md-iconset="icon-info"
        @click="$router.push({ name: 'competition' })"
        :md-active="$router.currentRoute.name === 'competition'"
      >
        Info
      </md-bottom-bar-item>
      <md-bottom-bar-item
        md-iconset="icon-people"
        @click="$router.push({ name: 'competition.dancers' })"
        :md-active="$router.currentRoute.name === 'competition.dancers'"
      >
        Dancers
      </md-bottom-bar-item>
      <md-bottom-bar-item
        md-iconset="icon-clock"
        @click="$router.push({ name: 'competition.schedule' })" 
        :md-active="$router.currentRoute.name === 'competition.schedule'"
      >
        Schedule
      </md-bottom-bar-item>
      <md-bottom-bar-item
        md-iconset="icon-trophy"
        @click="$router.push({ name: 'competition.results' })"
        :md-active="$router.currentRoute.name === 'competition.results'"
      >
        Results
      </md-bottom-bar-item>
    </md-bottom-bar>
  </div>
</template>

<script>
export default {
  name: 'competition',
};
</script>

<style lang="scss">
.competition {

}
</style>
