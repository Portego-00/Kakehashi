import {useLearningContentStore} from "../store";
import {packageManager} from "../package-store";
import {parseTranslationPackage} from "../resolver";
import packet from "../../../../translation-packages/example-tr-v3.json";
import React from "react";
import {Alert} from "react-native";
import {act, fireEvent, render, waitFor} from "@testing-library/react-native";
import TurkishSynonyms from "../../../../app/(app)/turkish-synonyms";
import {prepareSynonymPreview, transferJournal, transferRunner} from "../synonym-transfer-api";
jest.setTimeout(15000);
const mockAuth = {apiToken: "fixture-token", userData: {id: "account-A", username: "fixture-user", level: 8}};
jest.mock("../../../utils/store",()=>({useAuthStore:Object.assign((selector:any)=>selector(mockAuth),{getState:()=>mockAuth})}));
jest.mock("../../../utils/theme",()=>({useTheme:()=>({theme:{textColor:"#111",textSecondary:"#777",primary:"#08f",border:"#ddd",cardBackground:"#fff",backgroundColor:"#fff"}})}));
jest.mock("@expo/vector-icons",()=>({Ionicons:()=>null}));
jest.mock("expo-router",()=>({router:{back:jest.fn()}, Stack:{Screen:()=>null}}));
jest.mock("react-native-safe-area-context",()=>({useSafeAreaInsets:()=>({top:0,bottom:0})}));
jest.mock("../synonym-transfer-api",()=>({prepareSynonymPreview:jest.fn(),synonymTransport:jest.fn(()=>({})),transferJournal:{load:jest.fn(),create:jest.fn()},transferRunner:{run:jest.fn(),pause:jest.fn(),isRunning:()=>false}}));
const row = () => ({id:80,word:"Ghost",level:8,type:"radical",studyState:"learning",candidates:["Hayalet","Ruh","Heyula"],existing:["hayalet"],selected:["Ruh","Heyula"],status:"pending",added:[],uncertain:[]});
beforeEach(()=>{
 useLearningContentStore.setState({enabled:true});packageManager.state.setState({packet:parseTranslationPackage(packet),hydrated:true});
 jest.clearAllMocks();mockAuth.apiToken="fixture-token";mockAuth.userData.id="account-A";
 jest.mocked(transferJournal.load).mockResolvedValue([]);jest.mocked(prepareSynonymPreview).mockResolvedValue([row()] as any);jest.mocked(transferRunner.run).mockResolvedValue(undefined);
 jest.spyOn(Alert,"alert").mockImplementation(()=>{});
});
it("opening and preparing a filtered preview never starts account writes",async()=>{
 const s=render(<TurkishSynonyms/>);await waitFor(()=>expect(transferJournal.load).toHaveBeenCalled());
 fireEvent.press(s.getByLabelText("7"));fireEvent.press(s.getByText("Burned"));fireEvent.press(s.getByText("Prepare preview"));
 await waitFor(()=>expect(s.getByText("1 selected topics · 2 new synonyms")).toBeTruthy());
 expect(prepareSynonymPreview).toHaveBeenCalledWith("fixture-token",expect.objectContaining({levels:[8,7],states:["learning","burned"]}));
 expect(transferRunner.run).not.toHaveBeenCalled();expect(transferJournal.create).not.toHaveBeenCalled();
});
it("allows excluding each meaning and keeps existing case-equivalent synonyms disabled",async()=>{
 const s=render(<TurkishSynonyms/>);fireEvent.press(s.getByText("Prepare preview"));await waitFor(()=>expect(s.getByText("Ruh")).toBeTruthy());
 expect(s.getByLabelText("Hayalet · Existing").props.accessibilityState.disabled).toBe(true);
 fireEvent.press(s.getByText("Ruh"));expect(s.getByText("1 selected topics · 1 new synonyms")).toBeTruthy();
 fireEvent.press(s.getByLabelText("Include this topic"));expect(s.getByText("0 selected topics · 0 new synonyms")).toBeTruthy();
 expect(transferRunner.run).not.toHaveBeenCalled();
});
it("runs only after concrete final confirmation and freezes selected meanings",async()=>{
 const s=render(<TurkishSynonyms/>);fireEvent.press(s.getByText("Prepare preview"));await waitFor(()=>expect(s.getByText("Ruh")).toBeTruthy());
 fireEvent.press(s.getByText("Ruh"));fireEvent.press(s.getByText("Add selected synonyms…"));
 expect(transferRunner.run).not.toHaveBeenCalled();const last=jest.mocked(Alert.alert).mock.calls.at(-1)!;
 expect(last[1]).toContain("1 topics · up to 1 new synonyms");
 await act(async()=>{last[2]![1].onPress!();});
 expect(transferRunner.run).toHaveBeenCalledTimes(1);expect(jest.mocked(transferRunner.run).mock.calls[0][0].rows[0].selected).toEqual(["Heyula"]);
});
it("history loading does not resume and undo requires confirmation",async()=>{
 jest.mocked(transferJournal.load).mockResolvedValue([{id:"job",account:"account-A",createdAt:"2026-10-11",filters:{levels:[8],types:["radical"],states:["learning"]},rows:[{...row(),status:"done",added:["Ruh"]}],operation:"add"}] as any);
 const s=render(<TurkishSynonyms/>);await waitFor(()=>expect(s.getByText(/1 topics · 1 processed/)).toBeTruthy());
 expect(transferRunner.run).not.toHaveBeenCalled();fireEvent.press(s.getByText(/1 topics · 1 processed/));fireEvent.press(s.getByText("Undo / cancel this transfer"));
 expect(Alert.alert).toHaveBeenCalledWith("Undo this transfer?",expect.stringContaining("Remove up to 1"),expect.any(Array));expect(transferRunner.run).not.toHaveBeenCalled();
});
it("cannot start a confirmed old-account preview after switching accounts",async()=>{
 const s=render(<TurkishSynonyms/>);fireEvent.press(s.getByText("Prepare preview"));await waitFor(()=>expect(s.getByText("Ruh")).toBeTruthy());
 fireEvent.press(s.getByText("Add selected synonyms…"));const callback=jest.mocked(Alert.alert).mock.calls.at(-1)![2]![1].onPress!;
 mockAuth.userData.id="account-B";await act(async()=>{callback();});expect(transferRunner.run).not.toHaveBeenCalled();
});

