<template>
  <div
    class="bg-foreground/8 relative isolate overflow-hidden rounded-md"
    aria-hidden="true"
  >
    <div
      class="absolute inset-0 -translate-x-full animate-[skeleton-shimmer_1.6s_ease-in-out_infinite]"
      style="
        background: linear-gradient(
          110deg,
          transparent 30%,
          color-mix(in oklch, var(--foreground) 14%, transparent) 50%,
          transparent 70%
        );
      "
    />
  </div>
</template>
