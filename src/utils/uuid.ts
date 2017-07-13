// tslint:disable no-bitwise

const newDate: () => number =
  window.performance !== undefined && typeof performance.now === 'function'
    ? () => performance.now()
    : () => Date.now();

export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    (c: string) => {
      let d = newDate();
      // tslint:disable-next-line insecure-random
      const r = ((d + Math.random() * 16) % 16) | 0;
      d = Math.floor(d / 16);

      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    }
  );
}
