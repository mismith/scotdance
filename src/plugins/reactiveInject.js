import Vue from 'vue';

const { inject: mergeInject } = Vue.config.optionMergeStrategies;
const { defineReactive } = Vue.util;

/* eslint-disable no-underscore-dangle */
const VueReactiveInject = {
  install: (vm) => {
    vm.mixin({
      beforeCreate() {
        if (this.$options.reactiveInject) {
          this._reactiveInjectResult = {};

          Object.entries(this.$options.reactiveInject).forEach(([injectName, computedNames]) => {
            this.$options.inject = mergeInject(
              this.$options.inject,
              {
                [injectName]: {
                  from: injectName,
                },
              },
            );

            // plucked from Vue source code's (private) resolveInject() method
            // https://github.com/vuejs/vue/blob/e3d81c6f9add81188c47a7f35015ec6836c18f3e/src/core/instance/inject.js#L53-L59
            let source = this;
            while (source) {
              if (source._provided && hasOwnProperty.call(source._provided, injectName)) {
                this._reactiveInjectResult[injectName] = source._provided[injectName];
                break;
              }
              source = source.$parent;
            }

            computedNames.forEach((computedName) => {
              if (injectName in this._reactiveInjectResult && computedName in this._reactiveInjectResult[injectName]) {
                // make a 'computed'-like property
                Object.defineProperty(this, computedName, {
                  enumerable: true,
                  configurable: true,
                  get: () => this._reactiveInjectResult[injectName][computedName],
                });
                // then mark it as tracked within vue's reactivity system
                defineReactive(this, computedName);
              }
            });
          });
        }
      },
    });
  },
};
/* eslint-enable no-underscore-dangle */

export default VueReactiveInject;
