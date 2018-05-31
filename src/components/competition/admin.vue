<template>
  <div class="competition-admin md-scroll-frame">
    <div v-if="me && me.admin" class="md-scroll-frame">
      <div v-if="currentSection" class="md-scroll-frame md-scroll">
        <md-toolbar class="md-dense">
          <div v-if="inTabs('info', 'categories', 'dancers', 'groups')">
            <md-button @click="showImport = true">Import</md-button>
          </div>

          <div v-if="currentSection">
            <preset-picker v-if="currentSection.presets" :presets="currentSection.presets" @select="addPresets" />
          </div>

          <span style="flex-grow: 1;"></span>

          <md-spunnable :md-spinning="saving" />
        </md-toolbar>
        <div class="md-scroll">
          <form v-if="currentSection.form" class="md-padding">
            <div v-for="field in currentSection.form.fields" :key="field.data">
              <md-datepicker
                v-if="field.type === 'datetime'"
                v-model="competition[field.data]"
                md-immediately
                @input="handleFormInputChange(currentSection[idKey], field.data, $event)"
                :class="{ 'md-required': field.required }"
              >
                <label>{{ field.title }}</label>
              </md-datepicker>

              <md-checkbox
                v-else-if="field.type === 'checkbox'"
                v-model="competition[field.data]"
                @change="handleFormInputChange(currentSection[idKey], field.data, $event)"
                :required="field.required"
              >
                {{ field.title }}
              </md-checkbox>

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

          <HotTable v-else-if="currentSection.hot" :settings="currentSection.hot" class="fullscreen" />

          <keep-alive v-else>
            <router-view v-bind="$props" @change="handleChanges" />
          </keep-alive>

          <footer v-if="inTabs('info')" class="md-layout md-alignment-center" style="margin-top: auto;">
            <md-button @click="confirmRemove = true" class="md-accent">
              Delete Competition
            </md-button>
          </footer>
        </div>
      </div>
      <div v-else class="md-scroll-frame">
        <md-progress-spinner md-mode="indeterminate" style="margin: auto;" />
      </div>

      <md-bottom-bar :md-active-item="`tab-admin-${currentTab}`">
        <md-bottom-bar-item
          v-for="section of sections"
          :key="section[idKey]"
          @click="goToTab(section[idKey])"
          :id="`tab-admin-${section[idKey]}`"
        >
          <md-icon :class="section.icon"></md-icon>
          <span class="md-bottom-bar-label">{{ section.name }}</span>
        </md-bottom-bar-item>
      </md-bottom-bar>

      <md-dialog :md-active.sync="showImport" class="import-dialog">
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
    <md-empty-state
      v-if="!me"
      md-icon="error"
      md-label="Login required"
    />
    <md-empty-state
      v-if="me && !me.admin"
      md-icon="error"
      md-label="Access denied"
    />
  </div>
</template>

<script>
import {
  mapState,
} from 'vuex';
import HotTable from '@handsontable/vue';
import AdminImport from '@/components/competition/admin/import';
import AdminResults from '@/components/competition/admin/results';
import PresetPicker from '@/components/preset-picker';
import MdSpunnable from '@/components/md-spunnable';
import {
  idKey,
  db,
} from '@/helpers/firebase';
import {
  makeKeyValuePairColumn,
} from '@/helpers/handsontable';
import 'handsontable/dist/handsontable.full.css';

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
    draws: Object,
    schedule: Object,
    results: Object,
  },
  data() {
    return {
      idKey,

      showImport: false,
      confirmRemove: false,

      saving: false,
      savingPromises: [],
    };
  },
  firebase() {
    return {
      sectionsRaw: db.child('sections'),
    };
  },
  computed: {
    ...mapState([
      'me',
    ]),

    currentTab() {
      return this.$route.params.tab || this.$route.name.split('.')[2] || 'info';
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
              colHeaders: true,
              rowHeaders: true,
              stretchH: 'all',
              minSpareRows: 1,
              contextMenu: [
                'remove_row',
              ],

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
                    this.save(path, newVal);
                  });
                }
              },
              beforeRemoveRow: (index, amount) => {
                for (let i = 0; i < amount; i += 1) {
                  const path = `${section[idKey]}/${data[index + i][idKey]}`;
                  this.save(path, null);
                }
              },
            };
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
  },
  methods: {
    goToTab(tab) {
      switch (tab) {
        case 'schedule':
        case 'results':
        case 'dance-groups': {
          this.$router.push({
            name: `competition.admin.${tab}`,
          });
          break;
        }
        default: {
          this.$router.push({
            name: 'competition.admin.tab',
            params: {
              tab,
            },
          });
          break;
        }
      }
    },
    inTabs(...tabs) {
      return tabs.some(tab => (this.currentTab) === tab);
    },
    getSection(sectionId) {
      return this.sections.find(section => section[idKey] === sectionId);
    },

    awaitSave(...promises) {
      return new Promise((resolve, reject) => {
        this.savingPromises.push(...promises);

        if (this.saving) {
          clearTimeout(this.saving);
        }
        this.saving = setTimeout(() => {
          Promise.all(this.savingPromises)
            .then(() => {
              this.saving = false;
              resolve();
            })
            .catch((err) => {
              this.saving = false;
              reject(err);
            });
        }, 1000);
      });
    },
    async save(path, value) {
      const ref = /^info\//.test(path) ? this.competitionRef : this.competitionDataRef;
      await this.awaitSave(ref.update({
        [path.replace(/^info\//, '')]: value || null,
      }));
    },
    async remove() {
      await this.awaitSave(
        this.competitionRef.remove(),
        this.competitionDataRef.remove(),
      );
      this.$router.replace('/');
    },

    addPresets(presets, tab = this.currentTab) {
      // append
      return Promise.all(presets.map((preset) => {
        return this.save(`${tab}/${db.push().key}`, preset);
      }));
    },

    handleFormInputChange(section, field, value) {
      return this.save(`${section}/${field}`, value);
    },
    handleChanges(changes) {
      return Object.entries(changes).map(([path, value]) => {
        return this.save(path, value);
      });
    },
  },
  components: {
    HotTable,
    AdminImport,
    AdminResults,
    PresetPicker,
    MdSpunnable,
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
    flex: auto;

    .admin-blade {
      &:not(:last-child) {
        border-right: solid 6px #ccc;
      }
    }
  }
}

.import-dialog {
    &,
   .md-dialog-container {
     width: 100%;
     height: 100%;
   }
}
</style>
