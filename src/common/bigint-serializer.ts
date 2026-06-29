declare global {
  interface BigInt {
    toJSON(): string;
  }
}

// Allow JSON.stringify to serialize BigInt as string across the app.
BigInt.prototype.toJSON = function (this: bigint): string {
  return this.toString();
};

export {};
