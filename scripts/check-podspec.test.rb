# Contract witnesses using real CocoaPods and the RN_PODS helper, as the checker does.
# Run with CocoaPods' Ruby/gems, RN_PODS and RCT_NEW_ARCH_ENABLED=1.
# CHECK_PODSPEC can select a disposable checker for mutation testing.
require 'cocoapods'
require 'fileutils'
require 'open3'
require 'rbconfig'
require 'tmpdir'
require ENV.fetch('RN_PODS')

root = File.expand_path('..', __dir__)
checker = ENV.fetch('CHECK_PODSPEC', File.join(__dir__, 'check-podspec.rb'))
podspec = File.read(File.join(root, 'react-native-keep-awake.podspec'))
insertion = 'install_modules_dependencies(s)'
abort 'SETUP: expected one RN helper invocation' unless podspec.scan(insertion).length == 1

reference = Pod::Specification.new { |s| s.name = 'Reference' }
install_modules_dependencies(reference)
reference_ios = reference.consumer(:ios)
abort 'SETUP: expected New Architecture RN helper' unless
  reference_ios.compiler_flags == ['-DRCT_NEW_ARCH_ENABLED=1'] &&
  reference_ios.pod_target_xcconfig['CLANG_CXX_LANGUAGE_STANDARD'] == 'c++20'

labels = {
  source: 'CocoaPods HTTPS Git source',
  tag: 'version/tag identity',
  minimum: 'React Native iOS minimum',
  dependencies: 'dependencies match the installed React Native helper',
  flags: 'compiler_flags match the installed React Native helper',
  xcconfig: 'pod_target_xcconfig match the installed React Native helper',
  sources: 'production sources exclude tests and generated code'
}

