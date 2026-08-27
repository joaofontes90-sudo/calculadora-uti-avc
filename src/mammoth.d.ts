declare module 'mammoth' {
  export interface MammothResult {
    value: string;
    messages: any[];
  }

  export function extractRawText(input: { arrayBuffer?: ArrayBuffer; buffer?: Buffer; path?: string }): Promise<MammothResult>;
  export function convertToHtml(input: { arrayBuffer?: ArrayBuffer; buffer?: Buffer; path?: string }): Promise<MammothResult>;
}
