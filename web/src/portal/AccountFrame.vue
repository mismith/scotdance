<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { useTheme } from '@/composables/useTheme';
const { isDark } = useTheme();
const props = defineProps<{ uid: string }>();
const emit = defineEmits<{
  changed: [token: string];
  deleted: [];
  reauth: [];
}>();
const frame = ref<HTMLIFrameElement>();
const height = ref(480);
const identityOrigin = "https://next.scotdance.app";
function init() {
  frame.value?.contentWindow?.postMessage(
    { channel: "scotdance:account", type: "init", uid: props.uid, dark: isDark.value },
    identityOrigin,
  );
}
function receive(event: MessageEvent) {
  if (
    event.origin !== identityOrigin ||
    event.source !== frame.value?.contentWindow ||
    event.data?.channel !== "scotdance:account"
  )
    return;
  if (event.data.type === "ready") init();
  if (event.data.type === "height" && Number.isFinite(event.data.height))
    height.value = Math.min(1800, Math.max(360, event.data.height + 8));
  if (
    event.data.type === "changed" &&
    event.data.uid === props.uid &&
    typeof event.data.token === "string"
  )
    emit("changed", event.data.token);
  if (event.data.type === "deleted") emit("deleted");
  if (event.data.type === "reauth") emit("reauth");
}
watch(() => [props.uid, isDark.value], init);
onMounted(() => window.addEventListener("message", receive));
onBeforeUnmount(() => window.removeEventListener("message", receive));
</script>
<template>
  <iframe
    ref="frame"
    :key="uid"
    title="Your ScotDance account settings"
    src="https://next.scotdance.app/account.html"
    class="block w-full border-0"
    :style="{ height: `${height}px` }"
    @load="init"
  />
</template>
