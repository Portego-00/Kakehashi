import sample from "../../../../translation-packages/example-tr-v3.json";
import {parseTranslationPackage,resolveSynonymAnswers} from "../resolver";
import {learningDisplay} from "../display";

it("displays another package language without Turkish casing or synonym transfer",()=>{
 const entry={...sample.subjects["440"],meaning:{primary:"un",alternatives:["une unité"],reviewStatus:"editorial-reviewed"}};
 const packet=parseTranslationPackage({...sample,language:"fr",subjects:{"440":entry}})!;
 expect(packet).not.toBeNull();
 const subject={id:440,object:entry.source.type,characters:entry.source.word,
   meanings:entry.source.meaningsEn.map(meaning=>({meaning})),readings:entry.source.readingsJa.map(reading=>({reading}))};
 expect(learningDisplay(packet,true).meaning(subject)).toBe("un");
 expect(learningDisplay(packet,true).formatMeaning("une unité")).toBe("une unité");
 expect(resolveSynonymAnswers(packet,subject)).toBeNull();
 expect(learningDisplay(packet,false).meaning(subject)).toBe(entry.source.meaningsEn[0]);
});
it.each(["tr","fr","pt-BR","zh-Hant"])("accepts package language %s",language=>{
 expect(parseTranslationPackage({...sample,language})).not.toBeNull();
});
it.each(["", "not a language", "../tr"])("rejects malformed language %s",language=>{
 expect(parseTranslationPackage({...sample,language})).toBeNull();
});
