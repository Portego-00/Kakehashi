import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import {act,render,fireEvent} from '@testing-library/react-native';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import RadicalDetails from '../RadicalDetails';
import {parsePackageText} from '../../features/translation-packages/resolver';
import {packageManager} from '../../features/translation-packages/package-store';
import {useLearningContentStore} from '../../features/translation-packages/store';
import {formatTurkishMeaning} from '../../features/translation-packages/format';
jest.mock('@expo/vector-icons',()=>({Ionicons:()=>null}));
let mockHeaderInsets = { top: 0, left: 0, right: 0, bottom: 0 };
jest.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>mockHeaderInsets}));
jest.mock('expo-router/react-navigation',()=>({useNavigation:()=>({goBack:jest.fn()})}));
jest.mock('react-native-reanimated',()=>{
 const React=jest.requireActual('react');const {View,ScrollView}=jest.requireActual('react-native');
 const chain:any={};for(const k of ['duration','delay','easing'])chain[k]=()=>chain;
 return {__esModule:true,default:{View,ScrollView},Easing:{ease:0},enableLayoutAnimations:()=>{},FadeInDown:chain,FadeOutUp:chain,LinearTransition:chain,Extrapolation:{CLAMP:0},useAnimatedRef:()=>React.useRef(null),useSharedValue:(value:any)=>({value}),useAnimatedStyle:()=>({}),useAnimatedScrollHandler:()=>()=>{}};
});
jest.mock('../../utils/store',()=>({useSettingsStore:()=>({showMnemonicIllustrations:false})}));
jest.mock('../../utils/theme',()=>({useTheme:()=>({theme:{textColor:'#111',textSecondary:'#555',backgroundColor:'#fff',cardBackground:'#fff'}})}));
jest.mock('../../utils/subjectColors',()=>({useSubjectColors:()=>({radical:'#08f',kanji:'#f08',vocabulary:'#80f'}),getReadableTextColor:()=> '#fff'}));
jest.mock('../../utils/radicalSvg',()=>({pickBestImage:()=>null,useRemoteSvg:()=>null}));
jest.mock('../../utils/mnemonicImage',()=>({inlineSvgClassStyles:(s:any)=>s}));
jest.mock('../../features/subject-history/SubjectHistory',()=>({SubjectHistoryButton:()=>null}));
jest.mock('../CopyTooltip',()=>({CopyTooltip:()=>null,useCopyTooltip:()=>({containerRef:{current:null},copyText:jest.fn()})}));
jest.mock('../formatted-note',()=>({FormattedNoteText:()=>null}));
jest.mock('../note-field-container',()=>({NoteFieldContainer:({children}:any)=>children}));
jest.mock('../SrsLevelIcon',()=>()=>null);
jest.mock('../SynonymsModal',()=>({SynonymsModal:()=>null}));
const packet=parsePackageText(readFileSync(resolve(process.cwd(),'translation-packages/example-tr-v3.json'),'utf8'));
const r=packet.subjects['80'];const [kid,k]=Object.entries(packet.subjects).find(([_,v])=>v.source.type==='kanji')!;
const related={id:Number(kid),characters:k.source.word!,meanings:k.source.meaningsEn,readings:k.source.readingsJa.map(reading=>({reading})),level:k.source.level};
const radical={id:80,object:'radical',level:r.source.level,characters:r.source.word,meanings:r.source.meaningsEn.map((meaning,i)=>({meaning,primary:i===0})),mnemonic:'',imageUrl:null,amalgamationSubjects:[related]};
beforeEach(async()=>{await packageManager.hydrate();packageManager.state.setState({packet,hydrated:true});useLearningContentStore.setState({enabled:true});});
it('renders imported radical and associated kanji translations',()=>{
 const screen=render(<RadicalDetails radical={radical} progressionStatus="success" />);
 expect(screen.getAllByText('Hayalet').length).toBeGreaterThan(0);
 expect(screen.queryByText('English: '+r.source.meaningsEn[0])).toBeNull();
 fireEvent.press(screen.getByText('Show original English'));
 expect(screen.getByText('Hayalet · '+r.source.meaningsEn[0])).toBeTruthy();
 expect(screen.getByText(formatTurkishMeaning(k.meaning.primary))).toBeTruthy();
});
it('reacts to language toggle and package removal without changing source data',async()=>{
 const before=JSON.stringify(radical);const screen=render(<RadicalDetails radical={radical} progressionStatus="success" embedded />);
 await act(async()=>{useLearningContentStore.setState({enabled:false});});expect(screen.queryByText('Hayalet')).toBeNull();expect(screen.getByText(r.source.meaningsEn[0])).toBeTruthy();
 await act(async()=>{useLearningContentStore.setState({enabled:true});});expect(screen.getByText('Hayalet')).toBeTruthy();
 await act(async()=>{packageManager.state.setState({packet:null});});expect(screen.queryByText('Hayalet')).toBeNull();expect(JSON.stringify(radical)).toBe(before);
});
it('falls back to English for changed related kanji readings',()=>{
 const changed={...radical,amalgamationSubjects:[{...related,readings:[{reading:'changed'}]}]};
 const screen=render(<RadicalDetails radical={changed} progressionStatus="success" embedded />);
 expect(screen.getByText(related.meanings[0])).toBeTruthy();
});


it("keeps header actions inside changing top and horizontal safe areas", async () => {
  const onAddToList = jest.fn();
  const onOpenConstellation = jest.fn();
  mockHeaderInsets = { top: 0, left: 0, right: 72, bottom: 0 };
  const details = () => <RadicalDetails radical={radical} progressionStatus="success" onAddToList={onAddToList} onOpenConstellation={onOpenConstellation} />;
  const screen = render(details());
  for (const [top, left, right, contentTop] of [[0, 0, 72, 64], [96, 0, 0, 112], [0, 64, 0, 64], [44, 0, 0, 64]]) {
    mockHeaderInsets = { ...mockHeaderInsets, top, left, right };
    screen.rerender(details());
    const save = screen.getByRole("button", { name: "Add to saved lists" });
    let actions = save.parent;
    while (actions && StyleSheet.flatten(actions.props.style)?.position !== "absolute") actions = actions.parent;
    expect(StyleSheet.flatten(actions?.props.style)).toMatchObject({ right: 16 + right, top: contentTop });
    let header = actions?.parent;
    while (header && typeof StyleSheet.flatten(header.props.style)?.paddingTop !== "number") header = header.parent;
    expect(StyleSheet.flatten(header?.props.style)).toMatchObject({ paddingLeft: 16 + left, paddingRight: 16 + right, paddingTop: contentTop });
    const buttons = screen.UNSAFE_getAllByType(TouchableOpacity);
    const constellation = buttons.find(button => button.props.onPress === onOpenConstellation)!;
    expect(StyleSheet.flatten(constellation.props.style).right).toBe(20 + right);
    const back = buttons.find(button => StyleSheet.flatten(button.props.style)?.left === 20 + left);
    expect(StyleSheet.flatten(back?.props.style)).toMatchObject({ left: 20 + left, top: contentTop });
  }
  await act(async () => {});
  mockHeaderInsets = { top: 0, left: 0, right: 0, bottom: 0 };
});
