<template>
  <div v-persist-scroll="'/'" class="home md-scroll-frame md-scroll">
    <section class="hero">
      <div>
        <img src="static/img/touchicon.png" role="presentation" width="88" height="88" />
        <h1 class="md-display-2">ScotDance</h1>
        <p class="md-headline">{{ $package.description }}</p>
        <p class="md-subheading">Skip the pen and paper—attend highland dance competitions in style with this app for your mobile device.</p>
        <p class="print-hide">
          <md-button :to="{ name: 'competitions' }" class="md-primary md-raised md-large">
            Browse Competitions
          </md-button>
        </p>
        <p v-if="!isApp" class="store-badges">
          <a href="https://itunes.apple.com/us/app/scotdance/id1386475626?mt=8" target="_blank">
            <img src="static/img/app-store.svg" alt="Download on the App Store" />
          </a>
          <a href="https://play.google.com/store/apps/details?id=info.mismith.scotdance" target="_blank">
            <img src="static/img/play-store.svg" alt="Get it on Google Play" />
          </a>
        </p>
        <h1 class="md-display-1 print-show">
          <a href="https://scotdance.app">www.scotdance.app</a>
        </h1>
      </div>
    </section>

    <section id="about" class="alt">
      <header>
        <h2 class="md-display-1">A virtual program of events</h2>
        <p class="md-subheading">Modernize your highland dancing experience by interacting with competition information digitally.</p>
      </header>
      <div class="md-layout">
        <div class="md-layout-item md-xsmall-size-100 md-size-33">
          <md-icon class="md-size-4x icon-people md-primary" />
          <h2 class="md-title">Dancers</h2>
          <p>Search through dancers by their competition number, name, age group, etc. Then mark your favourites for easy tracking.</p>
        </div>
        <div class="md-layout-item md-xsmall-size-100 md-size-33">
          <md-icon class="md-size-4x icon-clock md-primary" />
          <h2 class="md-title">Schedule</h2>
          <p>Use the at-a-glance schedule to check event start times, which platforms to dance at, order of dances, and more.</p>
        </div>
        <div class="md-layout-item md-xsmall-size-100 md-size-33">
          <md-icon class="md-size-4x icon-trophy md-primary" />
          <h2 class="md-title">Results</h2>
          <p>Get real-time results updates—from callbacks through to placings—and review them anytime after a competition, too.</p>
        </div>
      </div>
      <footer>
          <md-button :to="{ name: 'competitions' }" class="md-primary md-raised">Browse Competitions</md-button>
      </footer>
    </section>

    <section id="faq">
      <header>
        <h2 class="md-display-1">FAQs</h2>
        <dl v-if="faqs.length">
          <template v-for="faq in faqs">
            <dt :key="faq.question" v-html="faq.question" class="md-title" />
            <dd :key="faq.answer" v-html="faq.answer" class="pre-line" />
          </template>
        </dl>
        <mi-md-spinner v-else />
      </header>
    </section>

    <section id="info" class="alt">
      <header>
        <h2 class="md-display-1">Info</h2>
        <p>ScotDance was started in 2017 by <a href="https://mismith.io" target="_blank" class="ext">Murray Smith</a></p>
        <p>View the source code on <a href="https://github.com/mismith/scotdance" target="_blank" class="ext">GitHub</a></p>
        <p>Track development via <a href="https://trello.com/b/ZCZ8t1fH" target="_blank" class="ext">Trello</a></p>
        <p>Get support via <a @click.prevent="help(true)">Live Chat</a></p>
        <p><small>{{ ($device && $device.platform) || '' }} App v{{ $package.version || '?' }}</small></p>
      </header>
    </section>
  </div>
</template>

<script>
import {
  mapState,
  mapActions,
} from 'vuex';
import { db } from '@/helpers/firebase';

export default {
  name: 'home',
  firebase: {
    faqs: db.child('faqs'),
  },
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
  #about {
    .md-layout {
      .md-layout-item {
        padding: 20px;
      }
    }
  }
  #faq {
    dl {
      max-width: 768px;
      text-align: left;
      margin: 0 auto;

      dt,
      dd {
        margin: 12px 0;
      }
      dt {
        margin-top: 24px;
      }
    }
  }
  #info {
    a {
      white-space: nowrap;
    }
  }
}
</style>