# Each fixture changes only the stated attribute, after the official RN helper.
# Positive fixtures prove that CocoaPods-equivalent root/iOS representations work.
cases = [
  ['valid root; iOS attributes absent', '', []],
  ['empty iOS containers', 's.ios.compiler_flags = []; s.ios.pod_target_xcconfig = {}', []],
  ['nil iOS attributes', 's.ios.compiler_flags = nil; s.ios.pod_target_xcconfig = nil', []],
  ['root flag array equivalent to string', "s.compiler_flags = Array(s.attributes_hash.fetch('compiler_flags'))", []],
  ['flags moved from root to iOS', "s.ios.compiler_flags = s.attributes_hash.delete('compiler_flags')", []],
  ['xcconfig moved from root to iOS', "s.ios.pod_target_xcconfig = s.attributes_hash.delete('pod_target_xcconfig')", []],
  ['dependencies moved from root to iOS', <<~RUBY, []],
    s.attributes_hash.delete('dependencies').each do |name, requirements|
      s.ios.dependency name, *requirements
    end
  RUBY
  ['other platform values do not change iOS', <<~RUBY, []],
    s.osx.compiler_flags = '-DRCT_NEW_ARCH_ENABLED=0'
    s.osx.pod_target_xcconfig = {'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17'}
    s.osx.dependency 'React-Codegen'
  RUBY
  ['iOS C++17 override', "s.ios.pod_target_xcconfig = {'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17'}", [:xcconfig]],
  ['iOS contradictory New Architecture flag', "s.ios.compiler_flags = '-DRCT_NEW_ARCH_ENABLED=0'", [:flags]],
  ['iOS flag array with contradiction', "s.ios.compiler_flags = ['-DRCT_NEW_ARCH_ENABLED=1', '-DRCT_NEW_ARCH_ENABLED=0']", [:flags]],
  ['iOS flag string with contradiction', "s.ios.compiler_flags = '-DRCT_NEW_ARCH_ENABLED=0 -DRCT_NEW_ARCH_ENABLED=1'", [:flags]],
  ['iOS C++ flags with contradiction', "s.ios.pod_target_xcconfig = {'OTHER_CPLUSPLUSFLAGS' => '-DRCT_NEW_ARCH_ENABLED=0'}", [:xcconfig]],
  ['iOS xcconfig array preserves both values', "s.ios.pod_target_xcconfig = {'CLANG_CXX_LANGUAGE_STANDARD' => ['c++17']}", [:xcconfig]],
  ['correct iOS flag cannot mask incorrect root flag', "s.compiler_flags = '-DRCT_NEW_ARCH_ENABLED=0'; s.ios.compiler_flags = '-DRCT_NEW_ARCH_ENABLED=1'", [:flags]],
  ['correct iOS C++ cannot mask incorrect root C++', <<~RUBY, [:xcconfig]],
    s.pod_target_xcconfig = s.attributes_hash.fetch('pod_target_xcconfig').merge('CLANG_CXX_LANGUAGE_STANDARD' => 'c++17')
    s.ios.pod_target_xcconfig = {'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20'}
  RUBY
  ['iOS extra dependency', "s.ios.dependency 'React-Codegen'", [:dependencies]],
  ['iOS constraint on existing dependency', "s.ios.dependency 'React-Core', '< 0'", [:dependencies]],
  ['root incorrect flag', "s.compiler_flags = '-DRCT_NEW_ARCH_ENABLED=0'", [:flags]],
  ['root incorrect xcconfig', "s.pod_target_xcconfig = {'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17'}", [:xcconfig]],
  ['root extra dependency', "s.dependency 'React-Codegen'", [:dependencies]],
  ['root flags absent', "s.attributes_hash.delete('compiler_flags')", [:flags]],
  ['root xcconfig absent', "s.attributes_hash.delete('pod_target_xcconfig')", [:xcconfig]],
  ['root dependencies absent', "s.attributes_hash.delete('dependencies')", [:dependencies]],
  ['root flags nil', 's.compiler_flags = nil', [:flags]],
  ['root xcconfig nil', 's.pod_target_xcconfig = nil', [:xcconfig]],
  ['partial iOS xcconfig cannot replace missing root', <<~RUBY, [:xcconfig]],
    s.attributes_hash.delete('pod_target_xcconfig')
    s.ios.pod_target_xcconfig = {'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20'}
  RUBY
  ['root flags empty', 's.compiler_flags = []', [:flags]],
  ['root xcconfig empty', 's.pod_target_xcconfig = {}', [:xcconfig]],
  ['git+ URL regression', "s.source = s.source.merge(:git => 'git+https://github.com/marcocrupi/react-native-keep-awake-plus.git')", [:source]],
  ['tag identity regression', "s.source = s.source.merge(:tag => 'v-invalid')", [:tag]],
  ['deployment minimum regression', "s.ios.deployment_target = '8.0'", [:minimum]],
  ['source glob includes test regression', "s.source_files = 'ios/**/*.{h,m,mm}'", [:sources]],
  ['source glob missing implementation regression', "s.source_files = 'ios/*.h'", [:sources]]
]

