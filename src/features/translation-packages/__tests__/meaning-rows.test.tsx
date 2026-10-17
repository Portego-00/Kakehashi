import React from 'react';
import {render,fireEvent} from '@testing-library/react-native';
import {MeaningRows} from '../MeaningRows';
jest.mock('../../../utils/theme',()=>({useTheme:()=>({theme:{textColor:'#111',textSecondary:'#777',primary:'#08f'}})}));
it('shows translations first and originals inline on the same value nodes',()=>{
 const s=render(<MeaningRows language="tr" primary="destek" alternatives={['dal']} english="Support" englishAlternatives={['Branch']} />);
 expect(s.getByText('Destek')).toBeTruthy();expect(s.getByText('Dal')).toBeTruthy();
 expect(s.queryByText(/Support/)).toBeNull();expect(s.queryByText(/English:/)).toBeNull();
 fireEvent.press(s.getByText('Show original English'));
 expect(s.getByText('Destek · Support')).toBeTruthy();expect(s.getByText('Dal · Branch')).toBeTruthy();
 fireEvent.press(s.getByText('Hide original English'));expect(s.queryByText(/Support/)).toBeNull();
});
it('omits empty alternative rows but exposes original-only alternatives on request',()=>{
 const s=render(<MeaningRows language="tr" primary="kişi" alternatives={[]} english="Someone" englishAlternatives={['Person']} />);
 expect(s.queryByText('Alternative')).toBeNull();fireEvent.press(s.getByText('Show original English'));
 expect(s.getByText('Alternative')).toBeTruthy();expect(s.getByText('Person')).toBeTruthy();
});
