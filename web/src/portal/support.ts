import { SCOTDANCE_CRISP_WEBSITE_ID } from '@/lib/crisp'
let starting: Promise<typeof import("crisp-sdk-web")> | undefined;
/** Support is loaded only after an explicit click or visit to /support. No profile identity is sent. */
export async function openSupport() {
  starting ??= import("crisp-sdk-web")
    .then((module) => {
      module.Crisp.configure(SCOTDANCE_CRISP_WEBSITE_ID, {
        autoload: false,
      });
      module.Crisp.chat.onChatClosed(() => module.Crisp.chat.hide());
      module.Crisp.load();
      return module;
    })
    .catch((error) => {
      starting = undefined;
      throw error;
    });
  const { Crisp } = await starting;
  Crisp.chat.show();
  Crisp.chat.open();
}
