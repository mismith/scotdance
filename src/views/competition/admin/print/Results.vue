<template>
  <div class="CompetitionAdminPrintResults">
    <section v-for="group in augmentedGroups" :key="group[idKey]">
      <header>
        <h2>{{ group.$name }}</h2>
      </header>

      <article>
        <header>
          <h3>Dancers</h3>
        </header>

        <table cellspacing="0" border="1">
          <tr v-for="dancer in group.$dancers" :key="dancer[idKey]">
            <td v-for="prop in ['number', '$name', 'location']" :key="prop">
              {{ dancer[prop] }}
            </td>
          </tr>
        </table>
        <br />
      </article>

      <article>
        <header>
          <h3>Results</h3>
        </header>

        <table cellspacing="0" border="1">
          <tr>
            <th>Dance</th>
            <th v-for="place in group.$places" :key="place">
              <span>{{ place }}</span><sup>{{ getOrdinal(place) }}</sup>
            </th>
          </tr>
          <tr v-for="dance in group.$dances" :key="dance[idKey]">
            <td>{{ dance.$name }}</td>
            <td v-for="(place, index) in group.$places" :key="index">
              <tt
                v-for="dancer in dance.$placedDancers[index]"
                :key="dancer[idKey]"
                v-html="dancer.number"
                class="slash-separated"
              />
            </td>
          </tr>
        </table>

        <template v-if="group.$hasOverall">
          <table cellspacing="0" border="1">
            <tr>
              <th>{{ group.$hasDraws ? 'Champion' : 'Aggregate Winner' }}</th>
              <th>
                <tt
                  v-for="dancer in group.$overallPlacedDancers[0]"
                  :key="dancer[idKey]"
                  v-html="dancer.number"
                  class="slash-separated"
                />
              </th>
              <th v-if="group.trophy || group.sponsor">
                <div v-if="group.trophy">{{ group.trophy }}</div>
                <div v-if="group.sponsor">Sponsored by: {{ group.sponsor }}</div>
              </th>
            </tr>
            <template v-if="group.$hasDraws">
              <tr v-for="(place, index) in group.$places.slice(0, maxPlaces - 1)" :key="place">
                <td>{{ place }}{{ getOrdinal(place) }} Runner Up</td>
                <td>
                  <tt
                    v-for="dancer in group.$overallPlacedDancers[index + 1]"
                    :key="dancer[idKey]"
                    v-html="dancer.number"
                    class="slash-separated"
                  />
                </td>
                <td v-if="group.trophy || group.sponsor"><!-- @TODO: runner up sponsors --></td>
              </tr>
            </template>
          </table>
          <br />
        </template>
        <hr class="pb" />
      </article>

      <article v-if="group.$hasDraws">
        <header>
          <h3>Draw</h3>
        </header>

        <table cellspacing="0" border="1">
          <tr>
            <th colspan="2">Dancer</th>
            <th v-for="dance in group.$dances" :key="dance[idKey]">
              {{ dance.$shortName }}
            </th>
          </tr>
          <tr v-for="(dancer, index) in group.$dancers" :key="dancer[idKey]">
            <td v-for="prop in ['number', '$name']" :key="prop">
              {{ dancer[prop] }}
            </td>
            <td v-for="dance in group.$dances" :key="dance[idKey]">
              {{ dance.$draw[index] }}
            </td>
          </tr>
        </table>
        <br />
        <hr class="pb" />
      </article>
    </section>
  </div>
</template>

<script>
import { get } from 'deep-property';
import { idKey } from '@/helpers/firebase';
import {
  getOrdinal,
  findGroupDances,
  findGroupDancers,
  hasOverall,
  overall,
  findPlacedDancers,
} from '@/helpers/results';

export default {
  name: 'CompetitionAdminPrintResults',
  reactiveInject: {
    competitionBundle: [
      'dancers',
      'groups',
      'dances',
      'draws',
      'results',
    ],
  },
  data() {
    return {
      idKey,

      maxPlaces: 6,
    };
  },
  computed: {
    augmentedGroups() {
      const getMaxPlaces = (numDancers) => Math.min(Math.ceil(numDancers / 2) + 1, this.maxPlaces);
      const placedDancersReducer = (acc, dancer) => {
        if (dancer.$tie && acc.length) {
          acc[acc.length - 1].push(dancer);
        } else {
          acc.push([dancer]);
        }
        return acc;
      };

      return this.groups.map((group) => {
        const dancers = findGroupDancers(group, this.dancers);
        const dances = findGroupDances(group, this.dances).map((dance) => {
          const draw = get(this.draws, `${group[idKey]}.${dance[idKey]}`);

          return {
            ...dance,
            $draw: draw,
            $placedDancers: findPlacedDancers(group, dance, this.dancers, this.results)
              .reduce(placedDancersReducer, []),
          };
        });

        return {
          ...group,
          $dancers: dancers,
          $dances: dances,
          $places: Array.from(Array(getMaxPlaces(dancers.length)).keys()).map((i) => i + 1),
          $hasDraws: dances.some(({ $draw }) => $draw && Object.keys($draw).length),
          $hasOverall: hasOverall(group),
          $overallPlacedDancers: findPlacedDancers(group, overall, this.dancers, this.results)
            .reduce(placedDancersReducer, []),
        };
      });
    },
  },
  methods: {
    getOrdinal,
  },
};
</script>