it("hides fully existing topics without dropping unselected new suggestions", async () => {
 jest.mocked(prepareSynonymPreview).mockResolvedValue([{...row(),id:81,word:"Already saved",candidates:["Hayalet"],selected:[]},row()] as any);
 const s=render(<TurkishSynonyms/>);fireEvent.press(s.getByText("Prepare preview"));await waitFor(()=>expect(s.getByText("Ruh")).toBeTruthy());
 expect(s.queryByText(/Already saved/)).toBeNull();
 fireEvent.press(s.getByLabelText("Include this topic"));expect(s.getByText("Ruh")).toBeTruthy();
 fireEvent.press(s.getByText("Show topics with no new synonyms"));expect(s.getByText(/Already saved/)).toBeTruthy();
 expect(transferRunner.run).not.toHaveBeenCalled();
});
it("shows reached levels only and paginates without changing selection", async () => {
 jest.mocked(prepareSynonymPreview).mockResolvedValue(Array.from({length:35},(_,i)=>({...row(),id:100+i,word:`Topic${i}`})) as any);
 const s=render(<TurkishSynonyms/>);expect(s.queryByLabelText("9")).toBeNull();
 fireEvent.press(s.getByText("Prepare preview"));await waitFor(()=>expect(s.getByText(/Page 1 of 2/)).toBeTruthy());
 expect(s.queryByText(/Topic34/)).toBeNull();fireEvent.press(s.getByText("Next page"));
 expect(s.getByText(/Topic34/)).toBeTruthy();expect(s.getByText("35 selected topics · 70 new synonyms")).toBeTruthy();
 expect(transferRunner.run).not.toHaveBeenCalled();
});

it("does not offer preparation when the feature is disabled", async () => {
 useLearningContentStore.setState({enabled:false});
 const s = render(<TurkishSynonyms/>);
 fireEvent.press(s.getByText("Prepare preview"));
 expect(prepareSynonymPreview).not.toHaveBeenCalled();
 expect(transferRunner.run).not.toHaveBeenCalled();
});

it("does not run additions if the user disables the feature before confirming", async () => {
 const s=render(<TurkishSynonyms/>);
 fireEvent.press(s.getByText("Prepare preview"));
 await waitFor(()=>expect(s.getByText("Ruh")).toBeTruthy());
 fireEvent.press(s.getByText("Add selected synonyms…"));
 const callback=jest.mocked(Alert.alert).mock.calls.at(-1)![2]![1].onPress!;
 await act(async()=>{useLearningContentStore.setState({enabled:false}); callback();});
 expect(transferRunner.run).not.toHaveBeenCalled();
});
