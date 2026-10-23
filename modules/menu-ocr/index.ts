import { requireOptionalNativeModule } from 'expo';
export type OcrPoint={x:number;y:number};
export type NativeLine={text:string;confidence:number|null;polygon:OcrPoint[]};
type Result={width:number;height:number;engine:string;lines:NativeLine[]};
const native=requireOptionalNativeModule<{recognize:(uri:string)=>Promise<Result>}>('MenuOcr');
export async function recognizeMenu(uri:string):Promise<Result>{
 if(!native)throw new Error('OCR_NATIVE_UNAVAILABLE');
 return native.recognize(uri);
}
