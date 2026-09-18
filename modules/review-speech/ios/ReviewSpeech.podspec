Pod::Spec.new do |s|
  s.name = 'ReviewSpeech'
  s.version = '1.0.0'
  s.summary = 'On-device speech recognition for Kakehashi reviews'
  s.description = 'An availability-gated iOS 26 SpeechTranscriber bridge.'
  s.license = { :type => 'Proprietary' }
  s.author = 'Kakehashi'
  s.homepage = 'https://kakehashiapp.com'
  s.platforms = { :ios => '15.1' }
  s.source = { :git => '' }
  s.static_framework = true
  s.swift_version = '5.9'
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Speech', 'AVFoundation'
  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
