<template>
  <md-list-item
    :to="to"
    @click="$emit('click', $event)"
    class="dancer-list-item"
    :class="{ placeholder: dancer.number === '?' }"
  >
    <slot name="avatar">
      <md-avatar class="md-avatar-icon" :class="{ 'md-accent': dancer.$favorite }">
        <span>{{ dancer.number || '#' }}</span>
      </md-avatar>
    </slot>

    <div class="md-list-item-text">
      <span>{{ dancer.$name }}</span>
      <p>
        <span v-if="dancer.$group" class="group">{{ dancer.$group.$name }}</span>
        <span class="location">{{ dancer.location }}</span>
      </p>
    </div>

    <slot />

    <favorite-dancer-button :dancer="dancer" class="md-list-action" />

    <slot name="icon">
      <place v-if="place !== undefined" :place="place" />
    </slot>
  </md-list-item>
</template>

<script>
import FavoriteDancerButton from '@/components/utility/FavoriteDancerButton.vue';
import Place from '@/components/utility/Place.vue';

export default {
  name: 'dancer-list-item',
  props: {
    dancer: Object,
    place: Number,
    to: true,
  },
  components: {
    FavoriteDancerButton,
    Place,
  },
};
</script>

<style lang="scss">
.dancer-list-item {
  .md-list-item-text {
    p {
      span {
        &:not(:last-child) {
          &::after {
            content: "•";
            display: inline-block;
            margin-left: 0.25em;
            margin-right: 0.25em;
          }
        }
      }
    }
  }
  .place {
    margin-left: 12px;
  }

  &.placeholder {
    background: repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0, 0, 0, 0.1) 5px, rgba(0, 0, 0, 0.1) 10px);
  }
}
</style>
