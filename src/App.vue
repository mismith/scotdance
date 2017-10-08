<template>
  <div id="app">

    <md-sidenav class="md-left md-fixed" ref="sidebar">
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
        <md-list-item @click="$refs.sidebar.toggle()" class="md-primary">
          <md-icon>insert_drive_file</md-icon> <span>My files</span>
        </md-list-item>

        <md-list-item @click="$refs.sidebar.toggle()">
          <md-icon>people</md-icon> <span>Shared with me</span>
        </md-list-item>

        <md-list-item @click="$refs.sidebar.toggle()">
          <md-icon>access_time</md-icon> <span>Recent</span>
        </md-list-item>

        <md-list-item @click="$refs.sidebar.toggle()">
          <md-icon>start</md-icon> <span>Starred</span>
        </md-list-item>

        <md-list-item @click="$refs.sidebar.toggle()">
          <md-icon>delete</md-icon> <span>Trash</span>
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

        <md-button class="md-icon-button">
          <md-icon>search</md-icon>
        </md-button>
      </div>
    </md-toolbar>

    <main id="main">
      <router-view />
    </main>

  </div>
</template>

<script>
export default {
  name: 'app',
};
</script>

<style lang="scss">
html,
body,
#app {
  height: 100%;
  overflow: hidden;
}
#app,
#main {
  display: flex;
  flex-direction: column;
}
#main {
  flex: 1;
  overflow: auto;
}
</style>
