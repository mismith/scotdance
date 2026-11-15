<template>
  <RequiresPermission class="Profile app-scroll-frame app-scroll">
    <div class="pa-4">
      <h1 class="text-h5 mb-4">Your ScotDance account</h1>
      <p>Manage your name, email, password and dancers in ScotDance Connect.</p>
      <v-btn color="primary" href="https://connect.scotdance.app/?section=account">
        Edit your ScotDance account
      </v-btn>
    </div>
  </RequiresPermission>
</template>

<script>
import RequiresPermission from '@/components/RequiresPermission.vue';

export default {
  name: 'Profile',
  components: { RequiresPermission },
};
</script>
