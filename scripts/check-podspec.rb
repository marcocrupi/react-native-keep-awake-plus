# Run with CocoaPods' Ruby/gems and RN_PODS pointing to the consumer's
# react-native/scripts/react_native_pods.rb. No generated code is needed here.
require 'cocoapods'
require 'uri'
require 'tmpdir'
require ENV.fetch('RN_PODS')

root = File.realpath(File.expand_path(ARGV.fetch(0, '..'), __dir__))
package = JSON.parse(File.read(File.join(root, 'package.json')))
spec = Pod::Specification.from_file(File.join(root, 'react-native-keep-awake.podspec'))
reference = Pod::Specification.new do |s|
  s.name = 'Reference'
  s.version = spec.version
  s.platform = :ios, min_ios_version_supported
  s.requires_arc = true
  s.source_files = 'ios/ReactNativeKCKeepAwake.{h,mm}'
end
install_modules_dependencies(reference)
# Resolve only this pod's internal graph with CocoaPods/Molinillo. External RN
# dependencies are checked below against the real helper, not resolved or stubbed.
# CocoaPods retains responsibility for defaults, nested/sibling dependencies,
# version constraints and platform filtering; there is no custom graph traversal.
class DefaultPodResolver < Pod::Resolver
  def dependencies_for(specification)
    super.select { |dependency| dependency.root_name == specification.root.name }
  end
end

def effective_target(spec, root, scratch)
  podfile = Pod::Podfile.new do
    platform :ios, min_ios_version_supported
    target('Contract') { pod spec.name }
  end
  sandbox = Pod::Sandbox.new(scratch)
  resolver = DefaultPodResolver.new(sandbox, podfile, Molinillo::DependencyGraph.new, [], false)
  resolver.send(:cached_sets)[spec.name] = Pod::Specification::Set::External.new(spec)
  selected_specs = resolver.resolve.values.flatten.map(&:spec).uniq.sort_by(&:name)
  accessors = selected_specs.map { |s| Pod::Sandbox::FileAccessor.new(Pathname.new(root), s.consumer(:ios)) }
  target = Pod::PodTarget.new(sandbox, Pod::BuildType.static_library,
    {'Debug' => :debug}, ['arm64'], Pod::Platform.new(:ios, min_ios_version_supported),
    selected_specs, podfile.target_definitions.values.reject(&:abstract?), accessors)
  settings = Pod::Target::BuildSettings::PodTargetSettings.new(target, configuration: :debug)

  # Let the installer assign and combine flags on the actual Compile Sources
  # entries, including shared files. The project stays in memory and is not saved.
  project = Pod::Project.new(File.join(scratch, 'Contract.xcodeproj'))
  files = accessors.flat_map(&:source_files).uniq
  files.each { |file| project.add_file_reference(file, project.main_group) }
  native = project.new_target(:static_library, spec.name, :ios, min_ios_version_supported)
  installer = Pod::Installer::Xcode::PodsProjectGenerator::PodTargetInstaller.new(sandbox, project, target)
  installer.send(:add_files_to_build_phases, native, [], {})
  relative = ->(path) { Pathname.new(path).relative_path_from(Pathname.new(root)).to_s }
  {
    specs: selected_specs.map(&:name),
    dependencies: target.spec_consumers.flat_map(&:dependencies).reject { |d| d.root_name == spec.name }.to_set,
    xcconfig: settings.merged_pod_target_xcconfigs,
    flags: native.source_build_phase.files.map { |f| [relative.call(f.file_ref.real_path), (f.settings || {})['COMPILER_FLAGS']] }.sort,
    sources: files.map { |file| relative.call(file) }.sort
  }
end

actual, expected = Dir.mktmpdir('keep-awake-podspec-target-') do |scratch|
  [effective_target(spec, root, File.join(scratch, 'actual')),
   effective_target(reference, root, File.join(scratch, 'reference'))]
end

failures = []
check = lambda do |condition, message|
  failures << message unless condition
  puts "#{condition ? 'PASS' : 'FAIL'} #{message}"
end
source = spec.source
uri = URI.parse(source.fetch(:git))
check.call(uri.is_a?(URI::HTTPS) && uri.host == 'github.com' &&
  uri.path == '/marcocrupi/react-native-keep-awake-plus.git', 'CocoaPods HTTPS Git source')
check.call(spec.version.to_s == package.fetch('version') &&
  source.fetch(:tag) == "v#{package.fetch('version')}", 'version/tag identity')
check.call(spec.deployment_target(:ios) == min_ios_version_supported, 'React Native iOS minimum')
check.call(actual[:dependencies] == expected[:dependencies],
  'dependencies match the installed React Native helper')
expected_flags = expected[:flags].map(&:last).uniq
# CocoaPods repeats inherited flags when specs share a Compile Sources entry.
# Accept only repetitions of this single explicit, object-like RN definition.
# Every other option/definition keeps the exact comparison, including -U/order.
check.call(actual[:flags].all? { |_, flags|
  expected_flags.include?(flags) ||
    (expected_flags == ['-DRCT_NEW_ARCH_ENABLED=1'] &&
     /\A-DRCT_NEW_ARCH_ENABLED=1(?: -DRCT_NEW_ARCH_ENABLED=1)+\z/.match?(flags.to_s))
},
  'compiler_flags match the installed React Native helper')
check.call(actual[:xcconfig] == expected[:xcconfig],
  'pod_target_xcconfig match the installed React Native helper')
selected = actual[:sources]
check.call(selected == %w[ios/ReactNativeKCKeepAwake.h ios/ReactNativeKCKeepAwake.mm],
  'production sources exclude tests and generated code')
puts "Selected: #{selected.join(', ')}"
# Keep native values in comparisons; stringify dependencies only for diagnostics.
puts "Effective: #{JSON.generate(actual.merge(dependencies: actual[:dependencies].map(&:to_s).sort))}"
abort "#{failures.length} podspec contract failure(s)" unless failures.empty?
