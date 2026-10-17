import {renderHook} from '@testing-library/react-native';
import {useLearningDisplay} from '../display';
import {packageManager} from '../package-store';
import {useLearningContentStore} from '../store';
import {parseTranslationPackage} from '../resolver';
import packet from '../../../../translation-packages/example-tr-v3.json';

it('requires explicit opt-in for new settings and saved records without an enabled flag',()=>{
 expect(useLearningContentStore.getInitialState().enabled).toBe(false);
 const merge=useLearningContentStore.persist.getOptions().merge!;
 expect(merge({},useLearningContentStore.getInitialState()).enabled).toBe(false);
 expect(merge({enabled:false},useLearningContentStore.getInitialState()).enabled).toBe(false);
 expect(merge({enabled:true},useLearningContentStore.getInitialState()).enabled).toBe(true);
});
it('does not hydrate packages or alter first-meaning fallbacks for an opt-out user',()=>{
 useLearningContentStore.setState({enabled:false});
 packageManager.state.setState({packet:parseTranslationPackage(packet)});
 const hydrate=jest.spyOn(packageManager,'hydrate');
 const {result}=renderHook(()=>useLearningDisplay());
 const subject={id:440,object:'kanji',data:{characters:'池',meanings:[{meaning:'First meaning',primary:false},{meaning:'Different primary',primary:true}],readings:[]}};
 expect(result.current.meaning(subject,subject.data.meanings[0].meaning)).toBe('First meaning');
 expect(result.current.resolveMeaning(subject)).toBeNull();
 expect(result.current.sentence(subject,{ja:'example',en:'English sentence'})).toBeNull();
 expect(hydrate).not.toHaveBeenCalled();
 hydrate.mockRestore();
});
