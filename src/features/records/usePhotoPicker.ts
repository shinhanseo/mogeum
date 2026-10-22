import { useEffect, useRef, useState } from 'react';
import { Keyboard, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { PhotoAccess } from './PhotoAccessSheet';
/** Shared branded pre-permission guidance. Does not request broad photo-library access. */
export function usePhotoPicker(onPick:(asset:ImagePicker.ImagePickerAsset)=>void){
 const [access,setAccess]=useState<PhotoAccess|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const active=useRef(true);const lock=useRef(false);const afterDismiss=useRef<(()=>void)|null>(null);const picked=useRef(onPick);
 useEffect(()=>{picked.current=onPick;},[onPick]);
 useEffect(()=>{active.current=true;return()=>{active.current=false;afterDismiss.current=null;};},[]);
 async function launch(camera:boolean){if(lock.current||!active.current)return;lock.current=true;setBusy(true);setError('');try{
  if(camera){const permission=await ImagePicker.requestCameraPermissionsAsync();if(!active.current)return;if(!permission.granted){setAccess({kind:'camera',blocked:!permission.canAskAgain});return;}}
  const options={mediaTypes:['images'] as ImagePicker.MediaType[],allowsEditing:false,quality:0.85};
  const result=camera?await ImagePicker.launchCameraAsync(options):await ImagePicker.launchImageLibraryAsync(options);
  if(active.current&&!result.canceled&&result.assets[0])picked.current(result.assets[0]);
 }catch{if(active.current)setError('사진을 열지 못했어요. 다시 시도해주세요.');}finally{lock.current=false;if(active.current)setBusy(false);}}
 async function open(camera=false){if(lock.current)return;Keyboard.dismiss();setError('');try{
  if(camera){const p=await ImagePicker.getCameraPermissionsAsync();if(!active.current)return;if(p.granted){await launch(true);return;}setAccess({kind:'camera',blocked:!p.canAskAgain});}else setAccess({kind:'library',blocked:false});
 }catch{if(active.current)setError('사진 접근 상태를 확인하지 못했어요. 다시 시도해주세요.');}}
 function proceed(){const current=access;if(!current||lock.current)return;const action=()=>{if(!active.current)return;if(current.blocked)void Linking.openSettings().catch(()=>{if(active.current)setError('설정을 열지 못했어요. 기기 설정에서 접근을 허용해주세요.');});else void launch(current.kind==='camera');};
  if(Platform.OS==='ios')afterDismiss.current=action;setAccess(null);if(Platform.OS!=='ios')action();
 }
 return {open,busy,error,access,close:()=>{if(!lock.current)setAccess(null);},proceed,onDismiss:()=>{const action=afterDismiss.current;afterDismiss.current=null;action?.();}};
}
