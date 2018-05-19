<template>
  <div class="home">
    <div class="hero">
      <div>
        <img src="static/img/touchicon.png" role="presentation" width="128" height="128" />
        <h1 class="md-display-3">ScotDance</h1>
        <p class="md-headline">Highland dancing event tracker</p>
        <p>Skip the pen and paper—attend highland dance competitions in style with this app for your mobile device.</p>
        <p v-if="!isApp" class="store-badges">
          <a @click.prevent="TODO()" href="#" target="_blank">
            <img src="static/img/app-store.svg" alt="Download on the App Store" />
          </a>
          <a @click.prevent="TODO()" href="#" target="_blank">
            <img src="static/img/play-store.svg" alt="Get it on Google Play" />
          </a>
        </p>
        <p>
          <md-button @click.prevent="$router.push(`/competitions`)" class="md-primary md-raised">Browse Competitions</md-button>
        </p>
      </div>
    </div>
    <div class="md-layout">
      <div class="md-layout-item md-small-size-100">
        <md-icon class="md-size-4x icon-people" />
        <h2 class="md-title">Dancers</h2>
        <p>Search through dancers by their competition number, name, age group, etc. Then mark your favourites for easy tracking.</p>
      </div>
      <div class="md-layout-item md-small-size-100">
        <md-icon class="md-size-4x icon-clock" />
        <h2 class="md-title">Schedule</h2>
        <p>Use the at-a-glance schedule to check event start times, which platforms to dance at, order of dances, and more.</p>
      </div>
      <div class="md-layout-item md-small-size-100">
        <md-icon class="md-size-4x icon-trophy" />
        <h2 class="md-title">Results</h2>
        <p>Get real-time results updates—from callbacks through to placings—and review them anytime after a competition, too.</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'home',
  methods: {
    TODO() {
      window.alert('Coming Soon'); // eslint-disable-line no-alert
    },
  },
};
</script>

<style lang="scss">
.home {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  text-align: center;

  > * {
    flex-shrink: 0;
  }
  .hero {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;

    .store-badges {
      a {
        display: inline-block;
        margin: 8px;
      }
      img {
        height: 48px;
      }
    }
  }
  .md-layout {
    margin: 20px 0;

    .md-layout-item {
      padding: 20px;
    }
  }
}
</style>
