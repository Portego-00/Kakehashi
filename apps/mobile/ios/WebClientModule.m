//
//  WebClientModule.m
//  wanikani
//
//  Created by Pedro Ortego on 7/25/25.
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WebClientModule, NSObject)
RCT_EXTERN_METHOD(login:(NSString *)email
                  password:(NSString *)password
                  resolver:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)rejecter)
@end
