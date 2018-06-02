<template>
  <div class="home">
    <section class="hero">
      <div>
        <img src="static/img/touchicon.png" role="presentation" width="88" height="88" />
        <h1 class="md-display-2">ScotDance</h1>
        <p class="md-headline">Highland dancing event tracker</p>
        <p class="md-subheading">Skip the pen and paper—attend highland dance competitions in style with this app for your mobile device.</p>
        <p v-if="!isApp" class="store-badges">
          <a href="https://itunes.apple.com/us/app/scotdance/id1386475626?mt=8" target="_blank">
            <img src="static/img/app-store.svg" alt="Download on the App Store" />
          </a>
          <a href="https://play.google.com/store/apps/details?id=info.mismith.scotdance" target="_blank">
            <img src="static/img/play-store.svg" alt="Get it on Google Play" />
          </a>
        </p>
        <p>
          <md-button @click.prevent="$router.push({ name: 'competitions' })" class="md-primary md-raised md-large">Browse Competitions</md-button>
        </p>
      </div>
    </section>

    <section id="features" class="alt">
      <header>
        <h2 class="md-display-1">A virtual program of events</h2>
        <p class="md-subheading">Modernize your highland dancing experience by interacting with competition information digitally.</p>
      </header>
      <div class="md-layout">
        <div class="md-layout-item md-small-size-100">
          <md-icon class="md-size-4x icon-people md-primary" />
          <h2 class="md-title">Dancers</h2>
          <p>Search through dancers by their competition number, name, age group, etc. Then mark your favourites for easy tracking.</p>
        </div>
        <div class="md-layout-item md-small-size-100">
          <md-icon class="md-size-4x icon-clock md-primary" />
          <h2 class="md-title">Schedule</h2>
          <p>Use the at-a-glance schedule to check event start times, which platforms to dance at, order of dances, and more.</p>
        </div>
        <div class="md-layout-item md-small-size-100">
          <md-icon class="md-size-4x icon-trophy md-primary" />
          <h2 class="md-title">Results</h2>
          <p>Get real-time results updates—from callbacks through to placings—and review them anytime after a competition, too.</p>
        </div>
      </div>
      <footer>
          <md-button @click.prevent="$router.push({ name: 'competitions' })" class="md-primary md-raised">Browse Competitions</md-button>
      </footer>
    </section>

    <section id="about">
      <header>
        <h2 class="md-display-1">About</h2>
        <p>ScotDance was started in 2017 by <a href="https://mismith.io" target="_blank" class="ext">Murray Smith</a></p>
        <p>View the source code on <a href="https://github.com/mismith/scotdance" target="_blank" class="ext">GitHub</a></p>
        <p>Track development via <a href="https://trello.com/b/ZCZ8t1fH" target="_blank" class="ext">Trello</a></p>
        <p>Get support via <a @click.prevent="help(true)">Live Chat</a></p>
        <p><small>{{ $device.platform || '' }} App v{{ $package.version || '?' }}</small></p>
      </header>
    </section>
  </div>
</template>

<script>
import {
  mapState,
  mapActions,
} from 'vuex';

export default {
  name: 'home',
  computed: {
    ...mapState([
      '$package',
      '$device',
    ]),
  },
  methods: {
    ...mapActions([
      'help',
    ]),
  },
};
</script>

<style lang="scss">
.home {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  text-align: center;

  section {
    flex-shrink: 0;
    padding: 0 0 40px;

    & > header {
      padding: 20px;
    }
  }
  .hero {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;

    .md-display-3 {
      margin-bottom: 0;
    }
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
  #features {
    .md-layout {
      .md-layout-item {
        padding: 20px;
      }
    }
  }
}
</style>
