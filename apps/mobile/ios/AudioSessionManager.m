//
//  AudioSessionManager.m
//  wanikani
//
//  Created by Pedro Ortego on 8/3/25.
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AudioSessionManager, NSObject)

RCT_EXTERN_METHOD(overrideSpeaker:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

@end