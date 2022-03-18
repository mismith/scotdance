<template>
  <v-subheader>
    Championship Points
    <HelpTip>
      Dancers listed here were placed by <em>at least one</em> judge; the combined score from <em>all</em> judges, however, didn't result in a full placing.
    </HelpTip>
  </v-subheader>
</template>

<script>
import HelpTip from '@/components/HelpTip.vue';

export default {
  components: {
    HelpTip,
  },
};
</script>
