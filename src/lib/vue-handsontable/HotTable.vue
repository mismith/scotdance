<template>
  <div :id="this.root"></div>
</template>

<script>
/* eslint-disable */
  import Handsontable from 'handsontable';
  import 'handsontable/dist/handsontable.full.css';
  import SettingsMapper from './settingsMapper';
  import {
    hotInit,
    hotDestroy,
    propFactory,
    propWatchFactory,
    updateHotSettings,
    updateBulkHotSettings
  } from './helpers';

  export default {
    name: 'HotTable',
    props: propFactory(),
    watch: propWatchFactory(updateHotSettings, updateBulkHotSettings),
    mounted: function() { return hotInit(this); },
    beforeDestroy: function() { return hotDestroy(this); },
  };
</script>
