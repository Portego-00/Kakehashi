import React from "react";
import {render, fireEvent} from "@testing-library/react-native";
import ReviewResultsScreen from "../ReviewResultsScreen";
import {parseTranslationPackage} from "../../features/translation-packages/resolver";
import data from "../../../translation-packages/example-tr-v3.json";
const mockPacket = parseTranslationPackage(data)!;
let mockEnabled = true;
jest.mock("../../features/translation-packages/display", () => {
 const original = jest.requireActual("../../features/translation-packages/display");
 return {...original, useLearningDisplay: () => original.learningDisplay(mockPacket, mockEnabled)};
});
jest.mock("../../utils/theme",()=>({useTheme:()=>({theme:{textColor:"#111",textSecondary:"#555",primary:"#08f",border:"#ddd",cardBackground:"#fff",backgroundColor:"#fff"}})}));
jest.mock("../../utils/radicalSvg",()=>({pickBestImage:()=>null,useRemoteSvg:()=>null}));
jest.mock("@expo/vector-icons",()=>({Ionicons:()=>null}));
jest.mock("react-native-svg",()=>({SvgXml:()=>null}));
jest.mock("react-native-safe-area-context",()=>({SafeAreaView:require("react-native").View,useSafeAreaInsets:()=>({top:0,bottom:0})}));
jest.mock("expo-router",()=>({router:{push:jest.fn()}}));
jest.mock("../AddToSubjectListsModal",()=>()=>null);
const [id, entry] = Object.entries(mockPacket.subjects).find(([,value])=>value.source.type === "kanji" && value.meaning.primary !== value.source.meaningsEn[0])!;
const subject={id:Number(id),object:entry.source.type,data:{characters:entry.source.word,meanings:entry.source.meaningsEn.map((meaning,i)=>({meaning,primary:i===0})),readings:entry.source.readingsJa.map(reading=>({reading,primary:true}))}};
const props:any={reviewItems:[{id:1,subjectId:Number(id),subject,meaningDone:true,readingDone:true,meaningIncorrect:1,readingIncorrect:0,meaningCorrectlyAnswered:true,readingCorrectlyAnswered:true}],progress:{total:1,completed:1,meaningCorrect:0,readingCorrect:1,meaningAttempts:1,readingAttempts:1},submittingResults:false,onBackToDashboard:jest.fn()};
beforeEach(()=>{mockEnabled=true;});
it("renders translated result cards and updates to English when disabled",()=>{
 const screen=render(<ReviewResultsScreen {...props}/>);
 expect(screen.getByText(entry.meaning.primary.charAt(0).toLocaleUpperCase("tr-TR")+entry.meaning.primary.slice(1))).toBeTruthy();
 mockEnabled=false;screen.rerender(<ReviewResultsScreen {...props}/>);
 expect(screen.getByText(entry.source.meaningsEn[0])).toBeTruthy();
});
it("falls back to English if the result source changed",()=>{
 const altered={...subject,data:{...subject.data,readings:[{reading:"changed"}]}};
 const screen=render(<ReviewResultsScreen {...props} reviewItems={[{...props.reviewItems[0],subject:altered}]}/>);
 expect(screen.getByText(entry.source.meaningsEn[0])).toBeTruthy();
});
