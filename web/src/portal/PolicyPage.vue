<template>
  <section class="space-y-5 leading-relaxed">
    <h1 class="text-hero">Privacy &amp; terms</h1>
    <p class="text-muted-foreground">ScotDance Connect is your private account area for the ScotDance.app family of tools, run by Murray Rowan. Manage your account details here, and optionally save extras such as your dancers, their photos, studio and location to reuse in other tools.</p>
    <ul class="list-disc space-y-3 pl-5 text-muted-foreground">
      <li><strong class="text-foreground">Private by default.</strong> Your saved profiles are separate from public competition results. Only you and owners you explicitly invite can manage a dancer. Other people and AI assistants cannot browse your saved profiles. Signing in to a ScotDance tool lets you manage your own shared details there; submitting a form shares the details needed for that service.</li>
      <li><strong class="text-foreground">Your choice.</strong> Edit or delete saved profiles at any time. Linking a public dancer profile is a private reference, not verified identity or permission to change results. Every dancer owner has equal access, including inviting or removing owners and deleting that dancer. Deleting your account removes your access; dancers with other owners remain available to them. Existing competition entries, payment records and public results remain governed by their respective services.</li>
      <li><strong class="text-foreground">Service providers.</strong> Postmark delivers invitation emails to the address you provide, without dancer details. Google Firebase handles sign-in, hosting and storage; session cookies keep you signed in. Google Maps receives city searches, not dancer names or birthdays, and manual entry is available. Opening Support loads Crisp to handle your message and technical connection information.</li>
      <li><strong class="text-foreground">Limited technical records.</strong> Sessions expire after seven days, retry records after 30 days and change logs after 90 days. Logs contain record IDs and action times, not previous profile details. Photo originals and location metadata are discarded; deleted photos may remain in protected recovery storage for seven days.</li>
    </ul>
    <p class="text-muted-foreground">Connect is free and currently a preview. Only save details you’re entitled to manage, keep them accurate, protect your login and don’t misuse the service. Availability and features may change. For help or privacy requests, use Support below.</p>
    <RouterLink to="/account" class="inline-block text-primary">Back to Connect</RouterLink>
  </section>
</template>
