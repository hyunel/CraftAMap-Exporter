export let AMap: AMap;
import AMapJS from './amap.js?url'

export function loadAmap(JSAPIKey: string): Promise<AMap> {
    globalThis.AMapKey = JSAPIKey;
    return new Promise((resolve, reject)=>{
        globalThis.___onAPILoaded = (err: Error, amap: any)=> {
            delete globalThis.___onAPILoaded;
            if(err) {
                reject(err);
            } else {
                AMap = amap;
                resolve(amap);
            }
        };
        import(AMapJS);
    });
}