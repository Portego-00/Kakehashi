import React, {useState} from 'react';
import {Text,TouchableOpacity,View, type StyleProp,type TextStyle,type ViewStyle} from 'react-native';
import {useTheme} from '../../utils/theme';
import {formatDisplayMeaning} from './format';
import {useActiveContent} from './package-store';
export function MeaningRows({primary,alternatives,english,englishAlternatives,rowStyle,labelStyle,valueStyle,language}: {
 primary:string;alternatives:string[];english:string;englishAlternatives:string[];
 rowStyle?:StyleProp<ViewStyle>;labelStyle?:StyleProp<TextStyle>;valueStyle?:StyleProp<TextStyle>;
 language?:string;
}){
 const packet=useActiveContent(); const formatMeaning=(value:string)=>formatDisplayMeaning(value,language??packet?.language??"en");
 const {theme}=useTheme();const [showOriginal,setShowOriginal]=useState(false);
 const row=[{flexDirection:'row' as const,alignItems:'flex-start' as const,marginBottom:8},rowStyle];
 const label=[{width:100,color:theme.textSecondary,fontSize:14},labelStyle];
 const value=[{flex:1,minWidth:0,color:theme.textColor,fontSize:16,fontWeight:'500' as const},valueStyle];
 const translatedAlternatives=alternatives.map(formatMeaning).join(', ');
 return <View>
  <View style={row}><Text style={label}>Primary</Text><Text selectable style={value}>
   {formatMeaning(primary)}{showOriginal&&english&&<Text style={{color:theme.textSecondary,fontWeight:'normal'}}> · {english}</Text>}
  </Text></View>
  {(translatedAlternatives||showOriginal&&englishAlternatives.length>0)&&<View style={row}>
   <Text style={label}>Alternative</Text><Text selectable style={value}>
    {translatedAlternatives}{showOriginal&&englishAlternatives.length>0&&<Text style={{color:theme.textSecondary,fontWeight:'normal'}}>{translatedAlternatives?' · ':''}{englishAlternatives.join(', ')}</Text>}
   </Text></View>}
  <TouchableOpacity onPress={()=>setShowOriginal(value=>!value)} accessibilityRole="button" accessibilityLabel={showOriginal?"Hide original English meanings":"Show original English meanings"} accessibilityState={{expanded:showOriginal}} style={{alignSelf:'flex-start',paddingVertical:8,marginBottom:4}}>
   <Text style={{color:theme.primary||'#3a86ff'}}>{showOriginal?'Hide original English':'Show original English'}</Text>
  </TouchableOpacity>
 </View>;
}
