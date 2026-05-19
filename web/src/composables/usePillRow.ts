import { inject, provide, type InjectionKey, type Ref } from 'vue'

const PillRowKey: InjectionKey<Ref<HTMLElement | null>> = Symbol('PillRow')

export function providePillRow(rowRef: Ref<HTMLElement | null>) {
  provide(PillRowKey, rowRef)
}

export function injectPillRow(): Ref<HTMLElement | null> | undefined {
  return inject(PillRowKey)
}
