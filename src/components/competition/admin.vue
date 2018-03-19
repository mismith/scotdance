<template>
  <div class="competition-admin md-scroll-frame">
    <div class="md-scroll-frame">
      <md-toolbar class="md-dense">
        <div v-if="inTabs('info', 'categories', 'dancers', 'groups')">
          <md-button @click="showImport = true">Import</md-button>
        </div>

        <div v-if="currentSection">
          <preset-picker v-if="currentSection.presets" :presets="currentSection.presets" @select="addPresets" />
        </div>

        <span style="flex-grow: 1;"></span>

        <md-button @click="save()" class="md-primary md-raised" :disabled="!isDirty">Save</md-button>
      </md-toolbar>
      <div class="md-scroll-frame">
        <div class="md-scroll-frame">
          <form v-if="currentSection.form" class="md-padding">
            <div v-for="field in currentSection.form.fields" :key="field.data">
              <md-datepicker
                v-if="field.type === 'datetime'"
                v-model="competition[field.data]"
                @input="handleFormInputChange(currentSection[idKey], field.data, $event)"
                :class="{ 'md-required': field.required }"
              >
                <label>{{ field.title }}</label>
              </md-datepicker>
              <md-field v-else>
                <label>{{ field.title }}</label>
                <md-input
                  v-model="competition[field.data]"
                  @change="handleFormInputChange(currentSection[idKey], field.data, $event.target.value)"
                  :required="field.required"
                />
              </md-field>
            </div>
          </form>

          <hot-table v-else-if="currentSection.hot" :settings="currentSection.hot" class="fullscreen" />

          <admin-schedule v-else-if="currentSection[idKey] === 'schedule'" v-bind="$props" @change="handleChanges" />

          <admin-results v-else-if="currentSection[idKey] === 'results'" v-bind="$props" @change="handleChanges" />

          <md-subheader v-else>
            TBD
          </md-subheader>

          <footer v-if="inTabs('info')" class="md-layout md-alignment-center" style="margin-top: auto;">
            <md-button @click="confirmRemove = true" class="md-accent">
              Delete Competition
            </md-button>
          </footer>
        </div>
      </div>
    </div>

    <md-bottom-bar :md-active-item="`tab-${$router.currentRoute.params.tab || 'info'}`">
      <md-bottom-bar-item
        v-for="section of sections"
        :key="section[idKey]"
        @click="$router.push({ name: 'competition.admin', params: { tab: section[idKey] } })"
        :id="`tab-${section[idKey]}`"
      >
        <md-icon :class="section.icon"></md-icon>
        <span class="md-bottom-bar-label">{{ section.name }}</span>
      </md-bottom-bar-item>
    </md-bottom-bar>

    <md-dialog :md-active.sync="showImport" style="width: 100%; height: 100%;">
      <admin-import :competition-data-ref="competitionDataRef" @done="showImport = false" />
    </md-dialog>
    <md-dialog-confirm
      :md-active.sync="confirmRemove"
      md-title="Delete competition"
      md-content="Are you sure you want to permanently delete this competition?"
      md-confirm-text="Yes"
      md-cancel-text="No"
      @md-confirm="remove"
    />
  </div>
</template>

<script>
import HotTable from '@/lib/vue-handsontable/HotTable';
import AdminImport from '@/components/competition/admin/import';
import AdminSchedule from '@/components/competition/admin/schedule';
import AdminResults from '@/components/competition/admin/results';
import PresetPicker from '@/components/preset-picker';
import {
  idKey,
  db,
} from '@/helpers/firebase';
import {
  makeKeyValuePairColumn,
} from '@/helpers/handsontable';

