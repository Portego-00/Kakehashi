//
//  WaniKaniWebClientBridge.m
//  wanikani
//
//  Created by Claude on 7/26/25.
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WaniKaniWebClientBridge, NSObject)

RCT_EXTERN_METHOD(login:(NSString *)email
                  password:(NSString *)password
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end