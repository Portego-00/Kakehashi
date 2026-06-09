//
//  WaniKaniBackgroundFetch.m
//  wanikani
//
//  Created by Pedro Ortego on 8/8/25.
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WaniKaniBackgroundFetch, NSObject)

RCT_EXTERN_METHOD(storeApiToken:(NSString *)apiToken)

RCT_EXTERN_METHOD(updateNotificationSettings:(NSDictionary *)settings)

RCT_EXTERN_METHOD(getBackgroundFetchStatus)

RCT_EXTERN_METHOD(triggerBackgroundFetchManually:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end