export default {
  name: 'competition-admin',
  props: {
    competitionRef: {
      type: Object,
      required: true,
    },
    competitionDataRef: {
      type: Object,
      required: true,
    },
    competition: Object,
    dancers: Array,
    groups: Array,
    categories: Array,
    dances: Array,
    staff: Array,
    platforms: Array,
    schedule: Object,
    results: Object,
  },
  data() {
    return {
      idKey,

      showImport: false,
      confirmRemove: false,

      unsavedChanges: {},
    };
  },
  firebase() {
    return {
      sectionsRaw: db.child('sections'),
    };
  },
  computed: {
    currentTab() {
      return this.$route.params.tab || 'info';
    },
    currentSection() {
      return this.getSection(this.currentTab);
    },

    sections() {
      return this.sectionsRaw
        .map((sectionData) => {
          const section = {
            ...sectionData,
          };
          const data = [].concat(this[section[idKey]]);

          if (section.hot) {
            section.hot = {
              contextMenu: [
                'remove_row',
              ],
              minSpareRows: 1,
              colHeaders: true,
              rowHeaders: true,
              stretchH: 'all',

              ...section.hot,

              data,

              afterChange: (changes, source) => {
                if (source !== 'loadData') {
                  changes.forEach(([row, prop, oldVal, newVal]) => { // eslint-disable-line no-unused-vars
                    // add key if new entry
                    if (!data[row][idKey]) {
                      data[row][idKey] = db.push().key;
                    }

                    // queue up a save
                    const path = `${section[idKey]}/${data[row][idKey]}/${prop.replace('.', '/')}`;
                    this.queueSave(path, newVal);
                  });
                }
              },
              beforeRemoveRow: (index, amount) => {
                for (let i = 0; i < amount; i += 1) {
                  const path = `${section[idKey]}/${data[index + i][idKey]}`;
                  this.queueSave(path, null);
                }
              },
            };
            if (section[idKey] === 'dances') {
              section.hot.columns = section.hot.columns.concat(this.groups
                .filter(group => group[idKey]) // remove extra/blank row
                .map(group => ({
                  data: `groupIds.${group[idKey]}`,
                  title: group.$name,
                  type: 'checkbox',
                  uncheckedTemplate: null,
                })));
            }
            section.hot.columns = section.hot.columns.map((column) => {
              if (column.data === 'categoryId') {
                // eslint-disable-next-line no-param-reassign
                column.source = this.categories;
                return makeKeyValuePairColumn(column, 'name');
              }
              if (column.data === 'groupId') {
                // eslint-disable-next-line no-param-reassign
                column.source = this.groups;
                return makeKeyValuePairColumn(column);
              }
              return column;
            });
          }
          return section;
        });
    },
    isDirty() {
      return Object.keys(this.unsavedChanges).length;
    },
  },
  methods: {
    // @TODO: alert to confirm losing changes on tab change
    inTabs(...tabs) {
      return tabs.some(tab => (this.currentTab) === tab);
    },
    getSection(sectionId) {
      return this.sections.find(section => section[idKey] === sectionId);
    },

    queueSave(path, value) {
      this.$set(this.unsavedChanges, path, value);
    },
    async save() {
      // process competition/info saves first/differently
      const infoChanges = {};
      Object.entries(this.unsavedChanges).forEach(([path, value]) => {
        const infoRegex = /^info\//;
        if (infoRegex.test(path)) {
          // move to infoChanges
          infoChanges[path.replace(infoRegex, '')] = value;
          delete this.unsavedChanges[path];
        }
      });
      await this.competitionRef.update(infoChanges);

      // next, process all the data changes
      await this.competitionDataRef.update(this.unsavedChanges);

      // reset everything
      this.$set(this, 'unsavedChanges', {});
    },

    async remove() {
      await this.competitionRef.remove();
      await this.competitionDataRef.remove();
      this.$router.replace('/');
    },

    addPresets(presets, tab = this.currentTab) {
      // append
      // @TODO: make this local-only until save
      return Promise.all(presets.map((preset) => {
        return this.competitionDataRef.child(tab).push(preset);
      }));
    },

    handleFormInputChange(section, field, value) {
      return this.queueSave(`${section}/${field}`, value);
    },
    handleChanges(changes) {
      Object.entries(changes).forEach(([path, value]) => {
        this.queueSave(path, value);
      });
    },
  },
  components: {
    HotTable,
    AdminImport,
    AdminSchedule,
    AdminResults,
    PresetPicker,
  },
};
</script>

<style lang="scss">
.competition-admin {
  .md-table-cell {
    vertical-align: top;
  }
  .handsontable {
    z-index: 90; // keep below sidebar, backdrop, modals

    &.fullscreen {
      height: 100%;
    }
  }

  .admin-blades {
    .admin-blade {
      &:not(:last-child) {
        border-right: solid 6px #ccc;
      }
    }
  }
}
</style>
