<template>
  <div id="app" class="md-scroll-frame md-scroll">

    <md-sidenav md-swipeable class="md-left md-fixed" ref="sidebar">
      <md-toolbar class="md-account-header">
        <md-list class="md-transparent">
          <md-list-item>
            <md-avatar class="md-large">
              <img src="https://placeimg.com/64/64/people/8" alt="People" />
            </md-avatar>
          </md-list-item>

          <md-list-item>
            <div class="md-list-text-container">
              <span>John Doe</span>
              <span>johndoe@email.com</span>
            </div>

            <md-button class="md-icon-button md-list-action">
              <md-icon>arrow_drop_down</md-icon>
            </md-button>
          </md-list-item>
        </md-list>
      </md-toolbar>

      <md-list>
        <md-subheader>Competitions</md-subheader>
        <md-list-item v-for="competition in competitions" :key="competition[idKey]" :href="`/competitions/${competition[idKey]}`" @click="$refs.sidebar.toggle()">
          <md-icon>event</md-icon>
          <span>{{ competition.name }}</span>
        </md-list-item>
      </md-list>
    </md-sidenav>

    <md-toolbar>
      <div class="md-toolbar-container">
        <md-button class="md-icon-button" @click="$refs.sidebar.toggle()">
          <md-icon>menu</md-icon>
        </md-button>

        <h2 class="md-title">ScotDance</h2>

        <span class="md-flex"></span>

        <!--<md-button class="md-icon-button">
          <md-icon>search</md-icon>
        </md-button>-->
      </div>
    </md-toolbar>

    <main id="main" class="md-scroll-frame md-scroll">
      <router-view />
    </main>

  </div>
</template>

<script>
import {
  idKey,
  db,
} from '@/helpers/firebase';

export default {
  name: 'app',
  data() {
    return {
      idKey,
    };
  },
  firebase: {
    competitions: db.child('competitions'),
  },
};
</script>

<style lang="scss">
html,
body {
  @extend .md-scroll-frame;
}

.md-scroll-frame {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.md-scroll {
  flex: 1;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

[class*="icon-"].md-icon {
  font-size: 20px;
}
</style>
