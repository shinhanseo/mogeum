import { useState } from 'react';
import { Redirect } from 'expo-router';
import { Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { PhotoAccessSheet,type PhotoAccess } from '../../src/features/records/PhotoAccessSheet';
import { colors } from '../../src/theme/tokens';
export default function PhotoAccessPreview(){const [access,setAccess]=useState<PhotoAccess|null>(null);if(!__DEV__)return <Redirect href="/"/>;return <View style={{flex:1,justifyContent:'center',padding:24,gap:16,backgroundColor:colors.background}}><Text>개발 시안 · 실제 권한 요청 없음</Text><Button label="카메라 안내" onPress={()=>setAccess({kind:'camera',blocked:false})}/><Button label="앨범 안내" onPress={()=>setAccess({kind:'library',blocked:false})}/><Button label="권한 거부 상태" onPress={()=>setAccess({kind:'camera',blocked:true})}/><PhotoAccessSheet access={access} onClose={()=>setAccess(null)} onContinue={()=>setAccess(null)}/></View>;}
