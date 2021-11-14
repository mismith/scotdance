import { valueKey } from '@/helpers/firebase';

export function hasNoExistingTabData(data) {
  return data?.[valueKey] === null;
}
export function isTabDisabled(data) {
  return data?.[valueKey] === false;
}

export async function handleTabDisable(slug, vm) {
  const shouldDisableTab = !vm.isTabDisabled;
  const setTabData = (v) => vm.$emit('change', { [slug]: v });
  const clearTabData = () => {
    setTabData(false);
  };

  if (shouldDisableTab) {
    if (vm.hasNoExistingTabData) {
      // clear without confirmation (since there's no data to lose)
      clearTabData();
    } else {
      // confirm whether we really want to clear
      try {
        await new Promise((resolve, reject) => {
          // eslint-disable-next-line no-param-reassign
          vm.confirmDisable = { resolve, reject };
        });

        clearTabData();
      } catch (err) {
        if (err) console.error(err); // eslint-disable-line no-console
      } finally {
        // eslint-disable-next-line no-param-reassign
        vm.confirmDisable = null;
      }
    }
  } else {
    // remove explicit disabled flag
    setTabData(null);
  }
}
