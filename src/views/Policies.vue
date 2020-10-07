<template>
  <form class="Policies app-scroll-frame app-scroll pa-4">
    <v-sheet id="privacy" class="px-8 py-4" style="max-width: 800px; margin: 0 auto;">
      <h2 class="subtitle">Privacy Policy</h2>
      <div>
        <p><em>ScotDance.app</em> uses enterprise-grade services and industry-standard security practices for storing and communicating all data. <em>ScotDance.app</em> does not share, sell, or advertise with user data in any capacity.</p>

        <p><strong>Any potentially user-identifying data gathered is used exclusively for the purpose of improving the app, fixing bugs in the code, providing support, etc.</strong></p>

        <p><strong>If you navigate/use the site/app</strong>, common web traffic stats are collected:</p>
        <ul>
          <li>basic analytics information, like: pageviews, IP addresses, dates and times</li>
          <li>device-type information, e.g.: operating system, web browser name and version</li>
          <li>information required by third-party services in order to function; for instance: cookies for determining login state</li>
        </ul>

        <p><strong>If you sign up for an account</strong>, the following user data is stored:</p>
        <ul>
          <li>your email address</li>
          <li>your (public) display name, should you choose to set one in your profile</li>
        </ul>

        <p><strong>If you submit a competition and/or edit competition data</strong>, it is assumed that:</p>
        <ul>
          <li>this information is publicly shareable, given that you are explicitly entering into the system</li>
          <li>any potentially sensitive information input is done so at your own discretion</li>
        </ul>

        <p>Additionally, a complete list of third-party products/services used to administer <em>ScotDance.app</em> is available <a href="https://github.com/mismith/scotdance#admin" target="_blank">on Github</a>.</p>
      </div>
    </v-sheet>
  </form>
</template>

<script>
export default {
  name: 'Policies',
};
</script>

<style lang="scss">
.Policies {
  p {
    margin-top: 20px;
  }
}
</style>
