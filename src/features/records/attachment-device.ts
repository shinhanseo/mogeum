import { decodePreparedAttachment } from './attachment-restore';
import { isPreparedRecordPhoto } from './draft-photo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { getSupabase } from '../../lib/supabase';
import { getBackendState } from '../../lib/env';
import { createRecordRepository } from './repository';
import { applyAttachment, submitAttachment, type PendingAttachment } from './attachment';
const key=(owner:string,id:string)=>`mogeum-attachment-v1-${owner}-${id}`;
export async function readAttachment(owner:string,id:string){const raw=await AsyncStorage.getItem(key(owner,id));if(raw===null)return null;if(raw.length>16000000)throw new Error('보관한 변경 요청을 읽지 못했어요.');return decodePreparedAttachment(raw,owner,id,FileSystem.documentDirectory,Platform.OS==='web');}
export async function finishAttachment(value:PendingAttachment){
 const current=await readAttachment(value.owner,value.recordId);if(current?.operationId!==value.operationId)return;
 await AsyncStorage.removeItem(key(value.owner,value.recordId));
 if(Platform.OS!=='web'&&isPreparedRecordPhoto(current.localPhoto,current.operationId,FileSystem.documentDirectory))await FileSystem.deleteAsync(current.localPhoto,{idempotent:true}).catch(()=>{});
}
export async function saveAttachment(value:PendingAttachment,owner:()=>string|null){
 value=decodePreparedAttachment(JSON.stringify(value),value.owner,value.recordId,FileSystem.documentDirectory,Platform.OS==='web');
 const client=getSupabase();const config=getBackendState();const session=client?(await client.auth.getSession()).data.session:null;
 if(!session||session.user.id!==value.owner||owner()!==value.owner||!config.configured)throw new Error('로그인 계정을 확인해주세요.');
 const scoped=createClient(config.config.url,config.config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:`Bearer ${session.access_token}`}}});
 const repo=createRecordRepository(scoped);
 return submitAttachment(value,{owner,read:()=>readAttachment(value.owner,value.recordId),write:v=>AsyncStorage.setItem(key(value.owner,value.recordId),JSON.stringify(v)),
 async upload(path,uri){const response=await fetch(uri);if(!response.ok)throw new Error('보관한 사진을 읽지 못했어요.');const bytes=await response.arrayBuffer();if(bytes.byteLength>10*1024*1024)throw new Error('사진은 10MB 이하로 남겨주세요.');try{await repo.uploadPhoto(path,bytes,'image/jpeg');}catch(e){if(Number((e as {statusCode?:string}).statusCode)!==409)throw e;}},
 apply:v=>applyAttachment(scoped,v)});
}