# R04-02: expected selections are explicit fixture facts, not computed with the
# checker's resolver. Probe CocoaPods' target merge and real Compile Sources phase.
subspec_cases = [
  ['default child C++17', "s.subspec('EffectiveIOS') { |ss| ss.ios.pod_target_xcconfig = {'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17'} }", [:xcconfig], ['EffectiveIOS']],
  ['default child impossible dependency', "s.subspec('EffectiveIOS') { |ss| ss.ios.dependency 'React-Core', '< 0' }", [:dependencies], ['EffectiveIOS']],
  ['default child flags with source', <<~RUBY, [:flags, :sources], ['EffectiveIOS']],
    s.subspec 'EffectiveIOS' do |ss|
      ss.ios.compiler_flags = '-DRCT_NEW_ARCH_ENABLED=0'
      ss.source_files = 'ios/effective/Extra.mm'
    end
  RUBY
  ['xcconfig moved to default child', "s.subspec('EffectiveIOS') { |ss| ss.ios.pod_target_xcconfig = s.attributes_hash.delete('pod_target_xcconfig') }", [], ['EffectiveIOS']],
  ['default none ignores incompatible child', <<~RUBY, [], []],
    s.default_subspecs = :none
    s.subspec 'Inactive' do |ss|
      ss.ios.pod_target_xcconfig = {'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17'}
      ss.ios.compiler_flags = '-DRCT_NEW_ARCH_ENABLED=0'
      ss.ios.dependency 'React-Core', '< 0'
      ss.source_files = 'ios/effective/Extra.mm'
    end
  RUBY
  ['multiple selected children preserve conflict', <<~RUBY, [:xcconfig], ['Good', 'Bad']],
    s.subspec('Good') { |ss| ss.ios.pod_target_xcconfig = {'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20'} }
    s.subspec('Bad') { |ss| ss.ios.pod_target_xcconfig = {'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17'} }
  RUBY
  ['xcconfig split across selected children', <<~RUBY, [], ['First', 'Second']],
    config = s.attributes_hash.delete('pod_target_xcconfig')
    s.subspec('First') { |ss| ss.ios.pod_target_xcconfig = {'CLANG_CXX_LANGUAGE_STANDARD' => config.delete('CLANG_CXX_LANGUAGE_STANDARD')} }
    s.subspec('Second') { |ss| ss.pod_target_xcconfig = config }
  RUBY
  ['named default ignores sibling', <<~RUBY, [], ['Good']],
    s.default_subspecs = 'Good'
    s.subspec('Good') { |_| }
    s.subspec('Inactive') { |ss| ss.ios.dependency 'React-Core', '< 0' }
  RUBY
  ['nested default includes grandchild', <<~RUBY, [:xcconfig], ['Parent', 'Parent/Leaf']],
    s.subspec 'Parent' do |ss|
      ss.subspec('Leaf') { |leaf| leaf.ios.pod_target_xcconfig = {'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17'} }
    end
  RUBY
  ['nested default none ignores grandchild', <<~RUBY, [], ['Parent']],
    s.subspec 'Parent' do |ss|
      ss.default_subspecs = :none
      ss.subspec('Inactive') { |leaf| leaf.ios.dependency 'React-Core', '< 0' }
    end
  RUBY
  ['same pod dependency selects nondefault sibling', <<~RUBY, [:dependencies], ['Entry', 'Hidden']],
    s.default_subspecs = 'Entry'
    s.subspec('Entry') { |ss| ss.dependency "\#{s.name}/Hidden" }
    s.subspec('Hidden') { |ss| ss.ios.dependency 'React-Core', '< 0' }
  RUBY
  ['transitive same pod dependency', <<~RUBY, [:xcconfig], ['Entry', 'Middle', 'Hidden']],
    s.default_subspecs = 'Entry'
    s.subspec('Entry') { |ss| ss.dependency "\#{s.name}/Middle" }
    s.subspec('Middle') { |ss| ss.dependency "\#{s.name}/Hidden" }
    s.subspec('Hidden') { |ss| ss.ios.pod_target_xcconfig = {'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17'} }
  RUBY
  ['selected child iOS cannot mask root C++17', <<~RUBY, [:xcconfig], ['Child']],
    s.pod_target_xcconfig = s.attributes_hash.fetch('pod_target_xcconfig').merge('CLANG_CXX_LANGUAGE_STANDARD' => 'c++17')
    s.subspec('Child') { |ss| ss.ios.pod_target_xcconfig = {'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20'} }
  RUBY
  ['selected child extra dependency', "s.subspec('Child') { |ss| ss.dependency 'React-Codegen' }", [:dependencies], ['Child']],
  ['dependencies moved to default child', <<~RUBY, [], ['Child']],
    deps = s.attributes_hash.delete('dependencies')
    s.subspec('Child') { |ss| deps.each { |name, requirements| ss.ios.dependency name, *requirements } }
  RUBY
  ['flags and sources moved to default child', <<~RUBY, [], ['Child']],
    flags = s.attributes_hash.delete('compiler_flags')
    sources = s.attributes_hash.delete('source_files')
    s.subspec('Child') { |ss| ss.ios.compiler_flags = flags; ss.source_files = sources }
  RUBY
  ['selected child root and iOS flags concatenate', <<~RUBY, [:flags], ['Child']],
    sources = s.attributes_hash.delete('source_files')
    s.subspec 'Child' do |ss|
      ss.source_files = sources
      ss.compiler_flags = '-DRCT_NEW_ARCH_ENABLED=0'
      ss.ios.compiler_flags = '-DRCT_NEW_ARCH_ENABLED=1'
    end
  RUBY
  ['non iOS dependency does not select sibling', <<~RUBY, [], ['Entry']],
    s.default_subspecs = 'Entry'
    s.subspec('Entry') { |ss| ss.osx.dependency "\#{s.name}/Inactive" }
    s.subspec('Inactive') { |ss| ss.ios.dependency 'React-Core', '< 0' }
  RUBY
  ['non library children do not participate', <<~RUBY, [], []],
    s.test_spec('Tests') { |ss| ss.dependency 'React-Core', '< 0' }
    s.app_spec('App') { |ss| ss.pod_target_xcconfig = {'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17'} }
  RUBY
  ['selected child without sources has no compiler flag effect', "s.subspec('Metadata') { |ss| ss.ios.compiler_flags = '-DRCT_NEW_ARCH_ENABLED=0' }", [], ['Metadata']],
  ['explicit multiple defaults ignore incompatible sibling', <<~RUBY, [], ['First', 'Second']],
    s.default_subspecs = ['First', 'Second']
    s.subspec('First') { |_| }
    s.subspec('Second') { |_| }
    s.subspec('Inactive') { |ss| ss.ios.pod_target_xcconfig = {'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17'} }
  RUBY
  ['nested named default selects leaf only', <<~RUBY, [], ['Parent/Leaf']],
    s.default_subspecs = 'Parent/Leaf'
    s.subspec 'Parent' do |ss|
      ss.subspec('Leaf') { |_| }
      ss.subspec('Inactive') { |leaf| leaf.ios.dependency 'React-Core', '< 0' }
    end
  RUBY
  ['shared source receives child flags too', <<~RUBY, [:flags], ['Shared']],
    s.subspec 'Shared' do |ss|
      ss.source_files = 'ios/ReactNativeKCKeepAwake.mm'
      ss.ios.compiler_flags = '-DRCT_NEW_ARCH_ENABLED=0'
    end
  RUBY
  ['selected child iOS xcconfig completes root', <<~RUBY, [], ['Child']],
    standard = s.attributes_hash.fetch('pod_target_xcconfig').delete('CLANG_CXX_LANGUAGE_STANDARD')
    s.subspec('Child') { |ss| ss.ios.pod_target_xcconfig = {'CLANG_CXX_LANGUAGE_STANDARD' => standard} }
  RUBY
  ['macOS only child is inactive for iOS', <<~RUBY, [], []],
    s.subspec 'MacOnly' do |ss|
      ss.platform = :osx, '10.15'
      ss.dependency 'React-Core', '< 0'
    end
  RUBY
  ['duplicate selected dependency is equivalent', "s.subspec('Child') { |ss| ss.ios.dependency 'React-Core' }", [], ['Child']],
  ['selected child legacy iOS xcconfig conflict', "s.subspec('Child') { |ss| ss.ios.xcconfig = {'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17'} }", [:xcconfig], ['Child']],
  ['nested inherited xcconfig remains equivalent', <<~RUBY, [], ['Parent', 'Parent/Leaf']],
    config = s.attributes_hash.delete('pod_target_xcconfig')
    s.subspec 'Parent' do |ss|
      ss.pod_target_xcconfig = config
      ss.subspec('Leaf') { |_| }
    end
  RUBY
]
# R04-03: only repetitions of the helper's explicit New Architecture definition
# are harmless here. Keep other options and contradictory definitions observable.
flag_cases = [
  ['shared source inherits identical definition', "s.subspec('Shared') { |ss| ss.source_files = 'ios/ReactNativeKCKeepAwake.mm' }", [], ['Shared']],
  ['shared source explicitly repeats identical definition', <<~RUBY, [], ['Shared']],
    s.subspec 'Shared' do |ss|
      ss.source_files = 'ios/ReactNativeKCKeepAwake.mm'
      ss.compiler_flags = '-DRCT_NEW_ARCH_ENABLED=1'
    end
  RUBY
  ['nested shared source repeats identical definition', <<~RUBY, [], ['Parent', 'Parent/Leaf']],
    s.subspec 'Parent' do |ss|
      ss.source_files = 'ios/ReactNativeKCKeepAwake.mm'
      ss.subspec('Leaf') { |leaf| leaf.source_files = 'ios/ReactNativeKCKeepAwake.mm' }
    end
  RUBY
  ['nonshared source inherits identical definition', <<~RUBY, [], ['Child']],
    s.source_files = 'ios/ReactNativeKCKeepAwake.h'
    s.subspec('Child') { |ss| ss.source_files = 'ios/ReactNativeKCKeepAwake.mm' }
  RUBY
  ['nonshared source repeats identical definition', <<~RUBY, [], ['Child']],
    s.source_files = 'ios/ReactNativeKCKeepAwake.h'
    s.subspec 'Child' do |ss|
      ss.source_files = 'ios/ReactNativeKCKeepAwake.mm'
      ss.compiler_flags = '-DRCT_NEW_ARCH_ENABLED=1 -DRCT_NEW_ARCH_ENABLED=1'
    end
  RUBY
  ['nonshared source preserves contradictory definition', <<~RUBY, [:flags], ['Child']],
    s.source_files = 'ios/ReactNativeKCKeepAwake.h'
    s.subspec 'Child' do |ss|
      ss.source_files = 'ios/ReactNativeKCKeepAwake.mm'
      ss.compiler_flags = '-DRCT_NEW_ARCH_ENABLED=0'
    end
  RUBY
]
expected_compile_flags = {
  'shared source inherits identical definition' => [1, 1],
  'shared source explicitly repeats identical definition' => [1, 1, 1],
  'nested shared source repeats identical definition' => [1, 1, 1],
  'nonshared source inherits identical definition' => [1],
  'nonshared source repeats identical definition' => [1, 1, 1],
  'nonshared source preserves contradictory definition' => [1, 0],
  'shared source receives child flags too' => [1, 1, 0]
}.transform_values { |values| values.map { |value| "-DRCT_NEW_ARCH_ENABLED=#{value}" }.join(' ') }
[
  ['root identical definition twice', '-DRCT_NEW_ARCH_ENABLED=1 -DRCT_NEW_ARCH_ENABLED=1', []],
  ['root identical definition three times', '-DRCT_NEW_ARCH_ENABLED=1 -DRCT_NEW_ARCH_ENABLED=1 -DRCT_NEW_ARCH_ENABLED=1', []],
  ['contradiction before identical definitions', '-DRCT_NEW_ARCH_ENABLED=0 -DRCT_NEW_ARCH_ENABLED=1 -DRCT_NEW_ARCH_ENABLED=1', [:flags]],
  ['contradiction between identical definitions', '-DRCT_NEW_ARCH_ENABLED=1 -DRCT_NEW_ARCH_ENABLED=0 -DRCT_NEW_ARCH_ENABLED=1', [:flags]],
  ['different definition is not a matching prefix', '-DRCT_NEW_ARCH_ENABLED=1 -DRCT_NEW_ARCH_ENABLED=10', [:flags]],
  ['undefine between identical definitions', '-DRCT_NEW_ARCH_ENABLED=1 -URCT_NEW_ARCH_ENABLED -DRCT_NEW_ARCH_ENABLED=1', [:flags]],
  ['undefine after identical definitions', '-DRCT_NEW_ARCH_ENABLED=1 -DRCT_NEW_ARCH_ENABLED=1 -URCT_NEW_ARCH_ENABLED', [:flags]],
  ['repeated other definition remains material', '-DRCT_NEW_ARCH_ENABLED=1 -DOTHER=1 -DOTHER=1', [:flags]],
  ['repeated warning option remains material', '-DRCT_NEW_ARCH_ENABLED=1 -Wno-format -Wno-format', [:flags]],
  ['repeated language option remains material', '-DRCT_NEW_ARCH_ENABLED=1 -std=c++17 -std=c++17', [:flags]],
  ['preprocessor forwarding remains material', '-DRCT_NEW_ARCH_ENABLED=1 -Xpreprocessor -DRCT_NEW_ARCH_ENABLED=1', [:flags]],
  ['quoted other definition is not a repeated option', '-DRCT_NEW_ARCH_ENABLED=1 -DOTHER="-DRCT_NEW_ARCH_ENABLED=1 -DRCT_NEW_ARCH_ENABLED=1"', [:flags]]
].each do |name, flags, rejected|
  flag_cases << [name, "s.compiler_flags = #{flags.inspect}", rejected, []]
  expected_compile_flags[name] = flags
