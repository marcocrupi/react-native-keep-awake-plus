"""Check source registration and the source or built app's scene contract.

python3 example/ios/tests/test_scene_configuration.py [--ios-root PATH] [--app APP]
Runtime launch and React rendering must be validated separately.
"""

import argparse
import json
from pathlib import Path
import plistlib
import subprocess
import unittest


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--ios-root", type=Path, default=Path(__file__).resolve().parents[1])
parser.add_argument("--app", type=Path)
args = parser.parse_args()


class SceneConfigurationTests(unittest.TestCase):
    def test_scene_manifest(self):
        plist_path = (args.app / "Info.plist" if args.app else
                      args.ios_root / "KeepAwakePlusSmoke/Info.plist")
        with plist_path.open("rb") as source:
            info = plistlib.load(source)
        manifest = info.get("UIApplicationSceneManifest", {})
        self.assertIs(manifest.get("UIApplicationSupportsMultipleScenes"), False)
        configurations = manifest.get("UISceneConfigurations", {}).get(
            "UIWindowSceneSessionRoleApplication", [])
        self.assertEqual(len(configurations), 1)
        configuration = configurations[0]
        self.assertEqual(configuration["UISceneConfigurationName"], "Default Configuration")
        self.assertEqual(configuration["UISceneClassName"], "UIWindowScene")
        self.assertTrue(configuration["UISceneDelegateClassName"].endswith(".SceneDelegate"))
        self.assertNotIn("UISceneStoryboardFile", configuration)
        if args.app:
            self.assertNotIn("$(", configuration["UISceneDelegateClassName"])

    def test_scene_delegate_is_in_application_sources(self):
        project = args.ios_root / "KeepAwakePlusSmoke.xcodeproj/project.pbxproj"
        objects = json.loads(subprocess.check_output([
            "plutil", "-convert", "json", "-o", "-", str(project)]))["objects"]
        target = next(value for value in objects.values()
                      if value["isa"] == "PBXNativeTarget" and
                      value["name"] == "KeepAwakePlusSmoke")
        phases = [objects[key] for key in target["buildPhases"]
                  if objects[key]["isa"] == "PBXSourcesBuildPhase"]
        paths = [objects[objects[key]["fileRef"]]["path"]
                 for phase in phases for key in phase["files"]]
        self.assertEqual(paths.count("KeepAwakePlusSmoke/SceneDelegate.swift"), 1)
        self.assertTrue((args.ios_root / "KeepAwakePlusSmoke/SceneDelegate.swift").is_file())


if __name__ == "__main__":
    unittest.main(argv=[__file__])
