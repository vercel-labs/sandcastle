/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "use-descendants" {
  export function createDescendants<T = any>(): any;
  export function useDescendants<T = any, O = any>(...args: any[]): any;
  export interface ItemOptions<T = any, O = any> {
    disabled?: boolean;
    [key: string]: any;
  }
  export const DescendantContext: any;
  export function useDescendant<T = any>(...args: any[]): any;
  export function DescendantProvider(props: any): any;
  export function useIsomorphicLayoutEffect(...args: any[]): any;
}