end
# Keep the original 34 anchors as a separately reported group.
anchor_count = cases.length
cases.concat(subspec_cases)
cases.concat(flag_cases)

def target_probe(spec, selected_subspecs, fixture)
  selected = [spec] + selected_subspecs.map { |name| spec.subspec_by_name("#{spec.name}/#{name}") }
  podfile = Pod::Podfile.new do
    platform :ios, min_ios_version_supported
    target('Witness') { pod spec.name }
  end
  sandbox = Pod::Sandbox.new(File.join(fixture, 'probe-sandbox'))
  accessors = selected.map { |s| Pod::Sandbox::FileAccessor.new(Pathname.new(fixture), s.consumer(:ios)) }
  target = Pod::PodTarget.new(sandbox, Pod::BuildType.static_library,
    {'Debug' => :debug}, ['arm64'], Pod::Platform.new(:ios, min_ios_version_supported),
    selected, podfile.target_definitions.values.reject(&:abstract?), accessors)
  settings = Pod::Target::BuildSettings::PodTargetSettings.new(target, configuration: :debug)
  project = Pod::Project.new(File.join(fixture, 'Witness.xcodeproj'))
  accessors.flat_map(&:source_files).uniq.each { |file| project.add_file_reference(file, project.main_group) }
  native = project.new_target(:static_library, spec.name, :ios, min_ios_version_supported)
  installer = Pod::Installer::Xcode::PodsProjectGenerator::PodTargetInstaller.new(sandbox, project, target)
  installer.send(:add_files_to_build_phases, native, [], {})
  {
    xcconfig: settings.merged_pod_target_xcconfigs,
    dependencies: target.spec_consumers.flat_map(&:dependencies).reject { |d| d.root_name == spec.name }.map(&:to_s).uniq.sort,
    flags: native.source_build_phase.files.map { |f| [f.file_ref.real_path.relative_path_from(Pathname.new(fixture).realpath).to_s, (f.settings || {})['COMPILER_FLAGS']] }.sort,
    sources: accessors.flat_map(&:source_files).map { |f| f.relative_path_from(Pathname.new(fixture)).to_s }.uniq.sort
  }
