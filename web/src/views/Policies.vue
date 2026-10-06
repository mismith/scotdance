<script setup lang="ts">
import AppBar from '@/components/nav/AppBar.vue'
import { useCrisp } from '@/composables/useCrisp'
import { RouterLink } from 'vue-router'

const crisp = useCrisp()
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1rem)]">
    <AppBar title="Privacy and terms" :fallback="{ to: { name: 'settings' }, label: 'Settings' }" />

    <main
      class="[&_:is(strong,em)]:text-foreground mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 pt-[calc(var(--chrome-top)+0.25rem)] text-base leading-relaxed text-muted-foreground"
    >
      <h1 class="text-display text-foreground">Privacy and terms</h1>
      <section id="privacy" class="space-y-4">
        <h2 class="text-title text-foreground">Privacy Policy</h2>

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
            basic visit information, like: IP addresses, dates and times (kept by the
            hosting and live chat services; there are no ads or analytics trackers)
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
          <li>
            the dancers, competitions and people you follow, and the colours you pick for
            your dancers (these are private to you)
          </li>
          <li>how you use the app (dancer, parent, teacher, organiser), should you say</li>
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

        <p>
          <strong>If you, or your dancer, are in a published competition</strong>, the
          details organisers print in the program and post with the results are public:
        </p>
        <ul class="ml-6 list-disc space-y-1">
          <li>
            for dancers: name, competitor number, where they’re from (a town, province,
            state or country), age group, dances and placings
          </li>
          <li>
            for judges and pipers: name, plus any photo, bio or website the organisers add
          </li>
        </ul>
        <p>
          Organisers enter these from their own entries. <em>ScotDance.app</em> doesn’t
          take entries itself, and has nowhere to put a dancer’s birthdate, address,
          school or contact details. Each person’s competitions are gathered onto one profile,
          matched by name, so families can follow a dancer from one competition to the
          next and keep a record of their results. Search engines like Google are asked
          not to list dancer pages, and competitions that aren’t published stay private.
        </p>
        <p>
          If something’s wrong, or you have a concern about what’s shown, the
          competition’s organisers can correct it, or please
          <button
            v-if="crisp.available"
            type="button"
            class="hover:text-foreground underline underline-offset-4"
            @click="crisp.open()"
          >
            get in touch</button
          ><template v-else>get in touch</template>. <em>ScotDance.app</em> is run by one
          volunteer, Murray Rowan.
        </p>

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
              Account
            </RouterLink>
            page,
          </li>
          <li>select &ldquo;Delete account&rdquo;,</li>
          <li>confirm, entering your password if your account has one.</li>
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
            on GitHub</a
          >.
        </p>
      </section>
    </main>
  </div>
</template>
