Pod::Spec.new do |s|
 s.name='MenuOcr'
 s.version='0.1.0'
 s.summary='On-device menu recognition for Mogeum'
 s.description='Korean and English menu text and normalized coordinates'
 s.license='MIT'
 s.author='Mogeum'
 s.homepage='https://github.com/shinhanseo/mogeum'
 s.platforms={:ios=>'16.4'}
 s.swift_version='5.9'
 s.source={:git=>'https://github.com/shinhanseo/mogeum.git'}
 s.static_framework=true
 s.dependency 'ExpoModulesCore'
 s.source_files='**/*.{h,m,swift}'
 s.frameworks='Vision','UIKit'
 s.pod_target_xcconfig={'DEFINES_MODULE'=>'YES'}
end
