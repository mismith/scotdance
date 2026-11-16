<template>
  <section class="space-y-4 leading-relaxed [&_h2]:pt-4 [&_h2]:text-title [&_p]:text-muted-foreground">
    
    <h1 class="text-hero">Privacy and terms</h1>
    <h2>Your private profiles</h2>
    <p>
      Connect is run by Murray Rowan. It stores the dancer details you provide
      so you can manage them and choose how they are used across ScotDance apps.
      These profiles are separate from public competition results.
    </p>
    <p>
      Your existing ScotDance account provides your sign-in identity and email.
      Private profiles are stored in Connect’s separate Google Firebase project.
      Session cookies keep you signed in; Google also processes technical
      information needed to host and secure the service.
    </p>
    <h2>Your account across ScotDance</h2>
    <p>
      When you sign in to Entries with your ScotDance account, you can read,
      update and delete your own dancer profiles there, just as you can here.
      Entries and Connect use the same private records. No separate connection
      is needed.
    </p>
    <p>
      Studios and other people do not receive access just because you sign in.
      There is no public search of private profiles, and they are not supplied
      to AI assistants. Information submitted with a competition entry remains
      part of that entry and is managed by the relevant app and organiser.
    </p>
    <h2>Changes and deletion</h2>
    <p>
      You can edit or delete your private dancer profiles in Dancers.
      Deletion removes the active profile. Technical change records contain
      record identifiers and action times, not copies of previous profile
      details, and expire after 90 days. Request-retry records expire after 30
      days; sign-in sessions expire after seven days.
    </p>
    <p>
      Manage your name, email, password or account deletion in Account. Account
      deletion also removes your private Connect profiles. Previously submitted
      competition and payment records follow the relevant app’s retention rules.
      For privacy questions, use Support below.
    </p>
    <h2>City suggestions</h2>
    <p>City search sends the city text you type to Google Maps to suggest places. It does not send dancer names or birthdays. You can enter a city manually instead.</p>
    <h2>Support</h2>
    <p>
      Opening Support loads Crisp live chat. Crisp receives the message you send
      and technical information needed to provide the chat. Connect does not
      automatically send your dancer profiles to chat.
    </p>
    <h2>Using Connect</h2>
    <p>
      Connect is free. Only add information you are entitled to manage, keep it
      accurate, and protect your sign-in details. Registration numbers you enter
      are self-declared, not verified credentials. Do not misuse access,
      impersonate someone else, or interfere with the service.
    </p>
    <p>
      Connect is currently a preview. Features and availability may change.
      Competition entries, payments and studio arrangements remain governed by
      the relevant app and organiser.
    </p>
    <RouterLink to="/dancers" class="text-primary">Back to Connect</RouterLink>
  </section>
</template>
