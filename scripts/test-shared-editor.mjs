import assert from "node:assert/strict";
import {
  chromium,
  webkit,
} from "../web/node_modules/@playwright/test/index.mjs";
import { mkdir } from "node:fs/promises";
await mkdir("/private/tmp/shared-editor-checks", { recursive: true });
const engine = process.argv.includes("--webkit") ? webkit : chromium;
const browser = await engine.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await context.route("https://**/*", (r) => r.abort());
const editor = () => page.frameLocator('iframe[title="ScotDance Connect"]');
const ready = async () => {
  await editor().getByLabel("First name", { exact: true }).waitFor();
  await editor()
    .locator("dialog")
    .evaluate((el) =>
      Promise.allSettled(el.getAnimations().map((a) => a.finished)),
    );
};
async function closed() {
  await page
    .locator('iframe[title="ScotDance Connect"]')
    .waitFor({ state: "detached" });
}
try {
  // Actual Binder signup, using its built-in fictional owner data.
  await page.goto("http://127.0.0.1:5322/signup?studio=cshd");
  await page
    .getByRole("button", { name: "Sign in with ScotDance.app" })
    .click();
  await page.getByRole("button", { name: "Edit Isla Fraser" }).click();
  await ready();
  assert.equal(
    await page.evaluate(() => document.documentElement.style.overflow),
    "hidden",
  );
  await editor().getByLabel("First name", { exact: true }).fill("Isla Changed");
  await editor().getByRole("button", { name: "Close", exact: true }).click();
  await closed();
  await page.getByRole("button", { name: "Edit Isla Fraser" }).waitFor();
  await page.getByRole("button", { name: "Edit Isla Fraser" }).click();
  await ready();
  await editor().getByLabel("First name", { exact: true }).fill("Isla Saved");
  await editor().getByRole("button", { name: "Save", exact: true }).click();
  await closed();
  await page.getByRole("button", { name: "Edit Isla Saved Fraser" }).waitFor();
  await page.waitForFunction(
    () =>
      document.activeElement?.getAttribute("aria-label") ===
      "Edit Isla Saved Fraser",
  );
  await page.getByRole("button", { name: "Add a dancer", exact: true }).click();
  await ready();
  await editor().getByLabel("First name", { exact: true }).fill("Finn");
  await editor().getByLabel("Last name", { exact: true }).fill("Fraser");
  await editor().getByLabel("Birthday", { exact: true }).fill("20180506");
  await editor().getByRole("button", { name: "Don’t have one?" }).click();
  await editor()
    .getByLabel("Category", { exact: true })
    .selectOption("Primary");
  await editor().getByRole("button", { name: "Edit teacher studio" }).click();
  await editor()
    .getByLabel("Teacher studio", { exact: true })
    .fill("Other Studio");
  await editor().getByRole("button", { name: "Save", exact: true }).click();
  await editor()
    .getByRole("button", { name: "Just this dancer", exact: true })
    .click();
  await closed();
  await page.getByRole("button", { name: "Edit Finn Fraser" }).click();
  await ready();
  assert.equal(
    await editor().getByLabel("Birthday", { exact: true }).inputValue(),
    "2018-05-06",
  );
  assert.equal(
    await editor().getByLabel("Teacher studio", { exact: true }).inputValue(),
    "Other Studio",
  );
  await editor()
    .getByRole("button", { name: "Delete dancer", exact: true })
    .click();
  await editor().getByRole("button", { name: "Keep dancer" }).click();
  await editor().getByRole("button", { name: "Close", exact: true }).click();
  await closed();
  // Inclusion is separate from deleting the private profile.
  await page.getByRole("checkbox", { name: /Finn Fraser/ }).uncheck();
  await page.getByRole("button", { name: "Edit Finn Fraser" }).waitFor();
  await page.getByLabel("Phone", { exact: true }).fill("4035550123");
  await page.getByRole("button", { name: "Send signup", exact: true }).click();
  await page.getByRole("heading", { name: "Sent to your teacher" }).waitFor();
  const submissions = await page.evaluate(async () =>
    JSON.parse(
      (
        await (
          await fetch("/__signup-preview?key=binder.demo.parent-signups")
        ).json()
      ).value,
    ),
  );
  const latest = submissions[0].details.dancers;
  assert.equal(latest.length, 1);
  assert.equal(latest[0].firstName, "Isla Saved");
  assert.equal("id" in latest[0], false);
  assert.equal("publicDancer" in latest[0], false);
  console.log(
    "PASS signup: cancel, owner save, add, birthday typing, per-dancer defaults, inclusion, whitelisted submission",
  );

  // Parent portal: own saved profiles are independent from studio roster / viewing a family.
  await page.goto("http://127.0.0.1:5322/?studio=cshd");
  await page.getByRole("button", { name: "Signed in", exact: true }).click();
  await page
    .getByRole("button", { name: "Your saved dancers", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit Isla Fraser" }).click();
  await ready();
  await page.setViewportSize({ width: 390, height: 844 });
  await editor()
    .getByRole("button", { name: "Edit city", exact: true })
    .click();
  await editor()
    .getByRole("combobox", { name: "City", exact: true })
    .fill("Canm");
  await editor().getByRole("option", { name: "Canmore AB, Canada" }).click();
  await editor().getByRole("button", { name: "Save", exact: true }).click();
  await closed();
  await page.getByRole("button", { name: "Edit Isla Fraser" }).click();
  await ready();
  assert.equal(
    await editor().getByLabel("City", { exact: true }).inputValue(),
    "Canmore, AB",
  );
  // Picker is contained in the full viewport, without growing the parent document.
  const before = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  await editor()
    .getByRole("button", { name: /calendar|Choose birthday/i })
    .click();
  const rect = await editor().locator("[popover]").boundingBox();
  assert.ok(
    rect &&
      rect.x >= 0 &&
      rect.y >= 0 &&
      rect.x + rect.width <= 391 &&
      rect.y + rect.height <= 845,
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollHeight),
    before,
  );
  await editor().locator("[popover]").press("Escape");
  await page.screenshot({
    path: "/private/tmp/shared-editor-checks/portal-editor-mobile.png",
    fullPage: false,
  });
  await editor()
    .getByRole("button", { name: "Delete dancer", exact: true })
    .click();
  await editor()
    .getByRole("button", { name: "Delete dancer", exact: true })
    .click();
  await closed();
  await page
    .getByRole("button", { name: "Edit Isla Fraser" })
    .waitFor({ state: "detached" });
  console.log(
    "PASS parent portal: city autocomplete, mobile picker, owner deletion",
  );

  // Native Connect renders the same component directly; only the API is fictional.
  const native = {
    account: {
      uid: "native-owner",
      name: "Jamie",
      email: "jamie@example.test",
      emailVerified: true,
    },
    dancers: [
      {
        id: "native-dancer-12345",
        revision: 1,
        firstName: "Native",
        lastName: "Dancer",
        birthday: "2015-04-12",
        category: "Beginner",
        studio: "Demo",
        registrationNumber: "",
      },
    ],
    defaults: { studio: "Demo" },
    defaultsRevision: 1,
  };
  await page.route("http://127.0.0.1:5320/api/**", async (route) => {
    const action = new URL(route.request().url()).pathname.split("/").pop(),
      body = route.request().postDataJSON();
    if (action === "save") {
      native.dancers = [{ ...body.dancer, id: body.id, revision: 2 }];
      await route.fulfill({ json: { id: body.id, revision: 2 } });
    } else await route.fulfill({ json: native });
  });
  await page.goto("http://127.0.0.1:5320/dancers");
  await page.getByRole("button", { name: /Native Dancer/ }).click();
  assert.equal(page.frames().length, 1);
  await page.getByLabel("First name", { exact: true }).fill("Native Saved");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: /Native Saved Dancer/ }).waitFor();
  console.log("PASS Connect: direct shared component owner save, no iframe");

  // Entries' actual Vue wrapper, injected API responses, no Firebase or production state.
  await page.route("**/src/data/api.ts", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
    let failures=1;
    export const problemMessage=e=>e.message;
    export async function call(name,data={}) {
      window.editorCalls??=[];window.editorCalls.push({name,data});
      if(name==='listDancers') return {dancers:[],defaults:{studio:'Entries Studio'},defaultsRevision:4};
      if(name==='saveDancer'){if(failures-- > 0)throw new Error('Temporary test interruption');return {id:data.dancer.id,dancer:{...data.dancer,revision:1}};}
      throw new Error(name);
    }
  `,
    }),
  );
  await page.goto("http://127.0.0.1:5323/tests/e2e/shared-editor/index.html");
  await page.getByRole("button", { name: "Add a dancer", exact: true }).click();
  await ready();
  await editor().getByLabel("First name", { exact: true }).fill("Entries");
  await editor().getByLabel("Last name", { exact: true }).fill("Dancer");
  await editor().getByRole("button", { name: "Save", exact: true }).click();
  await editor()
    .getByRole("alert")
    .filter({ hasText: "Temporary test interruption" })
    .waitFor();
  await editor().getByRole("button", { name: "Save", exact: true }).click();
  await closed();
  assert.match(await page.locator("output").innerText(), /Entries/);
  const calls = await page.evaluate(() =>
    window.editorCalls.filter((c) => c.name === "saveDancer"),
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].data.requestId, calls[1].data.requestId);
  assert.equal(calls[0].data.defaultsRevision, 4);
  await page.getByRole("button", { name: "Add a dancer", exact: true }).click();
  await ready();
  await page
    .getByRole("button", { name: "Switch account" })
    .evaluate((el) => el.click());
  await closed();
  console.log(
    "PASS Entries: real wrapper save, stable retry receipt, defaults revision, account switch cancels",
  );
  assert.deepEqual(errors, []);
  console.log("ALL PASS", engine.name());
} catch (e) {
  console.log("FAILPAGE", await page.locator("body").innerText());
  for (const f of page.frames().slice(1))
    console.log("FAILFRAME", await f.locator("body").innerText());
  await page.screenshot({
    path: "/private/tmp/shared-editor-checks/flow-failure.png",
    fullPage: false,
  });
  throw e;
} finally {
  await browser.close();
}
