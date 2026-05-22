<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1rem)]">
    <header
      class="mx-auto flex w-full max-w-3xl items-start justify-between gap-3 p-4 pb-3"
    >
      <div class="min-w-0 flex-1">
        <h1 class="text-title">Policies</h1>
      </div>
    </header>

    <main
      class="text-muted-foreground [&_:is(strong,em)]:text-foreground mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 pt-0"
    >
      <section id="privacy" class="space-y-4">
        <h2 class="text-2xl font-medium tracking-tight">Privacy Policy</h2>

        <p>
          <em>ScotDance.app</em> uses enterprise-grade services and industry-standard
          security practices for storing and communicating all data.
          <em>ScotDance.app</em> does not share, sell, or advertise with user data in any
          capacity.
        </p>

        <p>
          <strong>
            Any potentially user-identifying data gathered is used exclusively for the
            purpose of improving the app, fixing bugs in the code, providing support, etc.
          </strong>
        </p>

        <p>
          <strong>If you navigate/use the site/app</strong>, common web traffic stats are
          collected:
        </p>
        <ul class="ml-6 list-disc space-y-1">
          <li>
            basic analytics information, like: pageviews, IP addresses, dates and times
          </li>
          <li>
            device-type information, e.g.: operating system, web browser name and version
          </li>
          <li>
            information required by third-party services in order to function; for
            instance: cookies for determining login state
          </li>
        </ul>

        <p>
          <strong>If you sign up for an account</strong>, the following user data is
          stored:
        </p>
        <ul class="ml-6 list-disc space-y-1">
          <li>your email address</li>
          <li>
            your (public) display name, should you choose to set one in your profile
          </li>
        </ul>

        <p>
          <strong>If you submit a competition and/or edit competition data</strong>, it is
          assumed that:
        </p>
        <ul class="ml-6 list-disc space-y-1">
          <li>
            this information is publicly shareable, given that you are explicitly entering
            into the system
          </li>
          <li>
            any potentially sensitive information input is done so at your own discretion
          </li>
        </ul>

        <hr class="border-border/60 my-6" />

        <p>
          If desired, you can
          <strong>permanently delete your <em>ScotDance.app</em> account</strong>
          and all associated data. To do so:
        </p>
        <ol class="ml-6 list-decimal space-y-1">
          <li>log into your account,</li>
          <li>
            visit the
            <RouterLink
              :to="{ name: 'profile' }"
              class="hover:text-foreground underline underline-offset-4"
            >
              My Profile
            </RouterLink>
            page,
          </li>
          <li>select &ldquo;Delete Account&rdquo;,</li>
          <li>enter your password into the confirmation dialog.</li>
        </ol>

        <hr class="border-border/60 my-6" />

        <p>
          Additionally, a complete list of third-party products/services used to
          administer <em>ScotDance.app</em> is available
          <a
            href="https://github.com/mismith/scotdance#admin"
            target="_blank"
            rel="noopener"
            class="hover:text-foreground underline underline-offset-4"
          >
            on Github</a
          >.
        </p>
      </section>
    </main>
  </div>
</template>
