// Type definitions for tweetnacl
declare module 'tweetnacl' {
  export interface KeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
  }

  export interface SignKeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
  }

  export namespace box {
    export const publicKeyLength: number;
    export const secretKeyLength: number;
    export const sharedKeyLength: number;
    export const nonceLength: number;
    export const overheadLength: number;

    export function keyPair(): KeyPair;
    export function keyPair_fromSecretKey(secretKey: Uint8Array): KeyPair;
    export function before(publicKey: Uint8Array, secretKey: Uint8Array): Uint8Array;
    export function after(message: Uint8Array, nonce: Uint8Array, sharedKey: Uint8Array): Uint8Array;
    export function open_after(box: Uint8Array, nonce: Uint8Array, sharedKey: Uint8Array): Uint8Array | null;
  }

  export function box(
    message: Uint8Array,
    nonce: Uint8Array,
    publicKey: Uint8Array,
    secretKey: Uint8Array
  ): Uint8Array;

  export namespace box {
    export function open(
      box: Uint8Array,
      nonce: Uint8Array,
      publicKey: Uint8Array,
      secretKey: Uint8Array
    ): Uint8Array | null;
  }

  export namespace sign {
    export const publicKeyLength: number;
    export const secretKeyLength: number;
    export const signatureLength: number;

    export function keyPair(): SignKeyPair;
    export function keyPair_fromSecretKey(secretKey: Uint8Array): SignKeyPair;
    export function detached(message: Uint8Array, secretKey: Uint8Array): Uint8Array;
  }

  export function sign(message: Uint8Array, secretKey: Uint8Array): Uint8Array;
  
  export namespace sign {
    export function open(signedMessage: Uint8Array, publicKey: Uint8Array): Uint8Array | null;
    
    export namespace detached {
      export function verify(
        message: Uint8Array,
        signature: Uint8Array,
        publicKey: Uint8Array
      ): boolean;
    }
  }

  export function randomBytes(length: number): Uint8Array;
  
  export namespace hash {
    export const hashLength: number;
  }
  
  export function hash(message: Uint8Array): Uint8Array;
  
  export function verify(x: Uint8Array, y: Uint8Array): boolean;
}

declare module 'tweetnacl-util' {
  export function decodeUTF8(s: string): Uint8Array;
  export function encodeUTF8(arr: Uint8Array): string;
  export function decodeBase64(s: string): Uint8Array;
  export function encodeBase64(arr: Uint8Array): string;
}