end

failures = []
Dir.mktmpdir('keep-awake-podspec-witness-') do |scratch|
  cases.each_with_index do |(name, patch, rejected, selected_subspecs), index|
    fixture = File.join(scratch, index.to_s)
    FileUtils.mkdir_p(fixture)
    FileUtils.cp(File.join(root, 'package.json'), fixture)
    FileUtils.cp_r(File.join(root, 'ios'), fixture)
    if patch.include?('ios/effective/Extra.mm')
      FileUtils.mkdir_p(File.join(fixture, 'ios/effective'))
      File.write(File.join(fixture, 'ios/effective/Extra.mm'), 'int subspec_witness(void) { return 0; }')
    end
    path = File.join(fixture, 'react-native-keep-awake.podspec')
    File.write(path, podspec.sub(insertion, "#{insertion}\n  #{patch}"))

    begin
      # Read the fixture independently of the checker process and retain native
      # Array/Hash values, including concatenated or contradictory flags.
      fixture_spec = Pod::Specification.from_file(path)
      ios = fixture_spec.consumer(:ios)
      if selected_subspecs
        probe = target_probe(fixture_spec, selected_subspecs, fixture)
        if expected_compile_flags.key?(name)
          expected_entries = [['ios/ReactNativeKCKeepAwake.mm', expected_compile_flags.fetch(name)]]
          raise 'fixture lost its expected Compile Sources flags' unless probe[:flags] == expected_entries
        end
        if name == 'default child C++17'
          raise 'target merge lost C++ conflict' if probe[:xcconfig].key?('CLANG_CXX_LANGUAGE_STANDARD')
        elsif name == 'default child impossible dependency'
          raise 'hidden constraint absent' unless probe[:dependencies].include?('React-Core (< 0)')
        elsif name == 'default child flags with source'
          raise 'contradiction not applied to source' unless probe[:flags].include?(
            ['ios/effective/Extra.mm', '-DRCT_NEW_ARCH_ENABLED=1 -DRCT_NEW_ARCH_ENABLED=0'])
        elsif name == 'xcconfig moved to default child'
          raise 'equivalent target differs' unless probe[:xcconfig] == reference_ios.pod_target_xcconfig
        end
        puts "TARGET #{name}: #{JSON.generate(probe)}"
      else
        changed = []
        changed << :flags unless ios.compiler_flags == reference_ios.compiler_flags
        changed << :xcconfig unless ios.pod_target_xcconfig == reference_ios.pod_target_xcconfig
        changed << :dependencies unless ios.dependencies.map(&:to_s).sort == reference_ios.dependencies.map(&:to_s).sort
        expected_changed = rejected & [:flags, :xcconfig, :dependencies]
        raise "fixture effective settings differ unexpectedly: #{changed.inspect}" unless changed.sort == expected_changed.sort
        if name == 'iOS C++17 override'
          raise 'C++ witness did not concatenate root/iOS' unless
            ios.pod_target_xcconfig['CLANG_CXX_LANGUAGE_STANDARD'] == 'c++20 c++17'
        elsif name == 'iOS contradictory New Architecture flag'
          raise 'flag witness lost the contradiction' unless
            ios.compiler_flags == ['-DRCT_NEW_ARCH_ENABLED=1', '-DRCT_NEW_ARCH_ENABLED=0']
        end
      end

      stdout, stderr, status = Open3.capture3(RbConfig.ruby, checker, fixture)
      expected_exit = rejected.empty? ? 0 : 1
      actual_failures = stdout.lines.grep(/^FAIL /).map { |line| line.delete_prefix('FAIL ').strip }
      actual_passes = stdout.lines.grep(/^PASS /).map { |line| line.delete_prefix('PASS ').strip }
      expected_failures = rejected.map { |key| labels.fetch(key) }
      raise "exit #{status.exitstatus.inspect}; expected #{expected_exit}\n#{stdout}#{stderr}" unless status.exitstatus == expected_exit
      raise "wrong contract failure(s): #{actual_failures.inspect}\n#{stdout}#{stderr}" unless actual_failures.sort == expected_failures.sort
      raise "missing checks\n#{stdout}#{stderr}" unless (actual_passes + actual_failures).sort == labels.values.sort
      unless rejected.empty?
        raise "failure was not contractual: #{stderr}" unless stderr.include?("#{rejected.length} podspec contract failure(s)")
      end
      if selected_subspecs
        effective = JSON.parse(stdout.lines.find { |line| line.start_with?('Effective: ') }.to_s.delete_prefix('Effective: '))
        expected_names = [fixture_spec.name] + selected_subspecs.map { |name| "#{fixture_spec.name}/#{name}" }
        raise "wrong selected specs: #{effective['specs'].inspect}" unless effective.fetch('specs').sort == expected_names.sort
        probe.each do |key, value|
          raise "target mismatch for #{key}" unless effective.fetch(key.to_s) == value
        end
      end
      puts "PASS witness #{name}: checker exit #{status.exitstatus}"
    rescue StandardError => e
      failures << name
      warn "FAIL witness #{name}: #{e.message}"
    end
  end
end
puts "#{cases.length - failures.length}/#{cases.length} podspec witnesses passed (#{anchor_count} anchors, #{subspec_cases.length} subspec witnesses, #{flag_cases.length} flag witnesses)"
abort "#{failures.length} witness failure(s)" unless failures.empty?
