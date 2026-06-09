//
//  KeyboardManager.m
//  wanikani
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(KeyboardManager, NSObject)

RCT_EXTERN_METHOD(hasJapaneseKeyboard:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setUseJapaneseKeyboard:(BOOL)enabled
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

@end
