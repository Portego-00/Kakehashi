Pod::Spec.new do |s|
  s.name = 'NotebookHandwriting'
  s.version = '1.0.0'
  s.summary = 'PencilKit handwriting for Kakehashi notebooks'
  s.description = 'An iPad paper canvas with editable PencilKit ink and portable PNG previews.'
  s.license = { :type => 'Proprietary' }
  s.author = 'Kakehashi'
  s.homepage = 'https://kakehashiapp.com'
  s.platforms = { :ios => '15.1' }
  s.source = { :git => '' }
  s.static_framework = true
  s.swift_version = '5.9'
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'PencilKit', 'UIKit'
  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
