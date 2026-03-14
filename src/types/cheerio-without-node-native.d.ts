// src/types/cheerio-without-node-native.d.ts
declare module "cheerio-without-node-native" {
  export type CheerioLoadOptions = {
    xmlMode?: boolean;
    decodeEntities?: boolean;
    lowerCaseTags?: boolean;
    recognizeSelfClosing?: boolean;
  };

  export const load: (html: string, options?: CheerioLoadOptions) => any;
}
